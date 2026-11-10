#!/usr/bin/env bash
# Build and (re)start everything. Safe to run for every update.
#   ./deploy/scripts/deploy.sh            # pull latest code, then deploy
#   ./deploy/scripts/deploy.sh --no-pull  # deploy the code that's checked out
source "$(dirname "$0")/lib.sh"

PULL=1
[ "${1:-}" = "--no-pull" ] && PULL=0

[ -f "$APP_ENV" ] || die "deploy/.env.production is missing"
[ -f "$STACK_ENV" ] || die "Run ./deploy/scripts/setup-supabase.sh first"
require_env APP_DOMAIN API_DOMAIN PROXY_NETWORK NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY POSTGRES_PASSWORD CRON_SECRET
check_compose_version

if [ "$PULL" = 1 ]; then
  info "Pulling latest code"
  git -C "$ROOT" pull --ff-only
fi

info "Starting database stack"
db_compose up -d --remove-orphans
wait_healthy "$DB_CONTAINER" 180
wait_healthy onboardly-db-auth 180
wait_healthy onboardly-db-storage 180
ok "Database stack is healthy"

info "Applying migrations"
"$DEPLOY/scripts/migrate.sh"

info "Building the app image (takes a few minutes)"
app_compose build app

info "Starting app, cron and backup"
mkdir -p "$DEPLOY/backups"
app_compose up -d --remove-orphans
wait_healthy onboardly-app 180
ok "App is healthy"

docker image prune -f --filter "label=com.docker.compose.project=onboardly" >/dev/null 2>&1 || true

APP_DOMAIN="$(get_env APP_DOMAIN "$APP_ENV")"
echo
ok "Deployed. Open https://$APP_DOMAIN"
if [ "$(get_env PROXY_KIND "$APP_ENV")" = "npm" ]; then
  echo "   Nginx Proxy Manager: make sure both proxy hosts exist (see deploy/VPS.md, step 6)."
fi
