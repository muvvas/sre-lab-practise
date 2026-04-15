# Database Next Step

## Short Answer

Yes, a backend database is the right next evolution for this lab.

If we add one thing next, it should be `Postgres`.

## Why Postgres Fits This Project

It gives you realistic SRE learning opportunities:

- Query latency as part of end-to-end latency
- Connection pool saturation
- Slow queries
- Lock contention
- Error handling for unavailable dependencies
- Capacity planning across app tier and data tier
- More realistic traces with app spans and database spans together

## What Changes When We Add It

Current flow:

- `app-a -> app-b -> app-c`

Recommended next flow:

- `app-a -> app-b -> app-c -> postgres`

That gives you a clearer critical path and more useful failure modes.

## Good Experiments After Adding A Database

- Inject slow queries and watch latency SLI fail
- Exhaust connection pool and watch saturation rise
- Stop Postgres and observe error budget burn
- Add retries and timeouts, then compare behavior
- Compare CPU bottlenecks vs database bottlenecks

## What I Recommend

Phase 1:

- Add Postgres container
- Let `app-c` query Postgres
- Seed one small demo table
- Add OpenTelemetry DB tracing

Phase 2:

- Add query latency metrics
- Add a dashboard for database health
- Add scenarios for slow queries and DB outages

## My Take

For this lab, a database is worth it because it moves the system closer to a real production dependency chain. It will make your SLI/SLO work, tracing, and capacity planning much more meaningful than a pure in-memory service chain.
