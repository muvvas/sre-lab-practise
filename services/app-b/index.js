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

fs.mkdirSync(path.dirname(logFile), { recursive: true });

const meter = metrics.getMeter(appName);
const tracer = trace.getTracer(appName);
const requestCounter = meter.createCounter("worker_requests_total", {
  description: "Total downstream requests"
});
const errorCounter = meter.createCounter("worker_errors_total", {
  description: "Total downstream failures"
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

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: appName, host: os.hostname() });
});

app.get("/ready", (req, res) => {
  res.json({ status: "ready", service: appName });
});

app.get("/api/work", async (req, res) => {
  const startHr = process.hrtime.bigint();
  const items = Number(req.query.items || 1);
  const latencyMs = Number(req.query.latencyMs || 0);
  const dependencyLatencyMs = Number(req.query.dependencyLatencyMs || latencyMs || 0);
  const dbDelayMs = Number(req.query.dbDelayMs || 0);
  const dbHoldMs = Number(req.query.dbHoldMs || 0);
  const dbFailureMode = String(req.query.dbFailureMode || "none");
  const failureRate = Math.min(Math.max(Number(req.query.failureRate || 0), 0), 1);
  const shouldFail = Math.random() < failureRate;

  requestCounter.add(1, { service: appName });

  if (latencyMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
  }

  try {
    const result = await tracer.startActiveSpan("call-app-c", async (span) => {
      const url = `${downstreamUrl}?items=${items}&latencyMs=${dependencyLatencyMs}&dbDelayMs=${dbDelayMs}&dbHoldMs=${dbHoldMs}&dbFailureMode=${encodeURIComponent(dbFailureMode)}&failureRate=${failureRate}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        span.setAttribute("http.status_code", response.status);

        if (!response.ok) {
          throw new Error(`Downstream returned ${response.status}`);
        }

        return data;
      } catch (error) {
        span.recordException(error);
        throw error;
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
      items
    });

    res.json({
      service: appName,
      processed_items: items,
      duration_ms: duration,
      data_service: result
    });
  } catch (error) {
    const duration = Number((process.hrtime.bigint() - startHr) / 1000000n);
    errorCounter.add(1, { service: appName });
    latencyHistogram.record(duration, { service: appName });
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
  log("info", "Service started", { port, downstreamUrl });
});
