# Load Testing Cheatsheet

Use PowerShell from:

```powershell
C:\Users\smuvva\Documents\sre-lab-practise
```

## Exact Fixed-Rate Commands

### 50 req/sec for 1 minute

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=baseline --env RATE=50 --env DURATION=1m
```

### 100 req/sec for 1 minute

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=baseline --env RATE=100 --env DURATION=1m
```

### 200 req/sec for 1 minute

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=baseline --env RATE=200 --env DURATION=1m --env PREALLOCATED_VUS=250 --env MAX_VUS=500
```

## Preset-Based Commands

### Retry Storm at 100 req/sec

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=retry-storm --env RATE=100 --env DURATION=1m
```

### DB Saturation at 100 req/sec

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=db-saturation --env RATE=100 --env DURATION=1m
```

### Stress Blend at 100 req/sec

```powershell
docker run --rm -i -v "${PWD}\load-tests:/scripts" grafana/k6 run /scripts/sre-demo.js --env BASE_URL=http://host.docker.internal:3001 --env SCENARIO=fixed --env PRESET=stress --env RATE=100 --env DURATION=1m
```

## Quick Tips

- Use the browser UI for learning flows and small bursts.
- Use `k6` for exact rates and repeatable measurements.
- Watch `Capacity Planning`, `SRE Golden Signals`, `Database Health`, and `SLO and Error Budget` while the test runs.
- For more options and interpretation notes, see [docs/manual-load-testing.md](C:/Users/smuvva/Documents/sre-lab-practise/docs/manual-load-testing.md).
