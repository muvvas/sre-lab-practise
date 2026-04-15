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
const prometheusUrl = process.env.PROMETHEUS_URL || "http://prometheus:9090";
const reportsDir = process.env.REPORTS_DIR || path.join(__dirname, "reports");
const grafanaUrl = process.env.GRAFANA_URL || "http://grafana:3000";
const grafanaUser = process.env.GRAFANA_USER || "admin";
const grafanaPassword = process.env.GRAFANA_PASSWORD || "admin";
const logFile = process.env.LOG_FILE || `/tmp/${appName}.log`;
const recentRequests = [];
const maxRecentRequests = 240;
const labAnnotations = [];
const maxAnnotations = 200;
let latestSessionReport = null;

const downstreamBaseUrl = new URL(downstreamUrl).origin;

fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });
app.use(express.json({ limit: "2mb" }));
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

async function postGrafanaAnnotation(annotation) {
  try {
    const response = await fetch(`${grafanaUrl}/api/annotations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${grafanaUser}:${grafanaPassword}`).toString("base64")}`
      },
      body: JSON.stringify({
        time: Date.parse(annotation.timestamp),
        text: `[${annotation.type}] ${annotation.title}`,
        tags: ["sre-lab", annotation.type]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      log("warn", "Grafana annotation post failed", { status: response.status, body });
    }
  } catch (error) {
    log("warn", "Grafana annotation post failed", { error: error.message });
  }
}

function addAnnotation(type, title, details = {}) {
  const annotation = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type,
    title,
    details
  };

  labAnnotations.unshift(annotation);
  while (labAnnotations.length > maxAnnotations) {
    labAnnotations.pop();
  }

  log("info", "Lab annotation", annotation);
  if (["phase", "compare", "recovery", "session"].includes(type)) {
    void postGrafanaAnnotation(annotation);
  }
  return annotation;
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

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function queryPrometheus(query) {
  const response = await fetch(`${prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`);
  const body = await response.json();

  if (body.status !== "success" || !body.data.result.length) {
    return null;
  }

  const value = Number(body.data.result[0].value[1]);
  return Number.isFinite(value) ? value : null;
}

function summarizeSamples(samples) {
  const grouped = new Map();

  for (const sample of samples || []) {
    if (!grouped.has(sample.phase)) {
      grouped.set(sample.phase, []);
    }
    grouped.get(sample.phase).push(sample);
  }

  return Array.from(grouped.entries()).map(([phase, entries]) => ({
    phase,
    samples: entries.length,
    avg_success_rate_percent: Math.round(average(entries.map((entry) => (entry.summary?.success_rate || 0) * 100))),
    avg_error_rate_percent: Math.round(average(entries.map((entry) => (entry.summary?.error_rate || 0) * 100))),
    avg_p95_latency_ms: Math.round(average(entries.map((entry) => entry.summary?.p95_latency_ms || 0))),
    peak_requests_last_minute: Math.max(...entries.map((entry) => entry.summary?.requests_last_minute || 0), 0)
  }));
}

function buildDecision(metrics) {
  const reasons = [];
  let recommendedAction = "observe";

  if ((metrics.maxDbQueryP95Ms || 0) > 200 || (metrics.maxHeldConnections || 0) > 20 || (metrics.maxPostgresBackends || 0) > 6) {
    recommendedAction = "fix-db-first";
    reasons.push("database latency or connection pressure rose before the app runtime looked saturated");
  }

  if ((metrics.maxAppP95Ms || 0) > 300 && (metrics.maxEventLoopUtilization || 0) > 0.5 && (metrics.maxDbQueryP95Ms || 0) <= 200) {
    recommendedAction = "scale-app-first";
    reasons.push("application latency rose together with runtime saturation while database pressure stayed controlled");
  }

  if ((metrics.maxAppErrorRatio || 0) > 0.05) {
    reasons.push("error budget burn is significant during the run");
  }

  if (!reasons.length) {
    reasons.push("the run stayed within the current learning thresholds");
  }

  return {
    recommended_action: recommendedAction,
    reasons
  };
}

function buildObservedPatterns(report) {
  const patterns = [];
  const finalSummary = report.final_summary || {};
  const prometheusSummary = report.prometheus_summary || {};

  if ((prometheusSummary.peak_db_query_p95_ms || 0) > 200) {
    patterns.push("DB latency spiked and became visible in the database health and capacity dashboards.");
  }
  if ((prometheusSummary.peak_app_error_ratio_percent || 0) > 5 || (finalSummary.error_rate_percent || 0) > 5) {
    patterns.push("Availability degraded enough to burn error budget and show up in the SLO dashboard.");
  }
  if ((prometheusSummary.peak_event_loop_utilization || 0) > 0.5) {
    patterns.push("Application runtime saturation increased enough to justify app-tier scaling discussion.");
  }
  if ((report.phase_summary || []).some((phase) => phase.avg_p95_latency_ms > 800)) {
    patterns.push("At least one phase produced a visible latency wall that should be easy to correlate in Grafana.");
  }

  if (!patterns.length) {
    patterns.push("The run stayed relatively healthy, so the main learning outcome is how normal behavior looks across the dashboards.");
  }

  return patterns;
}

function buildExpectedVsObserved(report) {
  const expected = Array.isArray(report.expected_signals) ? report.expected_signals : [];
  const observed = buildObservedPatterns(report);
  return {
    expected,
    observed,
    matched_expectations: expected.filter((item) => observed.some((line) => line.toLowerCase().includes(String(item).toLowerCase().split(" ")[0]))),
    gaps: expected.filter((item) => !observed.some((line) => line.toLowerCase().includes(String(item).toLowerCase().split(" ")[0])))
  };
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function buildMarkdownReport(report) {
  const lines = [
    `# Session Report`,
    ``,
    `- Scenario: ${report.scenario || "n/a"}`,
    `- Generated At: ${report.generated_at || "n/a"}`,
    `- Duration Minutes: ${report.duration_minutes || 0}`,
    `- Requests Triggered: ${report.requests_triggered || 0}`,
    `- Failures Observed: ${report.failures_observed || 0}`,
    `- Recommendation: ${report.decision?.recommended_action || "n/a"}`,
    ``,
    `## Final Summary`,
    ``,
    `- Success Rate: ${formatPercent(report.final_summary?.success_rate_percent || 0)}`,
    `- Error Rate: ${formatPercent(report.final_summary?.error_rate_percent || 0)}`,
    `- Average Latency: ${report.final_summary?.avg_latency_ms || 0} ms`,
    `- p95 Latency: ${report.final_summary?.p95_latency_ms || 0} ms`,
    `- Requests Last Minute: ${report.final_summary?.requests_last_minute || 0}`,
    ``
  ];

  if (report.prometheus_summary) {
    lines.push(`## Prometheus Summary`, ``);
    lines.push(`- Peak Throughput: ${report.prometheus_summary.peak_throughput_req_per_sec || 0} req/s`);
    lines.push(`- Peak App p95 Latency: ${report.prometheus_summary.peak_app_p95_latency_ms || 0} ms`);
    lines.push(`- Peak App Error Ratio: ${formatPercent(report.prometheus_summary.peak_app_error_ratio_percent || 0)}`);
    lines.push(`- Peak Event Loop Utilization: ${report.prometheus_summary.peak_event_loop_utilization || 0}`);
    lines.push(`- Peak DB Query p95: ${report.prometheus_summary.peak_db_query_p95_ms || 0} ms`);
    lines.push(`- Peak Postgres Backends: ${report.prometheus_summary.peak_postgres_backends || 0}`);
    lines.push(`- Peak Held Connections (1m): ${report.prometheus_summary.peak_held_connections_1m || 0}`, ``);
  }

  if (report.expected_vs_observed) {
    lines.push(`## Expected vs Observed`, ``);
    lines.push(`### Expected`, ...((report.expected_vs_observed.expected || []).map((item) => `- ${item}`) || ["- No expected patterns were captured."]), ``);
    lines.push(`### Observed`, ...((report.expected_vs_observed.observed || []).map((item) => `- ${item}`) || ["- No observed patterns were captured."]), ``);
  }

  if (report.phase_summary?.length) {
    lines.push(`## Phase Summary`, ``);
    for (const phase of report.phase_summary) {
      lines.push(`### ${phase.phase}`);
      lines.push(`- Samples: ${phase.samples}`);
      lines.push(`- Avg Success Rate: ${formatPercent(phase.avg_success_rate_percent || 0)}`);
      lines.push(`- Avg Error Rate: ${formatPercent(phase.avg_error_rate_percent || 0)}`);
      lines.push(`- Avg p95 Latency: ${phase.avg_p95_latency_ms || 0} ms`);
      lines.push(`- Peak Requests Last Minute: ${phase.peak_requests_last_minute || 0}`, ``);
    }
  }

  if (report.timeline?.length) {
    lines.push(`## Timeline`, ``);
    for (const event of report.timeline) {
      lines.push(`- ${event.timestamp || "n/a"}: ${event.title || event.type || "event"}`);
    }
    lines.push("");
  }

  if (report.decision?.reasons?.length) {
    lines.push(`## Decision`, ``);
    for (const reason of report.decision.reasons) {
      lines.push(`- ${reason}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlReport(report) {
  const phaseCards = (report.phase_summary || []).map((phase) => `
    <div class="card">
      <h3>${escapeHtml(phase.phase)}</h3>
      <p>Samples: ${phase.samples}</p>
      <p>Avg Success Rate: ${phase.avg_success_rate_percent || 0}%</p>
      <p>Avg Error Rate: ${phase.avg_error_rate_percent || 0}%</p>
      <p>Avg p95 Latency: ${phase.avg_p95_latency_ms || 0} ms</p>
      <p>Peak Requests Last Minute: ${phase.peak_requests_last_minute || 0}</p>
    </div>
  `).join("");

  const reasons = (report.decision?.reasons || []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("");
  const expected = (report.expected_vs_observed?.expected || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const observed = (report.expected_vs_observed?.observed || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const timeline = (report.timeline || []).map((event) => `<li>${escapeHtml(event.timestamp || "n/a")}: ${escapeHtml(event.title || event.type || "event")}</li>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Session Report</title>
    <style>
      body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; padding: 32px; color: #1f2a2e; background: #fffaf2; }
      h1, h2, h3 { margin-bottom: 8px; }
      .hero { border: 1px solid #d9c8b1; border-radius: 18px; padding: 24px; background: #fff; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 18px; }
      .card { border: 1px solid #d9c8b1; border-radius: 14px; padding: 16px; background: #fff; }
      .pill { display: inline-block; border: 1px solid #d9c8b1; border-radius: 999px; padding: 6px 10px; margin-right: 8px; margin-top: 8px; }
      ul { margin-top: 8px; }
    </style>
  </head>
  <body>
    <div class="hero">
      <h1>Session Report</h1>
      <p>Scenario: ${escapeHtml(report.scenario || "n/a")}</p>
      <p>Generated At: ${escapeHtml(report.generated_at || "n/a")}</p>
      <p>Duration: ${report.duration_minutes || 0} minutes</p>
      <div class="pill">Requests: ${report.requests_triggered || 0}</div>
      <div class="pill">Failures: ${report.failures_observed || 0}</div>
      <div class="pill">Recommendation: ${escapeHtml(report.decision?.recommended_action || "n/a")}</div>
    </div>
    <div class="grid">
      <div class="card"><h2>Final Summary</h2><p>Success Rate: ${report.final_summary?.success_rate_percent || 0}%</p><p>Error Rate: ${report.final_summary?.error_rate_percent || 0}%</p><p>Average Latency: ${report.final_summary?.avg_latency_ms || 0} ms</p><p>p95 Latency: ${report.final_summary?.p95_latency_ms || 0} ms</p></div>
      <div class="card"><h2>Prometheus Summary</h2><p>Peak Throughput: ${report.prometheus_summary?.peak_throughput_req_per_sec || 0} req/s</p><p>Peak App p95: ${report.prometheus_summary?.peak_app_p95_latency_ms || 0} ms</p><p>Peak DB p95: ${report.prometheus_summary?.peak_db_query_p95_ms || 0} ms</p><p>Peak Backends: ${report.prometheus_summary?.peak_postgres_backends || 0}</p></div>
      <div class="card"><h2>Expected</h2><ul>${expected || "<li>No expected patterns were captured.</li>"}</ul><h2>Observed</h2><ul>${observed || "<li>No observed patterns were captured.</li>"}</ul></div>
    </div>
    <h2>Phase Summary</h2>
    <div class="grid">${phaseCards || "<div class='card'><p>No phase summary available.</p></div>"}</div>
    <h2>Timeline</h2>
    <div class="card"><ul>${timeline || "<li>No timeline entries were recorded.</li>"}</ul></div>
    <h2>Decision</h2>
    <div class="card">
      <p>Recommended Action: ${escapeHtml(report.decision?.recommended_action || "n/a")}</p>
      <ul>${reasons || "<li>No decision reasons available.</li>"}</ul>
    </div>
  </body>
</html>`;
}

function safeStamp(value) {
  return String(value || new Date().toISOString()).replace(/[:.]/g, "-");
}

function persistSessionReport(report) {
  const stamp = safeStamp(report.generated_at || new Date().toISOString());
  const jsonPath = path.join(reportsDir, `session-report-${stamp}.json`);
  const markdownPath = path.join(reportsDir, `session-report-${stamp}.md`);
  const htmlPath = path.join(reportsDir, `session-report-${stamp}.html`);
  const latestJsonPath = path.join(reportsDir, "latest-session-report.json");
  const latestMarkdownPath = path.join(reportsDir, "latest-session-report.md");
  const latestHtmlPath = path.join(reportsDir, "latest-session-report.html");

  const jsonBody = JSON.stringify(report, null, 2);
  const markdownBody = buildMarkdownReport(report);
  const htmlBody = buildHtmlReport(report);

  fs.writeFileSync(jsonPath, jsonBody);
  fs.writeFileSync(markdownPath, markdownBody);
  fs.writeFileSync(htmlPath, htmlBody);
  fs.writeFileSync(latestJsonPath, jsonBody);
  fs.writeFileSync(latestMarkdownPath, markdownBody);
  fs.writeFileSync(latestHtmlPath, htmlBody);

  return {
    json: jsonPath,
    markdown: markdownPath,
    html: htmlPath
  };
}

function loadLatestSessionReportFromDisk() {
  const latestJsonPath = path.join(reportsDir, "latest-session-report.json");
  if (!fs.existsSync(latestJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(latestJsonPath, "utf8"));
  } catch (error) {
    log("error", "Failed to load persisted session report", { error: error.message, latestJsonPath });
    return null;
  }
}

function listPersistedReports() {
  if (!fs.existsSync(reportsDir)) {
    return [];
  }

  return fs.readdirSync(reportsDir)
    .filter((name) => /^session-report-.*\.(json|md|html)$/.test(name))
    .map((name) => {
      const fullPath = path.join(reportsDir, name);
      const stats = fs.statSync(fullPath);
      return {
        name,
        size_bytes: stats.size,
        updated_at: stats.mtime.toISOString(),
        url: `/reports/${encodeURIComponent(name)}`
      };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

async function getSignalSnapshot() {
  const [
    throughputReqPerSec,
    appP95Ms,
    appErrorRatio,
    dbQueryP95Ms,
    postgresBackends,
    heldConnections,
    eventLoopUtilization,
    circuitStateResponse
  ] = await Promise.all([
    queryPrometheus(`sum(rate(http_server_duration_milliseconds_count{exported_job="app-a"}[1m]))`),
    queryPrometheus(`histogram_quantile(0.95, sum(increase(http_server_duration_milliseconds_bucket{exported_job="app-a"}[5m])) by (le))`),
    queryPrometheus(`(sum(rate(demo_errors_total[5m])) or vector(0)) / clamp_min(sum(rate(demo_requests_total[5m])), 0.0001)`),
    queryPrometheus(`histogram_quantile(0.95, sum(increase(db_query_duration_ms_bucket[5m])) by (le))`),
    queryPrometheus(`pg_stat_database_numbackends{datname="srelab"}`),
    queryPrometheus(`sum(increase(db_pool_hold_total[5m]))`),
    queryPrometheus(`sum(nodejs_eventloop_utilization_ratio{exported_job="app-a"})`),
    fetch(`${downstreamBaseUrl}/api/resilience-state`).then((response) => response.json()).catch(() => null)
  ]);

  return {
    generated_at: new Date().toISOString(),
    cards: {
      throughput_rps: Number((throughputReqPerSec || 0).toFixed(2)),
      app_p95_ms: Math.round(appP95Ms || 0),
      error_ratio_percent: Math.round((appErrorRatio || 0) * 100),
      db_p95_ms: Math.round(dbQueryP95Ms || 0),
      postgres_backends: Math.round(postgresBackends || 0),
      held_connections_5m: Math.round(heldConnections || 0),
      event_loop_utilization: Number((eventLoopUtilization || 0).toFixed(3)),
      circuit_open: Boolean(circuitStateResponse?.is_open)
    },
    learning_prompt: (dbQueryP95Ms || 0) > 200
      ? "Database latency is elevated. Compare Database Health with Capacity Planning before scaling app containers."
      : (appP95Ms || 0) > 300
        ? "Application latency is elevated. Compare Golden Signals with the SLO dashboard to decide whether this is a user-facing issue."
        : "System looks healthy. Use a scenario preset to create a recognizable signal pattern."
  };
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

app.get("/reports", (req, res) => {
  const reports = listPersistedReports();
  const rows = reports.map((report) => `
    <tr>
      <td>${escapeHtml(report.name)}</td>
      <td>${report.size_bytes}</td>
      <td>${escapeHtml(report.updated_at)}</td>
      <td><a href="${report.url}" target="_blank" rel="noreferrer">Open</a></td>
    </tr>
  `).join("");

  res.type("text/html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Saved Reports</title>
    <style>
      body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; padding: 32px; background: #fffaf2; color: #1f2a2e; }
      h1 { margin-top: 0; }
      table { width: 100%; border-collapse: collapse; background: #fff; }
      th, td { border: 1px solid #d9c8b1; padding: 10px 12px; text-align: left; }
      th { background: #f0e2cf; }
      a { color: #2e6a63; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Saved Session Reports</h1>
    <p>These reports are persisted on disk and survive container restarts.</p>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Size (bytes)</th>
          <th>Updated At</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows || "<tr><td colspan='4'>No persisted reports yet.</td></tr>"}
      </tbody>
    </table>
  </body>
</html>`);
});

app.get("/reports/:name", (req, res) => {
  const requestedName = path.basename(req.params.name);
  const fullPath = path.join(reportsDir, requestedName);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).send("Report not found");
  }

  return res.sendFile(fullPath);
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

app.get("/api/signals", async (req, res) => {
  try {
    res.json(await getSignalSnapshot());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/lab/annotations", (req, res) => {
  res.json({ annotations: labAnnotations });
});

app.post("/api/lab/annotate", (req, res) => {
  const { type = "note", title = "Lab event", details = {} } = req.body || {};
  const annotation = addAnnotation(type, title, details);
  res.status(201).json(annotation);
});

app.post("/api/recovery/reset", async (req, res) => {
  const action = String(req.body?.action || "full");
  const results = [];

  if (action === "full" || action === "circuit") {
    try {
      const response = await fetch(`${downstreamBaseUrl}/api/resilience/reset-circuit`, { method: "POST" });
      results.push({ target: "app-b-circuit", ok: response.ok, body: await response.json() });
    } catch (error) {
      results.push({ target: "app-b-circuit", ok: false, error: error.message });
    }
  }

  const annotation = addAnnotation("recovery", "Recovery action triggered", { action, results });
  res.json({ action, results, annotation });
});

app.get("/api/session-report/latest", (req, res) => {
  if (!latestSessionReport) {
    return res.status(404).json({ error: "No generated session report yet" });
  }

  return res.json(latestSessionReport);
});

app.get("/api/session-report/latest/markdown", (req, res) => {
  if (!latestSessionReport) {
    return res.status(404).send("No generated session report yet");
  }

  res.type("text/markdown").send(buildMarkdownReport(latestSessionReport));
});

app.get("/api/session-report/latest/html", (req, res) => {
  if (!latestSessionReport) {
    return res.status(404).send("No generated session report yet");
  }

  res.type("text/html").send(buildHtmlReport(latestSessionReport));
});

app.post("/api/session-report", async (req, res) => {
  const report = req.body || {};
  const durationMinutes = Math.max(5, Number(report.duration_minutes || 15));
  const rangeWindow = `${durationMinutes}m:1m`;

  try {
    const [
      maxThroughputReqPerSec,
      maxAppP95Ms,
      maxAppErrorRatio,
      maxEventLoopUtilization,
      maxDbQueryP95Ms,
      maxPostgresBackends,
      maxHeldConnections
    ] = await Promise.all([
      queryPrometheus(`max_over_time(sum(rate(http_server_duration_milliseconds_count{exported_job="app-a"}[1m]))[${rangeWindow}])`),
      queryPrometheus(`max_over_time(histogram_quantile(0.95, sum(increase(http_server_duration_milliseconds_bucket{exported_job="app-a"}[1m])) by (le))[${rangeWindow}])`),
      queryPrometheus(`max_over_time(((sum(rate(demo_errors_total[1m])) or vector(0)) / clamp_min(sum(rate(demo_requests_total[1m])), 0.0001))[${rangeWindow}])`),
      queryPrometheus(`max_over_time(sum(nodejs_eventloop_utilization_ratio{exported_job="app-a"})[${rangeWindow}])`),
      queryPrometheus(`max_over_time(histogram_quantile(0.95, sum(increase(db_query_duration_ms_bucket[1m])) by (le))[${rangeWindow}])`),
      queryPrometheus(`max_over_time(pg_stat_database_numbackends{datname="srelab"}[${durationMinutes}m])`),
      queryPrometheus(`max_over_time(sum(increase(db_pool_hold_total[1m]))[${rangeWindow}])`)
    ]);

    const metrics = {
      maxThroughputReqPerSec: maxThroughputReqPerSec || 0,
      maxAppP95Ms: maxAppP95Ms || 0,
      maxAppErrorRatio: maxAppErrorRatio || 0,
      maxEventLoopUtilization: maxEventLoopUtilization || 0,
      maxDbQueryP95Ms: maxDbQueryP95Ms || 0,
      maxPostgresBackends: maxPostgresBackends || 0,
      maxHeldConnections: maxHeldConnections || 0
    };

    latestSessionReport = {
      ...report,
      generated_at: new Date().toISOString(),
      prometheus_summary: {
        peak_throughput_req_per_sec: Number(metrics.maxThroughputReqPerSec.toFixed(2)),
        peak_app_p95_latency_ms: Math.round(metrics.maxAppP95Ms),
        peak_app_error_ratio_percent: Math.round(metrics.maxAppErrorRatio * 100),
        peak_event_loop_utilization: Number(metrics.maxEventLoopUtilization.toFixed(3)),
        peak_db_query_p95_ms: Math.round(metrics.maxDbQueryP95Ms),
        peak_postgres_backends: Math.round(metrics.maxPostgresBackends),
        peak_held_connections_1m: Math.round(metrics.maxHeldConnections)
      },
      phase_summary: summarizeSamples(report.samples || []),
      decision: buildDecision(metrics),
      timeline: Array.isArray(report.timeline) ? report.timeline : [],
      expected_vs_observed: buildExpectedVsObserved({
        ...report,
        prometheus_summary: {
          peak_throughput_req_per_sec: Number(metrics.maxThroughputReqPerSec.toFixed(2)),
          peak_app_p95_latency_ms: Math.round(metrics.maxAppP95Ms),
          peak_app_error_ratio_percent: Math.round(metrics.maxAppErrorRatio * 100),
          peak_event_loop_utilization: Number(metrics.maxEventLoopUtilization.toFixed(3)),
          peak_db_query_p95_ms: Math.round(metrics.maxDbQueryP95Ms),
          peak_postgres_backends: Math.round(metrics.maxPostgresBackends),
          peak_held_connections_1m: Math.round(metrics.maxHeldConnections)
        },
        final_summary: report.final_summary || {},
        phase_summary: summarizeSamples(report.samples || [])
      })
    };
    latestSessionReport.files = persistSessionReport(latestSessionReport);

    res.json(latestSessionReport);
  } catch (error) {
    log("error", "Failed to generate session report", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/demo", async (req, res) => {
  const startHr = process.hrtime.bigint();
  const latencyMs = Number(req.query.latencyMs || 0);
  const dependencyLatencyMs = Number(req.query.dependencyLatencyMs || latencyMs || 0);
  const dbDelayMs = Number(req.query.dbDelayMs || 0);
  const dbHoldMs = Number(req.query.dbHoldMs || 0);
  const dbFailureMode = String(req.query.dbFailureMode || "none");
  const timeoutMs = Number(req.query.timeoutMs || 0);
  const retryCount = Number(req.query.retryCount || 0);
  const fallbackMode = String(req.query.fallbackMode || "none");
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
      const url = `${downstreamUrl}?items=${items}&latencyMs=${latencyMs}&dependencyLatencyMs=${dependencyLatencyMs}&dbDelayMs=${dbDelayMs}&dbHoldMs=${dbHoldMs}&dbFailureMode=${encodeURIComponent(dbFailureMode)}&timeoutMs=${timeoutMs}&retryCount=${retryCount}&fallbackMode=${encodeURIComponent(fallbackMode)}&failureRate=${failureRate}`;
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
      items,
      timeout_ms: timeoutMs,
      retry_count: retryCount,
      fallback_mode: fallbackMode
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
      error: error.message,
      timeout_ms: timeoutMs,
      retry_count: retryCount,
      fallback_mode: fallbackMode
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
  latestSessionReport = loadLatestSessionReportFromDisk();
  addAnnotation("startup", "Lab UI started", { port, downstreamUrl, prometheusUrl, grafanaUrl });
  log("info", "Service started", { port, downstreamUrl, prometheusUrl, grafanaUrl });
});

