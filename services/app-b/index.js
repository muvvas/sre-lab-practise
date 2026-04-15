require("./telemetry");

const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { metrics, trace } = require("@opentelemetry/api");

const app = express();
const port = Number(process.env.PORT || 3000);
const appName = process.env.APP_NAME || "app-b";
const downstreamUrl = process.env.DOWNSTREAM_URL || "http://app-c:3000/api/data";
const logFile = process.env.LOG_FILE || `/tmp/${appName}.log`;
const defaultTimeoutMs = Number(process.env.RESILIENCE_TIMEOUT_MS || 800);
const defaultRetryCount = Number(process.env.RESILIENCE_RETRY_COUNT || 1);
const circuitFailureThreshold = Number(process.env.CIRCUIT_FAILURE_THRESHOLD || 4);
const circuitOpenMs = Number(process.env.CIRCUIT_OPEN_MS || 15000);
const circuitState = {
  failureCount: 0,
  openUntil: 0,
  lastError: null
};

fs.mkdirSync(path.dirname(logFile), { recursive: true });
app.use(express.json({ limit: "1mb" }));

const meter = metrics.getMeter(appName);
const tracer = trace.getTracer(appName);
const requestCounter = meter.createCounter("worker_requests_total", {
  description: "Total downstream requests"
});
const errorCounter = meter.createCounter("worker_errors_total", {
  description: "Total downstream failures"
});
const retryCounter = meter.createCounter("worker_retries_total", {
  description: "Total retries attempted by app-b"
});
const fallbackCounter = meter.createCounter("worker_fallback_total", {
  description: "Total graceful fallback responses from app-b"
});
const circuitOpenCounter = meter.createCounter("worker_circuit_open_total", {
  description: "Total times app-b opened or used the circuit breaker"
});
const latencyHistogram = meter.createHistogram("worker_request_duration_ms", {
  description: "Downstream latency"
});

function log(level, message, extra = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: appName,
    message,
    ...extra
  };

  const line = JSON.stringify(record);
  console.log(line);
  fs.appendFileSync(logFile, `${line}\n`);
}

function resetCircuit() {
  circuitState.failureCount = 0;
  circuitState.openUntil = 0;
  circuitState.lastError = null;
}

function recordFailure(error) {
  circuitState.failureCount += 1;
  circuitState.lastError = error.message;
  if (circuitState.failureCount >= circuitFailureThreshold) {
    circuitState.openUntil = Date.now() + circuitOpenMs;
    circuitOpenCounter.add(1, { service: appName });
  }
}

function buildFallbackPayload(items, reason) {
  fallbackCounter.add(1, { service: appName });
  return {
    service: appName,
    processed_items: items,
    degraded: true,
    fallback_reason: reason,
    data_service: {
      service: "fallback",
      record_count: 0,
      duration_ms: 0,
      db_duration_ms: 0,
      records: []
    }
  };
}

function getCircuitSnapshot() {
  const now = Date.now();
  return {
    is_open: circuitState.openUntil > now,
    opens_at: circuitState.openUntil > now ? new Date(circuitState.openUntil).toISOString() : null,
    failure_count: circuitState.failureCount,
    last_error: circuitState.lastError,
    threshold: circuitFailureThreshold,
    open_window_ms: circuitOpenMs
  };
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(handle);
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: appName, host: os.hostname() });
});

app.get("/ready", (req, res) => {
  res.json({ status: "ready", service: appName });
});

app.get("/api/resilience-state", (req, res) => {
  res.json({
    service: appName,
    ...getCircuitSnapshot(),
    defaults: {
      timeout_ms: defaultTimeoutMs,
      retry_count: defaultRetryCount
    }
  });
});

app.post("/api/resilience/reset-circuit", (req, res) => {
  resetCircuit();
  log("info", "Circuit breaker manually reset", { route: "/api/resilience/reset-circuit" });
  res.json({ service: appName, message: "Circuit breaker reset", state: getCircuitSnapshot() });
});

app.get("/api/work", async (req, res) => {
  const startHr = process.hrtime.bigint();
  const items = Number(req.query.items || 1);
  const latencyMs = Number(req.query.latencyMs || 0);
  const dependencyLatencyMs = Number(req.query.dependencyLatencyMs || latencyMs || 0);
  const dbDelayMs = Number(req.query.dbDelayMs || 0);
  const dbHoldMs = Number(req.query.dbHoldMs || 0);
  const dbFailureMode = String(req.query.dbFailureMode || "none");
  const timeoutMs = Math.max(50, Number(req.query.timeoutMs || defaultTimeoutMs));
  const retryCount = Math.max(0, Number(req.query.retryCount || defaultRetryCount));
  const fallbackMode = String(req.query.fallbackMode || "none");
  const failureRate = Math.min(Math.max(Number(req.query.failureRate || 0), 0), 1);
  const shouldFail = Math.random() < failureRate;

  requestCounter.add(1, { service: appName });

  if (latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
  }

  try {
    if (circuitState.openUntil > Date.now()) {
      circuitOpenCounter.add(1, { service: appName });
      const duration = Number((process.hrtime.bigint() - startHr) / 1000000n);
      latencyHistogram.record(duration, { service: appName });
      log("warn", "Circuit breaker prevented downstream call", {
        route: "/api/work",
        duration_ms: duration,
        last_error: circuitState.lastError,
        fallback_mode: fallbackMode
      });

      if (fallbackMode === "stub") {
        return res.json({
          ...buildFallbackPayload(items, "circuit-open"),
          duration_ms: duration
        });
      }

      return res.status(503).json({
        service: appName,
        duration_ms: duration,
        error: "Circuit breaker is open"
      });
    }

    const result = await tracer.startActiveSpan("call-app-c", async (span) => {
      const url = `${downstreamUrl}?items=${items}&latencyMs=${dependencyLatencyMs}&dbDelayMs=${dbDelayMs}&dbHoldMs=${dbHoldMs}&dbFailureMode=${encodeURIComponent(dbFailureMode)}&failureRate=${failureRate}`;
      let attempt = 0;
      let lastError = null;

      try {
        while (attempt <= retryCount) {
          try {
            if (attempt > 0) {
              retryCounter.add(1, { service: appName });
              await new Promise((resolve) => setTimeout(resolve, attempt * 100));
            }

            const response = await fetchWithTimeout(url, timeoutMs);
            const data = await response.json();
            span.setAttribute("http.status_code", response.status);

            if (!response.ok) {
              throw new Error(`Downstream returned ${response.status}`);
            }

            resetCircuit();
            return data;
          } catch (error) {
            lastError = error.name === "AbortError"
              ? new Error(`Downstream timed out after ${timeoutMs} ms`)
              : error;
            span.recordException(lastError);
            attempt += 1;
          }
        }

        recordFailure(lastError);
        throw lastError;
      } finally {
        span.end();
      }
    });

    if (shouldFail) {
      throw new Error("Injected failure from app-b");
    }

    const duration = Number((process.hrtime.bigint() - startHr) / 1000000n);
    latencyHistogram.record(duration, { service: appName });
    log("info", "Downstream request succeeded", {
      route: "/api/work",
      duration_ms: duration,
      items,
      retry_count: retryCount,
      fallback_mode: fallbackMode
    });

    res.json({
      service: appName,
      processed_items: items,
      duration_ms: duration,
      retry_count: retryCount,
      data_service: result
    });
  } catch (error) {
    const duration = Number((process.hrtime.bigint() - startHr) / 1000000n);
    errorCounter.add(1, { service: appName });
    latencyHistogram.record(duration, { service: appName });

    if (fallbackMode === "stub") {
      log("warn", "Serving degraded fallback response", {
        route: "/api/work",
        duration_ms: duration,
        error: error.message
      });
      return res.json({
        ...buildFallbackPayload(items, error.message),
        duration_ms: duration
      });
    }

    log("error", "Downstream request failed", {
      route: "/api/work",
      duration_ms: duration,
      error: error.message
    });

    return res.status(503).json({
      service: appName,
      duration_ms: duration,
      error: error.message
    });
  }
});

app.listen(port, () => {
  log("info", "Service started", {
    port,
    downstreamUrl,
    defaultTimeoutMs,
    defaultRetryCount,
    circuitFailureThreshold,
    circuitOpenMs
  });
});
