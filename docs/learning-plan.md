# Learning Plan

## Goal

Build one small application system and use it to learn how SRE practices work in real life, not only in theory.

## Why This Lab Uses Three Apps

A single app helps with metrics and logs, but multiple apps help you learn:

- Distributed tracing
- Dependency latency
- Cascading failures
- Upstream vs downstream SLIs
- Timeout and retry behavior
- Critical path analysis across services

## Core Topics In This Project

### 1. Golden Signals

- Latency: How long requests take
- Traffic: How many requests come in
- Errors: How many requests fail
- Saturation: How close the system is to its limits

### 2. SLI / SLO / Error Budget

- SLI: the measured indicator, such as success rate or p95 latency
- SLO: the target, such as 99% success in 30 days
- Error budget: the allowed amount of failure before reliability work must take priority

### 3. Observability

- Metrics answer "how much" and "how often"
- Logs answer "what happened"
- Traces answer "where time was spent across services"

### 4. Capacity Planning

- Measure current behavior under load
- Find a bottleneck
- Estimate headroom
- Decide scale-up or optimization actions

## Lab Exercises

### Exercise 1: Healthy Baseline

- Start the stack
- Send a few requests to `app-a`
- Confirm metrics, logs, and traces are visible

### Exercise 2: Latency Investigation

- Call `app-a` with `latencyMs=200`
- Compare p50 vs p95 latency
- Check whether trace spans clearly show the delay

### Exercise 3: Error Budget Consumption

- Call `app-a` with `failureRate=0.2`
- Observe the service success rate
- Estimate how fast the error budget burns

### Exercise 4: Dependency Failure

- Inject failures into `app-b`
- Inject latency into `app-c`
- Observe how `app-a` behaves
- Identify whether the user-facing SLI is still acceptable

### Exercise 5: Capacity Planning

- Gradually increase request volume
- Record throughput, latency, and failure rate
- Estimate a safe operating range

## Suggested Phase 2 Improvements

- Add dashboards
- Add alert rules
- Add synthetic checks
- Add retry and timeout tuning
- Add a database
- Add Postgres and instrument queries
- Add queue workers
- Add autoscaling simulations
