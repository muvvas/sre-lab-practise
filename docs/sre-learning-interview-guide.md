# SRE Learning And Interview Guide

This guide is meant for both learning and interview preparation using the local SRE lab.

## 1. What This Lab Teaches

The lab teaches four major SRE themes:

- observability fundamentals
- SLI and SLO thinking
- observability-driven decisions
- resilience and capacity tradeoffs

The system under test is:

- `app-a -> app-b -> app-c -> postgres`

The telemetry stack is:

- Prometheus for metrics
- Loki and Dozzle for logs
- Tempo, Grafana, and Jaeger for traces
- Grafana for dashboards

## 2. Core SRE Concepts

### Golden Signals

- latency: how long requests take
- traffic: how many requests the system handles
- errors: how often requests fail
- saturation: how close the system is to exhaustion

### SLI

An SLI is a measured indicator of service behavior.

Examples in this lab:

- successful request ratio
- latency under 300 ms
- database query latency

### SLO

An SLO is the target you want the service to meet.

Examples:

- 99 percent successful requests
- 95 percent of requests under 300 ms

### Error Budget

The error budget is the amount of failure or slowness you can spend before breaching the SLO.

## 3. Dashboards And What They Mean

### SRE Golden Signals

Use this dashboard to answer:

- are users seeing slow requests?
- are requests failing?
- is the runtime getting stressed?

### SLO And Error Budget

Use this dashboard to answer:

- are we meeting the current SLO?
- how fast are we burning budget?

### Database Health

Use this dashboard to answer:

- is the DB healthy?
- are query latencies climbing?
- are backends and connection pressure increasing?

### Capacity Planning

Use this dashboard to answer:

- what happens as traffic increases?
- what saturates first?
- should we scale app containers or fix the DB tier first?

## 4. Resilience Patterns In This Lab

The lab now demonstrates:

- timeouts
- retries
- circuit breaker behavior
- graceful fallback responses

Why this matters:

- retries may reduce transient failure pain
- retries can also amplify pressure on a slow dependency
- circuit breakers prevent endless calls to an unhealthy dependency
- fallbacks can preserve partial user experience

## 5. Alerting In This Lab

The Prometheus rules now cover:

- app latency SLO breach
- fast error-budget burn
- database latency
- database connection pressure
- resilience activity such as fallbacks or circuit openings

Interview angle:

- alerts should be actionable
- not every bad metric deserves a page
- alert design should be tied to user impact and investigation steps

## 6. Observability-Driven Decision Making

This means:

- do not guess
- use telemetry to decide what to do next

Examples from this lab:

- high app latency with low event loop saturation and high DB latency means the DB is likely the bottleneck
- high app latency with high event loop saturation and healthy DB suggests app-tier scaling or tuning
- rising error rate with circuit breaker activity suggests dependency instability

## 7. Capacity Planning Thinking

Good capacity planning asks:

- what throughput can the service sustain while meeting the SLO?
- what breaks first under load?
- when does scaling help?
- when does optimization help more than scaling?

In this lab, capacity planning should be based on:

- p95 latency
- error ratio
- event loop utilization
- DB query p95
- DB backends
- held connections

## 8. Interview Questions You Should Be Able To Answer

### Fundamentals

- What are the four golden signals?
- What is the difference between an SLI and an SLO?
- What is an error budget?

### Observability

- When would you use logs instead of metrics?
- When do traces add the most value?
- How do you correlate metrics, logs, and traces during an incident?

### Reliability

- What is the purpose of a timeout?
- When can retries make things worse?
- What problem does a circuit breaker solve?
- What is graceful degradation?

### Scaling And Capacity

- How do you decide whether to scale horizontally?
- How do you know the database is the bottleneck?
- Why can low request rate still produce high latency?

### Alerts

- What makes a good alert?
- What alerts should page immediately?
- What should be a warning instead of a page?

## 9. Strong Interview Answers

Good answers usually include:

- the symptom
- the telemetry you would check first
- how you would confirm the bottleneck
- the immediate mitigation
- the longer-term fix

Example:

If latency spikes but event loop utilization stays low while DB query p95 and connection pressure rise, I would treat the database as the likely bottleneck. I would reduce pressure with query tuning, connection-pool review, or DB scaling before adding more app replicas.

## 10. Suggested Practice Routine

1. Run the baseline scenario and explain each dashboard aloud.
2. Run the slow DB or pool stress scenario.
3. State your bottleneck hypothesis before opening Jaeger.
4. Use logs and traces to confirm or reject the hypothesis.
5. Decide whether to scale, tune, or mitigate.
6. Summarize the incident in 2 to 3 minutes as if answering an interview question.

## 11. What “Expert In SRE Practices” Looks Like

It does not only mean knowing tooling.

It means being able to:

- connect telemetry to user experience
- design useful SLIs and SLOs
- make calm, evidence-based decisions under pressure
- understand tradeoffs between reliability, speed, and cost
- improve the system after the incident, not only during it
