import http from "k6/http";
import { check, sleep } from "k6";

const scenario = __ENV.SCENARIO || "baseline";
const baseUrl = __ENV.BASE_URL || "http://localhost:3001";
const quick = __ENV.QUICK === "1";

function stagesFor(normalStages, quickStages) {
  return quick ? quickStages : normalStages;
}

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
  }
};

export const options = {
  scenarios: {
    [scenario]: scenarioConfigs[scenario] || {
      executor: "ramping-vus",
      exec: "baseline",
      stages: [
        { duration: "30s", target: 5 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 0 }
      ]
    }
  }
};

function runRequest(params) {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const response = http.get(`${baseUrl}/api/demo?${query}`);

  check(response, {
    "status is acceptable": (r) => r.status === 200 || r.status === 500 || r.status === 503
  });

  sleep(1);
}

export function baseline() {
  runRequest({
    items: "2",
    latencyMs: "40",
    dependencyLatencyMs: "30",
    cpuMs: "10",
    failureRate: "0"
  });
}

export function latency() {
  runRequest({
    items: "5",
    latencyMs: "120",
    dependencyLatencyMs: "180",
    cpuMs: "25",
    failureRate: "0"
  });
}

export function errors() {
  runRequest({
    items: "3",
    latencyMs: "50",
    dependencyLatencyMs: "60",
    cpuMs: "5",
    failureRate: "0.2"
  });
}

export function stress() {
  runRequest({
    items: "8",
    latencyMs: "100",
    dependencyLatencyMs: "140",
    cpuMs: "60",
    failureRate: "0.05"
  });
}
