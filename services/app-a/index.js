require("./telemetry");

const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { metrics, trace } = require("@opentelemetry/api");

const app = express();
const port = Number(process.env.PORT || 3000);
const appName = process.env.APP_NAME || "app-a";
const downstreamUrl = process.env.DOWNSTREAM_URL || "http://app-b:3000/api/work";
const logFile = process.env.LOG_FILE || `/tmp/${appName}.log`;
const recentRequests = [];
const maxRecentRequests = 240;

fs.mkdirSync(path.dirname(logFile), { recursive: true });
app.use(express.static(path.join(__dirname, "public")));

const meter = metrics.getMeter(appName);
const tracer = trace.getTracer(appName);
const requestCounter = meter.createCounter("demo_requests_total", {
  description: "Total demo requests"
});
const latencySliGoodCounter = meter.createCounter("demo_latency_sli_good_total", {
  description: "Requests completed within the latency SLI threshold"
});
const errorCounter = meter.createCounter("demo_errors_total", {
  description: "Total failed demo requests"
});
const latencyHistogram = meter.createHistogram("demo_request_duration_ms", {
  description: "End-to-end request latency"
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

function busyWait(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    Math.sqrt(Math.random() * 1000);
  }
}

function percentile(values, point) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(point * sorted.length) - 1));
  return sorted[index];
}

function recordRequest(entry) {
  recentRequests.push({
    ...entry,
    timestamp: Date.now()
  });

  while (recentRequests.length > maxRecentRequests) {
    recentRequests.shift();
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: appName, host: os.hostname() });
});

app.get("/ready", (req, res) => {
  res.json({ status: "ready", service: appName });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/stats", (req, res) => {
  const now = Date.now();
  const recentWindow = recentRequests.filter((entry) => now - entry.timestamp <= 5 * 60 * 1000);
  const successes = recentWindow.filter((entry) => entry.statusCode < 500);
  const durations = recentWindow.map((entry) => entry.duration_ms);
  const requestsPerMinute = recentWindow.filter((entry) => now - entry.timestamp <= 60 * 1000).length;
  const chartPoints = recentRequests.slice(-40).map((entry) => ({
    timestamp: entry.timestamp,
    duration_ms: entry.duration_ms,
    statusCode: entry.statusCode
  }));

  res.json({
    service: appName,
    generated_at: new Date(now).toISOString(),
    summary: {
      total_requests: recentWindow.length,
      success_rate: recentWindow.length === 0 ? 1 : successes.length / recentWindow.length,
      error_rate: recentWindow.length === 0 ? 0 : 1 - successes.length / recentWindow.length,
      requests_last_minute: requestsPerMinute,
      avg_latency_ms: durations.length === 0 ? 0 : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
      p95_latency_ms: Math.round(percentile(durations, 0.95))
    },
    recent_requests: chartPoints
  });
});

app.get("/api/demo", async (req, res) => {
  const startHr = process.hrtime.bigint();
  const latencyMs = Number(req.query.latencyMs || 0);
  const dependencyLatencyMs = Number(req.query.dependencyLatencyMs || latencyMs || 0);
  const dbDelayMs = Number(req.query.dbDelayMs || 0);
  const dbHoldMs = Number(req.query.dbHoldMs || 0);
  const dbFailureMode = String(req.query.dbFailureMode || "none");
  const cpuMs = Number(req.query.cpuMs || 0);
  const failureRate = Math.min(Math.max(Number(req.query.failureRate || 0), 0), 1);
  const items = Number(req.query.items || 1);
  const shouldFail = Math.random() < failureRate;

  requestCounter.add(1, { service: appName });

  try {
    if (cpuMs > 0) {
      busyWait(cpuMs);
    }

    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }

    const result = await tracer.startActiveSpan("call-app-b", async (span) => {
      const url = `${downstreamUrl}?items=${items}&latencyMs=${latencyMs}&dependencyLatencyMs=${dependencyLatencyMs}&dbDelayMs=${dbDelayMs}&dbHoldMs=${dbHoldMs}&dbFailureMode=${encodeURIComponent(dbFailureMode)}&failureRate=${failureRate}`;
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
      throw new Error("Injected failure from app-a");
    }

    const duration = Number((process.hrtime.bigint() - startHr) / 1000000n);
    latencyHistogram.record(duration, { service: appName });
    if (duration <= 300) {
      latencySliGoodCounter.add(1, { service: appName });
    }
    log("info", "Request succeeded", {
      route: "/api/demo",
      duration_ms: duration,
      items
    });
    recordRequest({
      route: "/api/demo",
      duration_ms: duration,
      statusCode: 200
    });

    res.json({
      service: appName,
      duration_ms: duration,
      downstream: result,
      message: "demo completed"
    });
  } catch (error) {
    const duration = Number((process.hrtime.bigint() - startHr) / 1000000n);
    errorCounter.add(1, { service: appName });
    latencyHistogram.record(duration, { service: appName });
    if (duration <= 300) {
      latencySliGoodCounter.add(1, { service: appName });
    }
    log("error", "Request failed", {
      route: "/api/demo",
      duration_ms: duration,
      error: error.message
    });
    recordRequest({
      route: "/api/demo",
      duration_ms: duration,
      statusCode: 500
    });

    res.status(500).json({
      service: appName,
      duration_ms: duration,
      error: error.message
    });
  }
});

app.listen(port, () => {
  log("info", "Service started", { port, downstreamUrl });
});
