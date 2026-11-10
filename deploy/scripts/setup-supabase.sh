#!/usr/bin/env bash
# One-time (and re-runnable) setup of the self-hosted Supabase stack.
#   - downloads the official Supabase Docker setup at a pinned release
#   - generates all secrets ONCE (re-running never rotates them)
#   - writes your domains/SMTP into the stack config
#   - copies the keys the app needs into deploy/.env.production
source "$(dirname "$0")/lib.sh"

[ -f "$APP_ENV" ] || die "Create deploy/.env.production first: cp deploy/.env.production.example deploy/.env.production"
chmod 600 "$APP_ENV"
require_env APP_DOMAIN API_DOMAIN PROXY_NETWORK SMTP_HOST SMTP_PORT SMTP_ADMIN_EMAIL
for cmd in git openssl docker awk; do command -v "$cmd" >/dev/null || die "Missing '$cmd'. Install it first."; done
check_compose_version

docker network inspect "$(get_env PROXY_NETWORK "$APP_ENV")" >/dev/null 2>&1 \
  || die "Docker network '$(get_env PROXY_NETWORK "$APP_ENV")' not found. Set PROXY_NETWORK to your proxy's network (see: docker network ls)."

REF="${SUPABASE_REF:-$SUPABASE_REF_DEFAULT}"
if [ ! -f "$STACK/docker-compose.yml" ]; then
  info "Downloading official Supabase Docker setup ($REF)"
  tmp="$(mktemp -d)"
  git clone --quiet --depth 1 --branch "$REF" --filter=blob:none --sparse https://github.com/supabase/supabase.git "$tmp/src"
  git -C "$tmp/src" sparse-checkout set docker
  mkdir -p "$STACK"
  cp -a "$tmp/src/docker/." "$STACK/"
  echo "$REF" > "$STACK/.onboardly-ref"
  rm -rf "$tmp"
  ok "Supabase files in deploy/supabase-stack"
fi

if [ ! -f "$STACK_ENV" ]; then
  info "Generating secrets (first run only)"
  cp "$STACK/.env.example" "$STACK_ENV"
  (cd "$STACK" && sh utils/generate-keys.sh --update-env >/dev/null)
  rm -f "$STACK_ENV.old"
  set_env POOLER_TENANT_ID "onboardly-$(openssl rand -hex 4)" "$STACK_ENV"
  ok "Secrets generated"
else
  info "Keeping existing secrets (deploy/supabase-stack/.env)"
fi
chmod 600 "$STACK_ENV"

APP_DOMAIN="$(get_env APP_DOMAIN "$APP_ENV")"
API_DOMAIN="$(get_env API_DOMAIN "$APP_ENV")"
info "Writing domains and email settings into the Supabase config"
set_env SUPABASE_PUBLIC_URL "https://$API_DOMAIN" "$STACK_ENV"
set_env API_EXTERNAL_URL "https://$API_DOMAIN/auth/v1" "$STACK_ENV"
set_env SITE_URL "https://$APP_DOMAIN" "$STACK_ENV"
set_env ADDITIONAL_REDIRECT_URLS "https://$APP_DOMAIN/**" "$STACK_ENV"
set_env DISABLE_SIGNUP "false" "$STACK_ENV"
set_env ENABLE_EMAIL_SIGNUP "true" "$STACK_ENV"
set_env ENABLE_EMAIL_AUTOCONFIRM "false" "$STACK_ENV"
set_env ENABLE_PHONE_SIGNUP "false" "$STACK_ENV"
set_env ENABLE_PHONE_AUTOCONFIRM "false" "$STACK_ENV"
set_env ENABLE_ANONYMOUS_USERS "false" "$STACK_ENV"
set_env OPENAI_API_KEY "" "$STACK_ENV"
set_env STUDIO_DEFAULT_ORGANIZATION "Onboardly" "$STACK_ENV"
set_env STUDIO_DEFAULT_PROJECT "Onboardly" "$STACK_ENV"
for key in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_ADMIN_EMAIL SMTP_SENDER_NAME; do
  set_env "$key" "$(get_env "$key" "$APP_ENV")" "$STACK_ENV"
done
# Values the Onboardly override file uses.
for key in API_DOMAIN PROXY_NETWORK TRAEFIK_ENTRYPOINT TRAEFIK_CERTRESOLVER GATEWAY_LOCAL_PORT; do
  set_env "$key" "$(get_env "$key" "$APP_ENV")" "$STACK_ENV"
done

info "Copying keys into deploy/.env.production"
set_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$(get_env ANON_KEY "$STACK_ENV")" "$APP_ENV"
set_env SUPABASE_SERVICE_ROLE_KEY "$(get_env SERVICE_ROLE_KEY "$STACK_ENV")" "$APP_ENV"
set_env POSTGRES_PASSWORD "$(get_env POSTGRES_PASSWORD "$STACK_ENV")" "$APP_ENV"
[ -n "$(get_env CRON_SECRET "$APP_ENV")" ] || set_env CRON_SECRET "$(openssl rand -hex 32)" "$APP_ENV"
mkdir -p "$DEPLOY/backups"

ok "Supabase is configured."
echo "   Studio (database dashboard) user: $(get_env DASHBOARD_USERNAME "$STACK_ENV")"
echo "   Studio password is DASHBOARD_PASSWORD in deploy/supabase-stack/.env"
echo "   Next: ./deploy/scripts/deploy.sh"
