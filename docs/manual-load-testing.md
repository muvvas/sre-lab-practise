# Manual Load Testing Guide

This guide explains how to run exact terminal-driven load tests against the lab, especially fixed-rate traffic like `100 req/sec`.

## When To Use The Browser UI vs k6

Use the browser UI when you want to:

- pick a learning scenario
- change latency, failure, or resilience settings manually
- watch how dashboards react to a few requests or a small burst

Use `k6` when you want to:

- generate exact request rates such as `100 req/sec`
- run for a fixed duration
- compare repeatable load-test results
- study capacity or SLO behavior under controlled pressure

## Run From Your Local Repo Folder

Run commands from the root of this repository.

PowerShell example:

```powershell
cd path\to\sre-lab-practise
```

Bash example:

```bash
cd /path/to/sre-lab-practise
```

## Quick Cheatsheet

If you just want copy-paste commands, start here:

- [docs/load-testing-cheatsheet.md](C:/Users/smuvva/Documents/sre-lab-practise/docs/load-testing-cheatsheet.md)

## Fixed-Rate 100 req/sec Examples

### Baseline for 1 Minute

PowerShell:

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=baseline --env RATE=100 --env DURATION=1m
```

Bash:

```bash
docker run --rm -i -v "$(pwd)/load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=baseline --env RATE=100 --env DURATION=1m
```

### Retry Storm for 1 Minute

PowerShell:

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=retry-storm --env RATE=100 --env DURATION=1m
```

Bash:

```bash
docker run --rm -i -v "$(pwd)/load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=retry-storm --env RATE=100 --env DURATION=1m
```

### DB Saturation for 1 Minute

PowerShell:

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=db-saturation --env RATE=100 --env DURATION=1m
```

Bash:

```bash
docker run --rm -i -v "$(pwd)/load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=db-saturation --env RATE=100 --env DURATION=1m
```

### Stress Blend for 1 Minute

PowerShell:

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=stress --env RATE=100 --env DURATION=1m
```

Bash:

```bash
docker run --rm -i -v "$(pwd)/load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=stress --env RATE=100 --env DURATION=1m
```

## Custom Fixed-Rate Run

If you do not want to use a preset, pass explicit values:

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=baseline --env RATE=100 --env DURATION=1m --env ITEMS=2 --env LATENCY_MS=40 --env DEPENDENCY_LATENCY_MS=30 --env CPU_MS=5 --env DB_DELAY_MS=0 --env DB_HOLD_MS=0 --env DB_FAILURE_MODE=none --env FAILURE_RATE=0 --env TIMEOUT_MS=800 --env RETRY_COUNT=1 --env FALLBACK_MODE=none
```

## Useful Variations

### Run for 5 Minutes

```powershell
... --env RATE=100 --env DURATION=5m
```

### Run 50 req/sec

```powershell
... --env RATE=50 --env DURATION=1m
```

### Increase VU Headroom

```powershell
... --env RATE=100 --env DURATION=1m --env PREALLOCATED_VUS=150 --env MAX_VUS=300
```

## What To Watch While It Runs

Open these while the test is running:

- Grafana Golden Signals: [http://localhost:3000/d/sre-golden-signals/sre-golden-signals](http://localhost:3000/d/sre-golden-signals/sre-golden-signals)
- Capacity Planning: [http://localhost:3000/d/capacity-planning/capacity-planning](http://localhost:3000/d/capacity-planning/capacity-planning)
- SLO and Error Budget: [http://localhost:3000/d/slo-error-budget/slo-and-error-budget](http://localhost:3000/d/slo-error-budget/slo-and-error-budget)
- Database Health: [http://localhost:3000/d/database-health/database-health](http://localhost:3000/d/database-health/database-health)
- Jaeger: [http://localhost:16686](http://localhost:16686)
- Dozzle: [http://localhost:8080](http://localhost:8080)

## Quick Interpretation Tips

- High app p95 and high event-loop pressure with healthy DB metrics usually means app-tier scale or tuning is needed.
- High DB p95, rising held connections, and elevated Postgres backends usually means fix or scale the DB tier first.
- Rising error ratio means you are burning error budget, even if throughput looks modest.

## Notes

- The browser UI is for interactive learning, not precise fixed-rate load generation.
- `k6` is the correct tool for exact `req/sec` targets.
- For failure-heavy presets such as `retry-storm`, `partial-outage`, or `circuit-open`, `k6` may show `http_req_failed` because HTTP `500` or `503` still count as failed requests in its summary. That is expected in those scenarios.
- The lab supports both presets and custom parameter overrides through the same `sre-demo.js` script.
