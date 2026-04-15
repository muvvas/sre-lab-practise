# Services Overview

This document explains each service in the local SRE learning lab, what it does, and why it exists.

## app-a

Role:

- main entry service
- browser control panel host
- guided demo and session-report API

Responsibilities:

- accepts user and load-test traffic
- forwards requests to `app-b`
- tracks recent request history for the UI
- generates enriched session summaries using Prometheus
- persists session reports to disk

Main endpoints:

- `GET /`
- `GET /health`
- `GET /ready`
- `GET /api/demo`
- `GET /api/stats`
- `POST /api/session-report`
- `GET /api/session-report/latest`
- `GET /api/session-report/latest/markdown`
- `GET /api/session-report/latest/html`

Main telemetry:

- `demo_requests_total`
- `demo_errors_total`
- `demo_latency_sli_good_total`
- `demo_request_duration_ms`

Why it matters:

- this is the place where end-user traffic starts
- it is the easiest place to observe end-to-end behavior

## app-b

Role:

- middle-tier service
- resilience demonstration layer

Responsibilities:

- forwards work from `app-a` to `app-c`
- applies timeout, retry, circuit breaker, and fallback logic

Main endpoint:

- `GET /api/work`

Main telemetry:

- `worker_requests_total`
- `worker_errors_total`
- `worker_retries_total`
- `worker_fallback_total`
- `worker_circuit_open_total`
- `worker_request_duration_ms`

Why it matters:

- this service demonstrates how resilience patterns change behavior and observability

## app-c

Role:

- data and dependency service
- Postgres-facing layer

Responsibilities:

- handles DB-backed work
- simulates slow queries
- simulates held DB connections
- simulates DB failures

Main endpoint:

- `GET /api/data`

Main telemetry:

- `data_requests_total`
- `data_errors_total`
- `data_request_duration_ms`
- `db_queries_total`
- `db_query_errors_total`
- `db_query_duration_ms`
- `db_pool_hold_total`

Why it matters:

- this is where database latency and connection pressure become visible

## postgres

Role:

- local relational database for realistic dependency behavior

Responsibilities:

- stores seeded demo records
- supports realistic DB latency and saturation learning

Persistence:

- stored in Docker volume `postgres_data`

Why it matters:

- helps you learn when a DB becomes the true bottleneck

## postgres-exporter

Role:

- exposes Postgres metrics to Prometheus

Why it matters:

- makes DB health visible in dashboards and alerts

## otel-collector

Role:

- central telemetry pipeline

Responsibilities:

- receives telemetry from the Node services
- exposes Prometheus-scrapable metrics
- ships logs to Loki
- ships traces to Tempo

Why it matters:

- it is the observability hub of the lab

## prometheus

Role:

- metrics store and alert rule engine

Responsibilities:

- scrapes collector metrics and Postgres exporter metrics
- evaluates recording rules
- evaluates alert rules

Why it matters:

- supports dashboards, alerting logic, and automated summary analysis

## grafana

Role:

- primary dashboard UI

Responsibilities:

- visualizes metrics, logs, and traces
- loads dashboards from code automatically

Why it matters:

- this is the main place where you observe system behavior

## loki

Role:

- logs backend

Why it matters:

- stores structured service logs for correlation with metrics and traces

## tempo

Role:

- trace backend

Why it matters:

- stores distributed traces so request flow and latency can be inspected

## jaeger

Role:

- dedicated trace search and waterfall UI

Why it matters:

- easier than dashboards when you want to study trace structure in detail

## dozzle

Role:

- live container log UI

Why it matters:

- useful for quick debugging without opening raw Docker logs
