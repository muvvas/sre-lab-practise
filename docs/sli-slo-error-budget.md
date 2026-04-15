# SLI, SLO, and Error Budget

## Example User Journey

The user calls `app-a /api/demo`. `app-a` calls `app-b`. This gives us a simple user-facing workflow to measure.

## Suggested SLIs

### Availability SLI

Successful requests / total requests for `app-a /api/demo`

Good request:

- HTTP status is less than 500

Bad request:

- HTTP status is 500 or higher

### Latency SLI

Percentage of requests to `app-a /api/demo` that complete within 300 ms

Good request:

- Response time is less than or equal to 300 ms

Bad request:

- Response time is above 300 ms

## Suggested SLOs

For a 30-day window:

- Availability SLO: 99.0%
- Latency SLO: 95% of requests complete within 300 ms

These are deliberately modest for a learning lab. You can later tighten them.

## Error Budget Example

If availability SLO is 99.0%, then the allowed failure budget is 1.0%.

For 100,000 requests in 30 days:

- Allowed failed requests = 1,000

If you create a test with 10% failures, the budget will burn very quickly. That is useful for learning:

- How to calculate burn rate
- How alerts should fire
- When engineering work should switch from feature work to reliability work

## Example Prometheus Queries

These metrics are exported from the applications through OpenTelemetry. Depending on metric naming in your local stack, you may need to confirm the final names in Prometheus.

Availability ratio idea:

```promql
sum(rate(demo_requests_total[5m])) - sum(rate(demo_errors_total[5m]))
/
sum(rate(demo_requests_total[5m]))
```

Error ratio idea:

```promql
sum(rate(demo_errors_total[5m]))
/
sum(rate(demo_requests_total[5m]))
```

Latency percentile idea:

```promql
histogram_quantile(0.95, sum(rate(demo_request_duration_ms_bucket[5m])) by (le))
```

## Burn-Rate Thinking

Fast burn:

- Short time window
- Catches sharp incidents

Slow burn:

- Longer time window
- Catches smaller but persistent issues

In a real production environment, you would usually alert on both.
