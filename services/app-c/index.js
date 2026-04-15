require("./telemetry");

const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { metrics } = require("@opentelemetry/api");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);
const appName = process.env.APP_NAME || "app-c";
const logFile = process.env.LOG_FILE || `/tmp/${appName}.log`;
const databaseUrl = process.env.DATABASE_URL || "postgres://sre:sre@postgres:5432/srelab";
const dbPoolMax = Number(process.env.DB_POOL_MAX || 5);

fs.mkdirSync(path.dirname(logFile), { recursive: true });

const pool = new Pool({
  connectionString: databaseUrl,
  max: dbPoolMax
});

const meter = metrics.getMeter(appName);
const requestCounter = meter.createCounter("data_requests_total", {
  description: "Total app-c requests"
});
const dbQueryCounter = meter.createCounter("db_queries_total", {
  description: "Total Postgres queries from app-c"
});
const dbErrorCounter = meter.createCounter("db_query_errors_total", {
  description: "Total failed Postgres queries from app-c"
});
const dbPoolHoldCounter = meter.createCounter("db_pool_hold_total", {
  description: "Total requests that intentionally held a DB connection"
});
const errorCounter = meter.createCounter("data_errors_total", {
  description: "Total app-c failures"
});
const latencyHistogram = meter.createHistogram("data_request_duration_ms", {
  description: "app-c latency"
});
const dbLatencyHistogram = meter.createHistogram("db_query_duration_ms", {
  description: "Postgres query latency from app-c"
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

app.get("/api/data", async (req, res) => {
  const startHr = process.hrtime.bigint();
  const items = Number(req.query.items || 1);
  const latencyMs = Number(req.query.latencyMs || 0);
  const dbDelayMs = Number(req.query.dbDelayMs || 0);
  const dbHoldMs = Number(req.query.dbHoldMs || 0);
  const dbFailureMode = String(req.query.dbFailureMode || "none");
  const failureRate = Math.min(Math.max(Number(req.query.failureRate || 0), 0), 1);
  const shouldFail = Math.random() < failureRate;

  requestCounter.add(1, { service: appName });

  try {
    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }

    if (dbFailureMode === "before-query") {
      throw new Error("Injected database failure before query");
    }

    const dbStartHr = process.hrtime.bigint();
    dbQueryCounter.add(1, { service: appName });
    const client = await pool.connect();
    let result;
    try {
      if (dbHoldMs > 0) {
        dbPoolHoldCounter.add(1, { service: appName });
        await client.query("BEGIN");
        await client.query("SELECT pg_sleep($1 / 1000.0)", [dbHoldMs]);
      }

      if (dbFailureMode === "after-hold") {
        throw new Error("Injected database failure after holding a connection");
      }

      const query = `
        SELECT id, name AS value, category, score
        FROM inventory_items
        ${dbDelayMs > 0 ? ", pg_sleep($1 / 1000.0)" : ""}
        ORDER BY id
        LIMIT $${dbDelayMs > 0 ? 2 : 1}
      `;
      const params = dbDelayMs > 0 ? [dbDelayMs, items] : [items];
      result = await client.query(query, params);

      if (dbHoldMs > 0) {
        await client.query("COMMIT");
      }
    } catch (error) {
      if (dbHoldMs > 0) {
        try {
          await client.query("ROLLBACK");
        } catch (_) {
          // Ignore rollback failures during injected-failure experiments.
        }
      }
      throw error;
    } finally {
      client.release();
    }
    const dbDuration = Number((process.hrtime.bigint() - dbStartHr) / 1000000n);
    dbLatencyHistogram.record(dbDuration, { service: appName });

    if (shouldFail) {
      throw new Error("Injected failure from app-c");
    }

    const duration = Number((process.hrtime.bigint() - startHr) / 1000000n);
    latencyHistogram.record(duration, { service: appName });

    log("info", "Data request succeeded", {
      route: "/api/data",
      duration_ms: duration,
      db_duration_ms: dbDuration,
      db_hold_ms: dbHoldMs,
      items
    });

    res.json({
      service: appName,
      record_count: result.rows.length,
      duration_ms: duration,
      db_duration_ms: dbDuration,
      records: result.rows
    });
  } catch (error) {
    const duration = Number((process.hrtime.bigint() - startHr) / 1000000n);
    errorCounter.add(1, { service: appName });
    dbErrorCounter.add(1, { service: appName });
    latencyHistogram.record(duration, { service: appName });
    log("error", "Data request failed", {
      route: "/api/data",
      duration_ms: duration,
      db_hold_ms: dbHoldMs,
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
  log("info", "Service started", { port, databaseUrl, dbPoolMax });
});
