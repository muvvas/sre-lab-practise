# Dashboard and Panel Guide

This document explains each dashboard and what the panels are telling you.

## 1. SRE Golden Signals

### Traffic by Service

Meaning:

- requests per second by service

Healthy pattern:

- steady and predictable

Warning pattern:

- rising traffic with rising latency or errors

### App-A Error Ratio

Meaning:

- proportion of failed app-a requests

Healthy pattern:

- near zero

Warning pattern:

- sustained non-zero error ratio

### p95 Latency by Service

Meaning:

- tail latency for app-a, app-b, and app-c

Healthy pattern:

- stable and within your learning target

Warning pattern:

- sharp rise in one service before the others

### Event Loop Utilization

Meaning:

- Node runtime pressure

Healthy pattern:

- low to moderate

Warning pattern:

- consistently high values under load

### Heap Used

Meaning:

- memory usage in Node processes

Healthy pattern:

- controlled and stable

Warning pattern:

- sustained growth without settling

### Dependency Error Ratio

Meaning:

- failure ratio in app-b and app-c

Healthy pattern:

- near zero

Warning pattern:

- dependency tiers failing before app-a

### Traffic by Service (1m Short Test)

Meaning:

- short-window request rate for exact tests such as `1 minute` `k6` runs

Healthy pattern:

- should closely match the current fixed-rate load test

Warning pattern:

- much lower than the intended rate means the service cannot sustain the requested traffic

### p95 Latency by Service (1m Short Test)

Meaning:

- one-minute p95 latency view for short controlled tests

### p99 Latency by Service (1m Short Test)

Meaning:

- one-minute p99 latency view to expose tail spikes that p95 can hide

### App-A Error Ratio (1m Short Test)

Meaning:

- short-window app-a error ratio for exact fixed-rate tests


## 2. SLO and Error Budget

### Availability SLI (5m)

Meaning:

- recent success ratio

### Latency SLI <= 300 ms (5m)

Meaning:

- percentage of app-a requests meeting the latency threshold

### Error Budget Remaining (1h Window)

Meaning:

- how much budget remains in the learning window

### Error Budget Burn Rate (5m)

Meaning:

- how quickly the system is spending the allowed failure budget

### Availability SLI vs SLO

Meaning:

- compares measured availability against target

### Latency SLI vs SLO

Meaning:

- compares measured latency compliance against target

### Short vs Longer Burn Rate

Meaning:

- compares recent and longer-window burn speed

### Remaining Error Budget

Meaning:

- budget left across short and longer windows

## 3. Service Dependency Overview

### Prometheus Scrape Health

Meaning:

- whether metrics scraping is healthy

### Service p95 Latency Chain

Meaning:

- p95 latency across app-a, app-b, and app-c

### Recent Service Logs

Meaning:

- structured recent logs from Loki

### Trace Search Handoff

Meaning:

- direct handoff to Jaeger or Explore for traces

### Recent Trace-Producing Requests

Meaning:

- recent request volume across the services

## 4. Database Health

### Postgres Exporter Up

Meaning:

- whether the exporter is reachable

### App-C DB Query p95

Meaning:

- DB latency seen by app-c

### App-C DB Query Volume

Meaning:

- DB query and DB error volume

### Postgres Backends

Meaning:

- active backend sessions in Postgres

### Postgres Commit Rate

Meaning:

- transaction activity level

## 5. Capacity Planning

### Throughput by Service

Meaning:

- sustained request rate by service

### p95 Latency by Service (5m)

Meaning:

- recent tail latency across services

### Error Ratio by Tier

Meaning:

- where failure is starting first

### Event Loop Utilization

Meaning:

- whether Node runtime pressure is the first constraint

### DB Query p95 (5m)

Meaning:

- database latency signal for capacity decisions

### DB Saturation Signals

Meaning:

- Postgres backends plus held DB connections

Interpretation:

- if these rise before app runtime saturation, the DB path is the bottleneck

### Throughput by Service (1m Short Test)

Meaning:

- one-minute throughput view for validating short exact-rate tests

### p95 Latency by Service (1m Short Test)

Meaning:

- one-minute p95 latency during short tests

### p99 Latency by Service (1m Short Test)

Meaning:

- one-minute p99 latency during short tests

### DB Query p95 (1m Short Test)

Meaning:

- one-minute database latency view for short tests where the `5m` window would dilute the result

## 6. Alerting and Runbook

### Latency Alert Condition

Meaning:

- whether the app latency alert expression is currently true

### Error Budget Burn Condition

Meaning:

- whether fast burn is currently happening

### DB Latency Alert Condition

Meaning:

- whether DB latency is beyond the learning threshold

### Resilience Activity Condition

Meaning:

- whether fallbacks or circuit breaker actions are active

### Alert Context Latency

Meaning:

- shows app and DB latency alongside alert conditions

### Alert Context Error Burn

Meaning:

- shows current error-burn context

### Alert Context DB Pressure

Meaning:

- shows DB pressure context for investigation

### Runbook Summary

Meaning:

- compact investigation flow to follow during incidents
