# SLO Dashboard Guide

## What This Dashboard Measures

The `SLO and Error Budget` dashboard focuses on the user-facing endpoint:

- `app-a /api/demo`

It uses these learning-lab targets:

- Availability SLO: `99%`
- Latency SLO: `95%` of requests complete within `300 ms`

## Panels Included

### Availability SLI (5m)

Shows the recent success ratio:

- `1 - error_rate`

This is a short-window operational view.

### Latency SLI <= 300 ms (5m)

Shows the share of recent requests that completed within 300 ms.

### Error Budget Remaining

Shows how much of the allowed failure budget is still left in the selected short window.

Important:

- This is a local-learning approximation, not a full production-grade 30-day compliance model
- It is useful for understanding the concept of budget consumption and burn rate

### Burn Rate

Burn rate tells you how quickly you are spending the allowed error budget.

Examples:

- Burn rate `1` means you are consuming budget exactly at the allowed pace
- Burn rate `2` means twice as fast as allowed
- Burn rate below `1` means you are within the target pace

## Why We Use Short Windows Here

In a local lab, traffic is bursty and short-lived. A true 30-day SLO dashboard is less useful in a learning environment unless you keep the lab running continuously.

So this dashboard uses short windows to help you quickly see:

- what happens when errors rise
- how latency SLOs fail
- how budget gets consumed under load

## Best Experiments

### Availability Burn

Run:

```powershell
curl "http://localhost:3001/api/demo?failureRate=0.2"
```

Or:

```powershell
k6 run --env SCENARIO=errors .\load-tests\sre-demo.js
```

Or run an exact fixed-rate test from PowerShell:

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=errors --env RATE=100 --env DURATION=1m
```

### Latency SLO Violation

Run:

```powershell
curl "http://localhost:3001/api/demo?latencyMs=150&dependencyLatencyMs=200"
```

Or:

```powershell
k6 run --env SCENARIO=latency .\load-tests\sre-demo.js
```

Or run an exact fixed-rate test from PowerShell:

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=latency --env RATE=100 --env DURATION=1m
```

### Capacity Stress

Run:

```powershell
k6 run --env SCENARIO=stress .\load-tests\sre-demo.js
```

Or run an exact fixed-rate test from PowerShell:

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=stress --env RATE=100 --env DURATION=1m
```

For more fixed-rate variations, see [docs/manual-load-testing.md](C:/Users/smuvva/Documents/sre-lab-practise/docs/manual-load-testing.md).

Then compare:

- golden signals dashboard
- service dependency dashboard
- SLO and error budget dashboard
