# 15-Minute Capacity Exercise

This guide explains exactly how to reproduce the 15-minute capacity test, what happened during the run, and how to read the dashboards.

## Important Clarification

The traffic generation can be automatic.

- The browser `Scheduled Runner` can generate traffic automatically.
- A `k6` script can also generate traffic automatically for a fixed duration.

The interpretation step is not fully automatic yet.

- Prometheus and Grafana collect the data automatically.
- The dashboards show the trends automatically.
- A human still needs to interpret the result and decide whether the bottleneck is the app tier or the database tier.

If you want later, we can add an automated summary job or a generated post-run report that pulls Prometheus values and writes a final recommendation.

## What Was Run

We ran a 15-minute phased load test against:

- `app-a -> app-b -> app-c -> postgres`

The test changed behavior every 2.5 minutes:

1. `Baseline`
2. `Latency`
3. `Slow DB`
4. `Errors`
5. `Pool Stress`
6. `Stress`

The load level also ramped up during the full 15-minute window.

## Why The RPS Looks Low

The throughput panel can look lower than expected, and that is correct for this lab.

Reasons:

- The traffic is intentionally slow in several phases.
- Some requests include added sleep and DB hold time.
- Some requests fail after waiting, which still consumes capacity.
- The dashboard uses a smoothed Prometheus rate window, so it shows sustained throughput rather than raw burst counts.

In other words:

- low `req/s` does not mean the test is light
- a small number of slow or blocked requests can still saturate the system

This is exactly what happened in the 15-minute test.

## What Happened During The 15 Minutes

### 1. Baseline

- Healthy requests
- Low latency
- No meaningful errors
- Low DB pressure

### 2. Latency

- Added app and dependency latency
- Throughput started rising, but latency rose too
- This tested whether the app path could tolerate slower dependencies

### 3. Slow DB

- `app-c` added DB delay
- DB query p95 climbed sharply
- End-to-end latency rose even though app runtime saturation stayed low

### 4. Errors

- Controlled error injection increased failed requests
- Error ratio panels began climbing
- This shows error-budget burn behavior

### 5. Pool Stress

- DB hold time increased
- Requests held DB connections longer
- DB saturation signals rose
- This is where the database became the clearest bottleneck

### 6. Stress

- High combined latency, DB delay, hold time, CPU, and some failure injection
- p95 latency spiked hard
- Errors remained elevated
- Throughput stopped translating into healthy completions

## What We Observed In One Real Run

Sample observations from the 15-minute run:

- average throughput over the whole run: about `5.19 req/s`
- peak `app-a` throughput from Prometheus: about `15.12 req/s`
- app-a recent success rate near the end: about `81.67%`
- app-a recent p95 latency near the end: about `16520 ms`
- max app-a error ratio during the run: about `46.6%`
- DB query p95 peaked around the top of the current histogram range
- Postgres backends rose above the quiet baseline
- held DB connections rose sharply during pool stress
- event loop utilization stayed relatively low

Interpretation:

- the app tier was not the first bottleneck
- the database path was the first bottleneck

## How To Reproduce

### Option 1: Browser Demo

1. Open [http://localhost:3001](http://localhost:3001)
2. Go to `Scheduled Runner`
3. Set `Run Time` to `15`
4. Pick `Guided Mix`
5. Start the session
6. Watch Grafana for the next 15 minutes
7. Stop if needed and export the session report

### Option 2: k6

You can reproduce fixed-rate traffic with the existing `load-tests/sre-demo.js` script.

See the exact commands here:

- [manual-load-testing.md](C:/Users/smuvva/Documents/sre-lab-practise/docs/manual-load-testing.md)

For a full guided 15-minute phased `k6` script, we can add a dedicated file later if you want a one-command replay of the complete exercise.

## Which Dashboards To Watch

### Capacity Planning

Open:

- [http://localhost:3000/d/capacity-planning/capacity-planning](http://localhost:3000/d/capacity-planning/capacity-planning)

Panels:

- `Throughput by Service`
  - sustained requests per second
  - this is smoothed throughput, not raw burst count
- `p95 Latency by Service (5m)`
  - rising latency means the service is losing headroom
  - if p95 rises sharply while throughput growth flattens, you are near or beyond capacity
- `Error Ratio by Tier`
  - shows where failure starts first
  - if app-a error ratio rises because app-c or DB is unhealthy, scaling app-a alone will not fix it
- `Event Loop Utilization`
  - helps detect Node saturation
  - low values usually mean Node is not the first bottleneck
- `DB Query p95 (5m)`
  - key signal for database stress
  - sharp rise here means the DB layer is becoming a constraint
- `DB Saturation Signals`
  - `postgres backends`: how many backend sessions are active
  - `held connections`: how often requests are holding pool connections longer

### Database Health

Open:

- [http://localhost:3000/d/database-health/database-health](http://localhost:3000/d/database-health/database-health)

Use this to verify whether DB latency, active backends, or query pressure is the main reason for end-to-end slowdown.

### SRE Golden Signals

Open:

- [http://localhost:3000/d/sre-golden-signals/sre-golden-signals](http://localhost:3000/d/sre-golden-signals/sre-golden-signals)

Use this for:

- request rate
- latency
- error ratio
- runtime pressure

### SLO and Error Budget

Open:

- [http://localhost:3000/d/slo-error-budget/slo-and-error-budget](http://localhost:3000/d/slo-error-budget/slo-and-error-budget)

Use this to see how quickly the slow and failing phases burn budget.

### Jaeger

Open:

- [http://localhost:16686](http://localhost:16686)

Use this to confirm whether time is being spent in:

- `app-a`
- `app-b`
- `app-c`
- DB-related work behind `app-c`

### Dozzle

Open:

- [http://localhost:8080](http://localhost:8080)

Use this to inspect live logs while the test runs.

## How To Decide Whether To Scale

Scale the app tier first only when:

- app p95 latency is rising
- app error rate is rising
- app event loop or CPU pressure is also high
- DB latency still looks healthy

Fix or scale the DB tier first when:

- DB query p95 rises sharply
- held DB connections increase repeatedly
- Postgres backends rise
- app event loop utilization stays low

## Starter Thresholds For This Lab

These are learning thresholds, not production standards.

### App-tier scale candidate

- app p95 latency stays above `300 ms`
- error ratio stays above `1%`
- event loop utilization stays high for several minutes
- DB signals remain healthy

### DB-tier tune or scale candidate

- DB query p95 rises above about `100-200 ms` and keeps climbing
- DB saturation signals rise with load
- app runtime saturation remains low

## Why This Matters

This lab teaches a key SRE lesson:

- you do not scale just because traffic exists
- you scale the component that is actually saturating

In this run, the database path saturated before Node did.
