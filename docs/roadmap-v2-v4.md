# Roadmap V2 to V4

This roadmap shows how to evolve the current SRE learning lab into a deeper, more production-like reliability playground.

## V2: Stronger SRE Workflow Lab

Goal:

- make the lab better for day-to-day SRE practice
- improve alerting, investigation flow, and guided learning

Recommended additions:

1. Alertmanager integration
2. Synthetic monitoring checks
3. Grafana annotations for scenario changes
4. Runbook links directly from alert descriptions
5. Session history dashboard for saved reports

What this teaches:

- alert lifecycle
- signal to response workflow
- incident triage basics
- dashboard and timeline correlation

Expected outcome:

- the lab becomes much closer to a real on-call learning environment

## V3: Production-Like Reliability Lab

Goal:

- model realistic scaling, dependency, and degradation behavior

Recommended additions:

1. Redis cache
2. Queue-based workload such as RabbitMQ or Redis streams
3. Background worker service
4. More realistic DB issues
   - slow query classes
   - lock contention
   - connection exhaustion
5. Chaos scenarios
   - stop a service
   - degrade DB behavior
   - simulate network delay

What this teaches:

- backpressure
- async reliability
- cache tradeoffs
- graceful degradation at system level
- dependency isolation

Expected outcome:

- the lab starts behaving like a small but realistic distributed system

## V4: Advanced Platform and SRE Operations Lab

Goal:

- move from service SRE concepts into platform and operations thinking

Recommended additions:

1. Kubernetes deployment variant
2. Horizontal scaling experiments
3. autoscaling-style signals and decisions
4. resource requests and limits experiments
5. user-journey SLOs in addition to endpoint SLOs
6. burn-rate based paging strategy

What this teaches:

- platform SRE thinking
- scaling policy design
- reliability versus cost tradeoffs
- production-style SLO operations

Expected outcome:

- the lab becomes useful not only for observability learning, but also for architecture and operations interviews

## Best Order To Build

If you want the highest value with the least extra complexity, follow this order:

1. Alertmanager
2. Synthetic checks
3. Grafana annotations
4. Redis cache
5. Queue plus worker
6. Chaos experiments
7. Kubernetes version

## Best Next Step

If you want the biggest learning jump right now, the best next bundle is:

1. Alertmanager
2. Synthetic checks
3. Redis cache

Why:

- Alertmanager completes the alerting story
- synthetic checks add external reliability signals
- Redis introduces realistic performance and resilience tradeoffs

## What The Current Lab Already Covers Well

The current version already gives strong hands-on practice for:

- golden signals
- SLI and SLO basics
- error budgets
- metrics, logs, and traces
- database bottleneck analysis
- resilience patterns
- capacity planning
- guided demo and session reporting

## Decision Guide

Choose V2 first if:

- you want better operational workflow and alert practice

Choose V3 first if:

- you want more realistic distributed-system behavior

Choose V4 later if:

- you want to practice platform SRE and advanced interview scenarios
