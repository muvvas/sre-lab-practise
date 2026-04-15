# SRE Learning Path

This project can support a beginner-to-advanced SRE learning journey.

## Beginner

Focus:

- understand the golden signals
- read Grafana dashboards
- learn what logs, metrics, and traces each tell you
- learn the basic shape of an SLI and an SLO

Use this lab to practice:

- sending healthy and failing traffic
- reading `SRE Golden Signals`
- reading `SLO and Error Budget`
- finding simple failures in logs and traces

Expected outcomes:

- explain latency, traffic, errors, and saturation
- explain the difference between logs, metrics, and traces
- explain what an availability SLI is
- explain what an error budget is

## Intermediate

Focus:

- capacity planning
- dependency bottleneck analysis
- error-budget burn interpretation
- resilience patterns
- alert meaning and triage

Use this lab to practice:

- 15-minute guided capacity exercises
- identifying whether app or DB is the bottleneck
- using retries, timeouts, graceful fallback, and circuit breaking
- understanding when alerts represent user pain

Expected outcomes:

- decide whether to scale app containers or fix the database tier
- explain why low throughput can still produce high latency
- explain how retries can help or hurt
- explain how resilience patterns interact with observability

## Advanced

Focus:

- runbooks and incident management
- production-style SLO design
- observability-driven decision making
- reliability tradeoffs
- platform and scaling strategy

Use this lab to practice:

- building incident scenarios from dashboards and traces
- comparing burn-rate alerts with end-user symptoms
- explaining the tradeoff between availability, latency, and cost
- describing how you would translate this local lab into Kubernetes or cloud production

Expected outcomes:

- explain a full investigation flow from symptom to mitigation
- design service-level and journey-level SLIs
- describe when scaling helps and when it does not
- connect telemetry to business impact

## Suggested Study Sequence

1. Learn the dashboards and signals.
2. Practice SLI, SLO, and error-budget basics.
3. Run the 15-minute capacity exercise.
4. Study resilience behavior with timeouts, retries, and fallbacks.
5. Review alert rules and understand when they should fire.
6. Practice explaining incidents and mitigations out loud.
