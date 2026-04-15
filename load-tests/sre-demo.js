import http from "k6/http";
import { check, sleep } from "k6";

const scenario = __ENV.SCENARIO || "baseline";
const baseUrl = __ENV.BASE_URL || "http://localhost:3001";
const quick = __ENV.QUICK === "1";
const fixedRate = Number(__ENV.RATE || 100);
const fixedDuration = __ENV.DURATION || "1m";
const preAllocatedVUs = Number(__ENV.PREALLOCATED_VUS || 120);
const maxVUs = Number(__ENV.MAX_VUS || 200);

function stagesFor(normalStages, quickStages) {
  return quick ? quickStages : normalStages;
}

const requestDefaults = {
  baseline: {
    items: "2",
    latencyMs: "40",
    dependencyLatencyMs: "30",
    cpuMs: "5",
    dbDelayMs: "0",
    dbHoldMs: "0",
    dbFailureMode: "none",
    failureRate: "0",
    timeoutMs: "800",
    retryCount: "1",
    fallbackMode: "none"
  },
  latency: {
    items: "2",
    latencyMs: "170",
    dependencyLatencyMs: "220",
    cpuMs: "20",
    dbDelayMs: "90",
    dbHoldMs: "0",
    dbFailureMode: "none",
    failureRate: "0",
    timeoutMs: "800",
    retryCount: "1",
    fallbackMode: "none"
  },
  errors: {
    items: "2",
    latencyMs: "60",
    dependencyLatencyMs: "60",
    cpuMs: "5",
    dbDelayMs: "0",
    dbHoldMs: "0",
    dbFailureMode: "none",
    failureRate: "0.25",
    timeoutMs: "800",
    retryCount: "1",
    fallbackMode: "none"
  },
  stress: {
    items: "3",
    latencyMs: "120",
    dependencyLatencyMs: "160",
    cpuMs: "80",
    dbDelayMs: "250",
    dbHoldMs: "180",
    dbFailureMode: "none",
    failureRate: "0.05",
    timeoutMs: "800",
    retryCount: "1",
    fallbackMode: "none"
  },
  "db-saturation": {
    items: "3",
    latencyMs: "40",
    dependencyLatencyMs: "40",
    cpuMs: "5",
    dbDelayMs: "250",
    dbHoldMs: "1200",
    dbFailureMode: "none",
    failureRate: "0",
    timeoutMs: "500",
    retryCount: "1",
    fallbackMode: "none"
  },
  "partial-outage": {
    items: "2",
    latencyMs: "20",
    dependencyLatencyMs: "20",
    cpuMs: "5",
    dbDelayMs: "0",
    dbHoldMs: "1000",
    dbFailureMode: "after-hold",
    failureRate: "0.25",
    timeoutMs: "500",
    retryCount: "0",
    fallbackMode: "none"
  },
  "retry-storm": {
    items: "2",
    latencyMs: "30",
    dependencyLatencyMs: "40",
    cpuMs: "10",
    dbDelayMs: "0",
    dbHoldMs: "1600",
    dbFailureMode: "none",
    failureRate: "0.05",
    timeoutMs: "250",
    retryCount: "3",
    fallbackMode: "none"
  },
  "circuit-open": {
    items: "2",
    latencyMs: "20",
    dependencyLatencyMs: "20",
    cpuMs: "5",
    dbDelayMs: "0",
    dbHoldMs: "1800",
    dbFailureMode: "after-hold",
    failureRate: "0",
    timeoutMs: "220",
    retryCount: "2",
    fallbackMode: "stub"
  },
  "timeout-chaos": {
    items: "2",
    latencyMs: "25",
    dependencyLatencyMs: "40",
    cpuMs: "5",
    dbDelayMs: "0",
    dbHoldMs: "1400",
    dbFailureMode: "none",
    failureRate: "0",
    timeoutMs: "250",
    retryCount: "1",
    fallbackMode: "stub"
  }
};

const scenarioConfigs = {
  baseline: {
    executor: "ramping-vus",
    exec: "baseline",
    stages: stagesFor([
      { duration: "30s", target: 5 },
      { duration: "1m", target: 10 },
      { duration: "30s", target: 0 }
    ], [
      { duration: "5s", target: 2 },
      { duration: "10s", target: 3 },
      { duration: "5s", target: 0 }
    ])
  },
  latency: {
    executor: "ramping-vus",
    exec: "latency",
    stages: stagesFor([
      { duration: "30s", target: 5 },
      { duration: "1m", target: 15 },
      { duration: "30s", target: 0 }
    ], [
      { duration: "5s", target: 2 },
      { duration: "10s", target: 4 },
      { duration: "5s", target: 0 }
    ])
  },
  errors: {
    executor: "ramping-vus",
    exec: "errors",
    stages: stagesFor([
      { duration: "30s", target: 5 },
      { duration: "1m", target: 10 },
      { duration: "30s", target: 0 }
    ], [
      { duration: "5s", target: 2 },
      { duration: "10s", target: 3 },
      { duration: "5s", target: 0 }
    ])
  },
  stress: {
    executor: "ramping-vus",
    exec: "stress",
    stages: stagesFor([
      { duration: "30s", target: 10 },
      { duration: "1m", target: 30 },
      { duration: "1m", target: 50 },
      { duration: "30s", target: 0 }
    ], [
      { duration: "5s", target: 5 },
      { duration: "10s", target: 10 },
      { duration: "10s", target: 15 },
      { duration: "5s", target: 0 }
    ])
  },
  fixed: {
    executor: "constant-arrival-rate",
    exec: "fixed",
    rate: fixedRate,
    timeUnit: "1s",
    duration: fixedDuration,
    preAllocatedVUs,
    maxVUs
  }
};

export const options = {
  scenarios: {
    [scenario]: scenarioConfigs[scenario] || scenarioConfigs.baseline
  }
};

function requestParams(defaultPreset) {
  const preset = requestDefaults[defaultPreset] || requestDefaults.baseline;
  return {
    items: __ENV.ITEMS || preset.items,
    latencyMs: __ENV.LATENCY_MS || preset.latencyMs,
    dependencyLatencyMs: __ENV.DEPENDENCY_LATENCY_MS || preset.dependencyLatencyMs,
    cpuMs: __ENV.CPU_MS || preset.cpuMs,
    dbDelayMs: __ENV.DB_DELAY_MS || preset.dbDelayMs,
    dbHoldMs: __ENV.DB_HOLD_MS || preset.dbHoldMs,
    dbFailureMode: __ENV.DB_FAILURE_MODE || preset.dbFailureMode,
    failureRate: __ENV.FAILURE_RATE || preset.failureRate,
    timeoutMs: __ENV.TIMEOUT_MS || preset.timeoutMs,
    retryCount: __ENV.RETRY_COUNT || preset.retryCount,
    fallbackMode: __ENV.FALLBACK_MODE || preset.fallbackMode
  };
}

function runRequest(params) {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const response = http.get(`${baseUrl}/api/demo?${query}`);

  check(response, {
    "status is acceptable": (r) => r.status === 200 || r.status === 500 || r.status === 503
  });

  if (scenario !== "fixed") {
    sleep(1);
  }
}

export function baseline() {
  runRequest(requestParams("baseline"));
}

export function latency() {
  runRequest(requestParams("latency"));
}

export function errors() {
  runRequest(requestParams("errors"));
}

export function stress() {
  runRequest(requestParams("stress"));
}

export function fixed() {
  runRequest(requestParams(__ENV.PRESET || "baseline"));
}
