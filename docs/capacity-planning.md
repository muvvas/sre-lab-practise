# Capacity Planning

## Objective

Capacity planning means estimating how much traffic the system can handle while still meeting its SLOs.

## What To Measure

- Request rate
- Average and p95 latency
- Error rate
- CPU pressure
- Memory usage
- Downstream dependency behavior

## Practical Local Method

### 1. Establish a Baseline

- Send low traffic
- Record latency and error rate

### 2. Increase Load Gradually

- Increase concurrent requests in steps
- Observe when p95 latency rises sharply
- Observe when errors begin

### 3. Find The First Limit

The first clear limit might be:

- CPU saturation
- Event loop contention
- Downstream service latency
- Docker Desktop resource limits

### 4. Estimate Safe Capacity

Choose a safety point before the curve becomes unstable.

Example:

- At 20 requests/sec, p95 latency is 120 ms
- At 40 requests/sec, p95 latency is 260 ms
- At 60 requests/sec, p95 latency is 700 ms and failures begin

Then a reasonable safe capacity might be around 30 to 35 requests/sec for this local setup.

## Capacity Planning Questions

- What is the maximum throughput while staying within the latency SLO?
- Which component saturates first?
- Does scaling one service help, or is the bottleneck elsewhere?
- How much headroom do we want before expected peak load?

## Important Note For Local Labs

Your numbers will reflect your laptop, Docker Desktop settings, and local background load. That is still useful. The goal is not perfect production realism. The goal is learning how to reason from signals to decisions.

## 15-Minute Guided Exercise

For a full reproducible walk-through, see:

- [docs/15-minute-capacity-exercise.md](C:/Users/smuvva/Documents/sre-lab-practise/docs/15-minute-capacity-exercise.md)


For exact repeatable request rates such as `100 req/sec`, use:

- [docs/manual-load-testing.md](C:/Users/smuvva/Documents/sre-lab-practise/docs/manual-load-testing.md)
