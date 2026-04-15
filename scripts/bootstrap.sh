#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

get_config_value() {
  key="$1"
  if [ -f ".env" ]; then
    value="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2- || true)"
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return 0
    fi
  fi

  value="$(grep -E "^${key}=" .env.example | tail -n 1 | cut -d= -f2- || true)"
  printf '%s' "$value"
}

http_health() {
  name="$1"
  url="$2"
  attempts="${3:-5}"
  count=1

  while [ "$count" -le "$attempts" ]; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url" || true)"
    if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
      printf '%s: OK' "$name"
      return 0
    fi

    count=$((count + 1))
    sleep 2
  done

  printf '%s: CHECK' "$name"
}

if [ ! -f ".env" ]; then
  cp ".env.example" ".env"
  echo "Created .env from .env.example"
fi

mkdir -p reports

docker compose config >/dev/null

if [ "${1:-}" = "--foreground" ]; then
  docker compose up --build
else
  docker compose up --build -d
fi

APP_A_PORT="$(get_config_value APP_A_PORT)"
APP_B_PORT="$(get_config_value APP_B_PORT)"
APP_C_PORT="$(get_config_value APP_C_PORT)"
GRAFANA_PORT="$(get_config_value GRAFANA_PORT)"
PROMETHEUS_PORT="$(get_config_value PROMETHEUS_PORT)"
DOZZLE_PORT="$(get_config_value DOZZLE_PORT)"
JAEGER_UI_PORT="$(get_config_value JAEGER_UI_PORT)"
POSTGRES_PORT="$(get_config_value POSTGRES_PORT)"
GRAFANA_ADMIN_USER="$(get_config_value GRAFANA_ADMIN_USER)"
GRAFANA_ADMIN_PASSWORD="$(get_config_value GRAFANA_ADMIN_PASSWORD)"
POSTGRES_DB="$(get_config_value POSTGRES_DB)"
POSTGRES_USER="$(get_config_value POSTGRES_USER)"
POSTGRES_PASSWORD="$(get_config_value POSTGRES_PASSWORD)"

printf '\n'
printf '%s\n' 'SRE Lab is ready'
printf '%s\n' '----------------'
printf 'Grafana:    http://localhost:%s  (user: %s, password: %s)\n' "$GRAFANA_PORT" "$GRAFANA_ADMIN_USER" "$GRAFANA_ADMIN_PASSWORD"
printf 'App UI:     http://localhost:%s\n' "$APP_A_PORT"
printf 'Reports:    http://localhost:%s/reports\n' "$APP_A_PORT"
printf 'App-B:      http://localhost:%s/health\n' "$APP_B_PORT"
printf 'App-C:      http://localhost:%s/health\n' "$APP_C_PORT"
printf 'Prometheus: http://localhost:%s\n' "$PROMETHEUS_PORT"
printf 'Jaeger:     http://localhost:%s\n' "$JAEGER_UI_PORT"
printf 'Dozzle:     http://localhost:%s\n' "$DOZZLE_PORT"
printf 'Postgres:   localhost:%s  (db: %s, user: %s, password: %s)\n' "$POSTGRES_PORT" "$POSTGRES_DB" "$POSTGRES_USER" "$POSTGRES_PASSWORD"
printf '\n'
printf '%s\n' 'Health checks:'
printf '  %s\n' "$(http_health 'App UI' "http://localhost:${APP_A_PORT}/health")"
printf '  %s\n' "$(http_health 'App-B' "http://localhost:${APP_B_PORT}/health")"
printf '  %s\n' "$(http_health 'App-C' "http://localhost:${APP_C_PORT}/health")"
printf '  %s\n' "$(http_health 'Grafana' "http://localhost:${GRAFANA_PORT}/login")"
printf '  %s\n' "$(http_health 'Prometheus' "http://localhost:${PROMETHEUS_PORT}/-/healthy")"
printf '  %s\n' "$(http_health 'Jaeger' "http://localhost:${JAEGER_UI_PORT}")"
printf '  %s\n' "$(http_health 'Dozzle' "http://localhost:${DOZZLE_PORT}")"
printf '\n'
printf '%s\n' 'Values are loaded from .env when present, otherwise .env.example defaults are used.'
