#!/usr/bin/env bash
# Shared helpers for the Onboardly VPS scripts. Source this file; don't run it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY="$ROOT/deploy"
APP_ENV="$DEPLOY/.env.production"
STACK="$DEPLOY/supabase-stack"
STACK_ENV="$STACK/.env"
DB_CONTAINER="onboardly-db-postgres"
SUPABASE_REF_DEFAULT="self-hosted/v0.8.4"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Read KEY from an env file (no sourcing: values may contain spaces or symbols).
get_env() {
  local key="$1" file="$2"
  [ -f "$file" ] || return 0
  awk -v k="$key" 'index($0, k"=")==1 { v=substr($0, length(k)+2); gsub(/^"|"$/, "", v); gsub(/^'"'"'|'"'"'$/, "", v); print v; exit }' "$file"
}

# Set KEY=VALUE in an env file (adds it if missing). Safe for any characters.
set_env() {
  local key="$1" val="$2" file="$3" tmp
  tmp="$(mktemp)"
  KEY="$key" VAL="$val" awk 'BEGIN { done=0 }
    index($0, ENVIRON["KEY"]"=")==1 { print ENVIRON["KEY"]"="ENVIRON["VAL"]; done=1; next }
    { print }
    END { if (!done) print ENVIRON["KEY"]"="ENVIRON["VAL"] }' "$file" > "$tmp"
  cat "$tmp" > "$file" && rm -f "$tmp"
}

require_env() {
  local v
  for key in "$@"; do
    v="$(get_env "$key" "$APP_ENV")"
    [ -n "$v" ] || die "Set $key in deploy/.env.production"
    case "$v" in *example.com*) die "$key still has an example value: $v";; esac
  done
}

db_compose() {
  docker compose -p onboardly-db --env-file "$STACK_ENV" \
    -f "$STACK/docker-compose.yml" -f "$DEPLOY/supabase/docker-compose.onboardly.yml" "$@"
}

app_compose() {
  # deploy/docker-compose.override.yml (git-ignored) lets a server add local tweaks.
  local extra=()
  [ -f "$DEPLOY/docker-compose.override.yml" ] && extra=(-f "$DEPLOY/docker-compose.override.yml")
  docker compose -p onboardly --env-file "$APP_ENV" -f "$DEPLOY/docker-compose.yml" "${extra[@]}" "$@"
}

check_compose_version() {
  local v
  v="$(docker compose version --short 2>/dev/null | sed 's/^v//')" || die "Docker Compose v2 is required"
  # !override in the Supabase override file needs 2.24.4+
  if [ "$(printf '%s\n%s\n' "2.24.4" "$v" | sort -V | head -1)" != "2.24.4" ]; then
    die "Docker Compose $v is too old; 2.24.4 or newer is required"
  fi
}

wait_healthy() {
  local container="$1" timeout="${2:-180}" waited=0 status
  while :; do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo missing)"
    [ "$status" = "healthy" ] && return 0
    [ "$waited" -ge "$timeout" ] && die "$container is not healthy after ${timeout}s (status: $status). Check: docker logs $container"
    sleep 3; waited=$((waited + 3))
  done
}
