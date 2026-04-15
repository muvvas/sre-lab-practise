# Deployment and Validation Guide

This lab is designed for local deployment with Docker Desktop on Windows.

## 1. Build and Start

From `C:\Users\smuvva\Documents\sre-lab-practise` run:

```powershell
docker compose up --build -d
```

Optional:

- copy `.env.example` to `.env`
- change ports or credentials before starting

Cross-platform helpers:

- Windows: `.\scripts\bootstrap.ps1`
- Linux / macOS: `./scripts/bootstrap.sh`

## 2. Core URLs

- Grafana: [http://localhost:3000](http://localhost:3000)
- Prometheus: [http://localhost:9090](http://localhost:9090)
- app-a control panel: [http://localhost:3001](http://localhost:3001)
- app-b health: [http://localhost:3002/health](http://localhost:3002/health)
- app-c health: [http://localhost:3003/health](http://localhost:3003/health)
- Jaeger: [http://localhost:16686](http://localhost:16686)
- Dozzle: [http://localhost:8080](http://localhost:8080)

Grafana login:

- Username: `admin`
- Password: `admin`

## 3. Quick Validation

Check that the applications respond:

```powershell
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
```

Generate test traffic:

```powershell
curl "http://localhost:3001/api/demo?items=3&latencyMs=40&dependencyLatencyMs=60&dbDelayMs=80"
```

Check Prometheus targets:

```powershell
curl http://localhost:9090/api/v1/targets
```

Check Grafana dashboards:

```powershell
curl -u admin:admin http://localhost:3000/api/search
```

Expected dashboards:

- `SRE Golden Signals`
- `Service Dependency Overview`
- `SLO and Error Budget`
- `Database Health`
- `Capacity Planning`

## 4. Guided Demo Validation

1. Open [http://localhost:3001](http://localhost:3001).
2. Use `Scheduled Runner` and pick an `Experiment Schedule`.
3. Let it run for a few minutes.
4. Stop the run if needed, or let it complete.
5. Export JSON, Markdown, or HTML from the session export controls.

The report includes:

- scenario
- planned duration
- requests triggered
- failures observed
- sampled summaries over time
- final success rate and p95 latency

## 5a. Exact Fixed-Rate Load Tests

For exact traffic like `100 req/sec`, use the terminal guide:

- [manual-load-testing.md](C:/Users/smuvva/Documents/sre-lab-practise/docs/manual-load-testing.md)

## 5. Capacity Planning Workflow

Use this sequence when learning capacity planning:

1. Run `Baseline` and capture steady-state latency and throughput.
2. Run `Latency`, `Slow Query`, or `Pool Stress`.
3. Open the `Capacity Planning` dashboard in Grafana.
4. Watch for the first sign of saturation:
   - p95 latency rising sharply
   - error ratio increasing
   - event loop utilization rising
   - Postgres backends climbing
   - held DB connections increasing
5. Use Jaeger to confirm where the latency is introduced.
6. Use Dozzle to inspect failure logs.

Capacity planning in this lab should be based on:

- throughput vs latency
- error rate vs load
- application saturation
- database saturation
- where the bottleneck appears first

## 6. GitHub Handoff

This workspace is already a Git repository, but you still need to connect a GitHub remote.

Typical flow:

```powershell
git add .
git commit -m "Add SRE learning lab with dashboards, demo UI, and Postgres"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

Check the remote first:

```powershell
git remote -v
```

If a remote already exists, update it instead of adding a second one:

```powershell
git remote set-url origin <your-github-repo-url>
```

## 7. Rebuild After Changes

If you change app code:

```powershell
docker compose up --build -d app-a app-b app-c
```

If you change Grafana dashboard JSON:

```powershell
docker compose restart grafana
```

## 8. Reset The Lab

Without deleting data:

- Windows: `.\scripts\reset-lab.ps1`
- Linux / macOS: `./scripts/reset-lab.sh`

With Docker volumes removed:

- Windows: `.\scripts\reset-lab.ps1 -RemoveVolumes`
- Linux / macOS: `./scripts/reset-lab.sh --volumes`
