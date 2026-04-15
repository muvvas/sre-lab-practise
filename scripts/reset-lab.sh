#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

REMOVE_VOLUMES=0
if [ "${1:-}" = "--volumes" ]; then
  REMOVE_VOLUMES=1
  docker compose down -v
else
  docker compose down
fi

REPORTS_DIR="$ROOT_DIR/reports"
REPORTS_COUNT=0
if [ -d "$REPORTS_DIR" ]; then
  REPORTS_COUNT="$(find "$REPORTS_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')"
fi

printf '\n'
printf '%s\n' 'SRE Lab has been stopped'
printf '%s\n' '------------------------'
if [ "$REMOVE_VOLUMES" -eq 1 ]; then
  printf '%s\n' 'Docker containers, network, and named volumes were removed.'
  printf '%s\n' 'Postgres data and Docker-managed app logs were reset.'
else
  printf '%s\n' 'Docker containers and network were stopped and removed.'
  printf '%s\n' 'Named volumes were preserved, so Postgres data and app logs remain available.'
fi
printf 'Reports folder: %s\n' "$REPORTS_DIR"
printf 'Saved report files detected: %s\n' "$REPORTS_COUNT"
printf '\n'
printf '%s\n' 'Start the lab again with:'
printf '%s\n' '  ./scripts/bootstrap.sh'
