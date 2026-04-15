# Incident Runbook

This runbook is for the local SRE learning lab and is designed to guide investigation during demos, load tests, and interview practice.

## 1. First Questions

When a dashboard looks bad, ask:

- Is this a user-facing issue or only an internal symptom?
- Is the problem latency, errors, saturation, or a combination?
- Did the problem begin in the app tier or in the database tier?
- Are resilience patterns hiding the failure or reducing impact?

## 2. First Dashboard Checks

### Step 1: SRE Golden Signals

Check:

- traffic trend
- latency trend
- error ratio
- runtime saturation

Goal:

- confirm whether the issue is real and user-visible

### Step 2: Capacity Planning

Check:

- throughput by service
- p95 latency by service
- error ratio by tier
- event loop utilization
- DB query p95
- DB saturation signals

Goal:

- identify what is saturating first

### Step 3: Database Health

Check:

- Postgres backends
- DB query volume
- DB query p95

Goal:

- decide whether the DB is the likely bottleneck

### Step 4: SLO and Error Budget

Check:

- availability SLI
- latency SLI
- remaining budget
- burn rate

Goal:

- estimate urgency and business impact

## 3. Logs and Traces

### Logs

Use:

- Grafana Explore with Loki
- Dozzle for live container logs

Look for:

- timeout errors
- downstream failures
- fallback messages
- circuit-breaker warnings

### Traces

Use:

- Jaeger
- Grafana Explore with Tempo

Look for:

- which span dominates end-to-end latency
- whether latency is in app-a, app-b, app-c, or DB-facing work

## 4. Decision Guide

### Scale App First

Likely when:

- app latency is high
- app errors rise
- event loop utilization is high
- DB metrics still look healthy

### Fix DB First

Likely when:

- DB query p95 rises sharply
- Postgres backends rise
- held connections rise
- app runtime saturation stays low

### Use Resilience Patterns

Consider:

- reducing timeout values
- limiting retries
- enabling graceful fallback
- letting the circuit breaker protect the dependency

## 5. Mitigation Checklist

1. Confirm user-visible impact.
2. Check which tier shows the first meaningful degradation.
3. Verify with logs and traces.
4. Choose mitigation:
   - scale app
   - tune DB
   - reduce load
   - enable fallback behavior
5. Watch whether the error budget burn slows down.
6. Record what changed and what worked.

## 6. After The Incident

Capture:

- symptom
- start time
- affected signal
- likely root cause
- mitigation used
- long-term follow-up

Examples of long-term follow-up:

- optimize query latency
- tune connection pool behavior
- add or refine alerts
- add better fallback data
- reduce retry amplification
