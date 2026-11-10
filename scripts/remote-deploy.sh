#!/usr/bin/env bash
# Runs ON THE HOST (as root). Called by ops/deploy.ps1:
#   bash /tmp/hablu-onboarding-remote-deploy-<sha>.sh <sha> [--bootstrap]
# Expects /tmp/hablu-onboarding-<sha>.tar.gz (a `git archive` of that commit).
#
# Steps: preflight -> unpack into app/ (previous kept as app.prev) -> [bootstrap: start db stack]
#        -> DB migrations -> build image hablu-onboarding-app:<sha> (skipped if it exists)
#        -> write REVISION -> `up -d --no-deps app cron` -> health + version checks.
# Never touches other projects, never runs `down`, never prunes, never prints .env values.
set -Eeuo pipefail

SHA="${1:-}"
BOOTSTRAP=0
[ "${2:-}" = "--bootstrap" ] && BOOTSTRAP=1
ROOT="${APP_ROOT:-/srv/apps/ai-client-onboarding}"
PROJECT="hablu-onboarding"
IMAGE="hablu-onboarding-app"
TARBALL="/tmp/hablu-onboarding-${SHA}.tar.gz"
REQUIRED_KEYS="APP_DOMAIN POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY CRON_SECRET EMAIL_FROM SMTP_HOST SMTP_PORT SMTP_ADMIN_EMAIL"

step() { printf '\n==> %s\n' "$*"; }
ok()   { printf '    ok: %s\n' "$*"; }
die()  { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }
dc()   { docker compose -p "$PROJECT" --project-directory "$ROOT" -f "$ROOT/compose.yaml" "$@"; }

PREV_REVISION="$(cat "$ROOT/REVISION" 2>/dev/null || true)"
trap 'rc=$?; if [ $rc -ne 0 ] && [ -n "$PREV_REVISION" ]; then echo "Rollback: pwsh -File ops/deploy.ps1 -Sha $PREV_REVISION" >&2; fi' EXIT

# ------------------------------------------------------------- preflight
step "Preflight ($SHA)"
[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || die "usage: remote-deploy.sh <git-sha> [--bootstrap]"
[ "$(id -u)" = 0 ] || die "run as root"
[ -d "$ROOT" ] || die "$ROOT does not exist (see first-time bootstrap)"
[ -f "$TARBALL" ] || die "$TARBALL not found"
[ -f "$ROOT/.env" ] || die "$ROOT/.env missing"
perm="$(stat -c '%a %U:%G' "$ROOT/.env")"
[ "$perm" = "600 root:root" ] || die ".env must be root:root 0600 (is: $perm)"
missing=""
for k in $REQUIRED_KEYS; do grep -Eq "^${k}=.+" "$ROOT/.env" || missing="$missing $k"; done
[ -z "$missing" ] || die ".env is missing values for:$missing  (add them with hablu-env)"
docker network inspect root_default >/dev/null 2>&1 || die "docker network root_default not found"
ok ".env present (0600 root), required keys set, root_default exists"

# ---------------------------------------------------------------- unpack
step "Unpacking into $ROOT/app"
rm -rf "$ROOT/app.new"
mkdir -p "$ROOT/app.new"
tar -xzf "$TARBALL" -C "$ROOT/app.new"
[ -f "$ROOT/app.new/compose.yaml" ] || die "tarball has no compose.yaml"
cp "$ROOT/app.new/compose.yaml" "$ROOT/compose.yaml.new"
docker compose -p "$PROJECT" --project-directory "$ROOT" -f "$ROOT/compose.yaml.new" config -q \
  || { rm -f "$ROOT/compose.yaml.new"; die "new compose.yaml is invalid with the current .env"; }
rm -rf "$ROOT/app.prev"
[ -d "$ROOT/app" ] && mv "$ROOT/app" "$ROOT/app.prev"
mv "$ROOT/app.new" "$ROOT/app"
[ -f "$ROOT/compose.yaml" ] && cp -p "$ROOT/compose.yaml" "$ROOT/compose.yaml.prev"
mv "$ROOT/compose.yaml.new" "$ROOT/compose.yaml"
ok "app/ updated (previous in app.prev/), compose config -q passed"

wait_healthy() {
  local svc="$1" timeout="${2:-180}" waited=0 cid status
  while :; do
    cid="$(dc ps -q "$svc" 2>/dev/null || true)"
    status="$( [ -n "$cid" ] && docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo missing)"
    [ "$status" = healthy ] && { ok "$svc healthy"; return 0; }
    [ "$waited" -ge "$timeout" ] && die "$svc not healthy after ${timeout}s (status: $status). Logs: docker compose -p $PROJECT logs --tail=50 $svc"
    sleep 3; waited=$((waited + 3))
  done
}

# ------------------------------------------------------------- database
if [ "$BOOTSTRAP" = 1 ]; then
  step "Bootstrap: starting database stack (first install only)"
  mkdir -p "$ROOT/data/db" "$ROOT/data/db-config" "$ROOT/data/storage"
  dc up -d db auth rest storage gateway
fi
dc ps --status running --services | grep -qx db \
  || die "the db service is not running. First install? Run: pwsh -File ops/deploy.ps1 -Bootstrap"
wait_healthy db 240
wait_healthy auth 180
wait_healthy storage 180

step "Database migrations"
psql_db() { dc exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"' sh "$@"; }
psql_db -c "create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);" >/dev/null
applied=0
for f in "$ROOT"/app/supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"; version="${base%%_*}"; name="${base#*_}"
  [[ "$version" =~ ^[0-9]+$ ]] || die "bad migration file name: $base"
  [ "$(psql_db -Atc "select 1 from supabase_migrations.schema_migrations where version = '$version'")" = 1 ] && continue
  echo "    applying $base"
  { echo "begin;"; cat "$f"; echo; echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name');"; echo "commit;"; } | psql_db >/dev/null
  applied=$((applied + 1))
done
ok "$applied new migration(s)"

# ---------------------------------------------------------------- image
step "Image $IMAGE:$SHA"
if docker image inspect "$IMAGE:$SHA" >/dev/null 2>&1; then
  ok "already built, reusing (rollback / redeploy)"
else
  REVISION="$SHA" dc build app
  ok "built"
fi
docker tag "$IMAGE:$SHA" "$IMAGE:current"

# --------------------------------------------------------------- deploy
step "Starting app + cron (--no-deps)"
printf '%s\n' "$SHA" > "$ROOT/REVISION.tmp" && mv "$ROOT/REVISION.tmp" "$ROOT/REVISION"
REVISION="$SHA" dc up -d --no-deps app cron
wait_healthy app 180

step "Checks"
version="$(dc exec -T app wget -qO- http://127.0.0.1:3000/api/version)"
case "$version" in *"\"$SHA\""*) ok "/api/version = $version";; *) die "/api/version returned: $version (expected $SHA)";; esac
dc exec -T app wget -qO- http://127.0.0.1:3000/healthz >/dev/null && ok "/healthz 200"

# Keep the 5 newest app images (+ current); remove older tags of THIS image only.
docker images "$IMAGE" --format '{{.Tag}}' | grep -Ev "^(current|$SHA)$" | tail -n +5 | while read -r tag; do
  docker image rm "$IMAGE:$tag" >/dev/null 2>&1 && echo "    removed old image $IMAGE:$tag" || true
done
rm -f "$TARBALL"

printf '\nDEPLOYED %s (previous: %s)\n' "$SHA" "${PREV_REVISION:-none}"
