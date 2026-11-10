#!/usr/bin/env bash
# One-time first fill of /srv/apps/ai-client-onboarding/.env. Run ON THE HOST as root,
# by the owner, before the first `ops/deploy.ps1 -Bootstrap`.
#
# Why this exists: hablu-env runs `compose config` and recreates `app` on every write,
# and neither works before the first deploy (no compose.yaml yet, required keys missing,
# no app image). After this script, every change goes through hablu-env as usual.
#
#   usage: bash init-env.sh            (gen-supabase-jwt.sh must sit next to it or in /root)
#
# What it does:
#   * refuses unless the .env exists, is root:root 0600 and is EMPTY (never overwrites)
#   * generates POSTGRES_PASSWORD, JWT_SECRET, CRON_SECRET (openssl rand -hex 32)
#   * signs ANON_KEY / SERVICE_ROLE_KEY from JWT_SECRET with gen-supabase-jwt.sh
#   * asks for APP_DOMAIN, EMAIL_FROM, SMTP_* (SMTP_PASS hidden)
#   * writes plain KEY=value lines (same format as hablu-env) atomically, root:root 0600
#   * never prints a value: the summary shows key names and lengths only
set -Eeuo pipefail
umask 077

ENV_FILE="${ENV_FILE:-/srv/apps/ai-client-onboarding/.env}"
DEFAULT_DOMAIN="ai-client-onboarding.hablu-programmer.com"

die() { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }
ok()  { printf '  ok: %s\n' "$*"; }

# ------------------------------------------------------------- preflight
[ "$(id -u)" = 0 ] || die "run as root"
command -v openssl >/dev/null || die "openssl not found"
[ -f "$ENV_FILE" ] || die "$ENV_FILE does not exist (create it first: install -m 0600 -o root -g root /dev/null $ENV_FILE)"
perm="$(stat -c '%a %U:%G' "$ENV_FILE")"
[ "$perm" = "600 root:root" ] || die "$ENV_FILE must be root:root 0600 (is: $perm)"
[ ! -s "$ENV_FILE" ] || die "$ENV_FILE is not empty. This script only does the first fill; use hablu-env for changes."

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JWT_HELPER=""
for c in "$here/gen-supabase-jwt.sh" /root/gen-supabase-jwt.sh; do [ -f "$c" ] && { JWT_HELPER="$c"; break; }; done
[ -n "$JWT_HELPER" ] || die "gen-supabase-jwt.sh not found next to this script or in /root"

# ---------------------------------------------------------------- input
# Values are written unquoted (like hablu-env), so refuse characters that compose
# would interpolate, strip or treat as a comment.
check_plain() { # name value
  case "$2" in
    *$'\n'*|*$'\r'*) die "$1: newlines are not allowed" ;;
    *'$'*|*'"'*|*"'"*|*'`'*|*'\'*) die "$1: \$ \" ' \` and \\ are not allowed (unquoted .env value)" ;;
    *' #'*|'#'*) die "$1: '#' at the start or after a space would become a comment" ;;
    ' '*|*' ') die "$1: leading or trailing spaces are not allowed" ;;
  esac
}
ask() { # var prompt default required(1|0) hidden(1|0)
  local var=$1 prompt=$2 def=$3 req=$4 hidden=$5 v=""
  if [ -n "$def" ]; then prompt="$prompt [$def]"; fi
  printf '%s: ' "$prompt" >&2
  if [ "$hidden" = 1 ] && [ -t 0 ]; then IFS= read -rs v || true; printf '\n' >&2; else IFS= read -r v || true; fi
  [ "$hidden" = 1 ] && [ ! -t 0 ] && printf '\n' >&2
  [ -n "$v" ] || v=$def
  [ -n "$v" ] || [ "$req" = 0 ] || die "$var is required"
  [ -z "$v" ] || check_plain "$var" "$v"
  printf -v "$var" '%s' "$v"
}

printf 'First fill of %s\n(press Enter to accept a [default]; secrets are generated, not typed)\n\n' "$ENV_FILE" >&2
ask APP_DOMAIN       "APP_DOMAIN (no https://)"                   "$DEFAULT_DOMAIN" 1 0
ask EMAIL_FROM       "EMAIL_FROM (e.g. Onboardly <noreply@...>)"  ""    1 0
ask SMTP_HOST        "SMTP_HOST"                                  ""    1 0
ask SMTP_PORT        "SMTP_PORT"                                  "587" 1 0
ask SMTP_ADMIN_EMAIL "SMTP_ADMIN_EMAIL (auth email sender)"       ""    1 0
ask SMTP_USER        "SMTP_USER (optional)"                       ""    0 0
ask SMTP_PASS        "SMTP_PASS (optional, hidden)"               ""    0 1
ask SMTP_SENDER_NAME "SMTP_SENDER_NAME (optional)"                "Onboardly" 0 0

case "$APP_DOMAIN" in *://*|*/*|*' '*) die "APP_DOMAIN must be a bare host name";; esac
[[ "$SMTP_PORT" =~ ^[0-9]{2,5}$ ]] || die "SMTP_PORT must be a number"
case "$EMAIL_FROM" in *@*) ;; *) die "EMAIL_FROM must contain an email address";; esac
case "$SMTP_ADMIN_EMAIL" in *@*.*) ;; *) die "SMTP_ADMIN_EMAIL must be an email address";; esac

# --------------------------------------------------------------- secrets
POSTGRES_PASSWORD="$(openssl rand -hex 32)"
JWT_SECRET="$(openssl rand -hex 32)"
CRON_SECRET="$(openssl rand -hex 32)"
ANON_KEY="$(printf '%s\n' "$JWT_SECRET" | bash "$JWT_HELPER" anon)"
SERVICE_ROLE_KEY="$(printf '%s\n' "$JWT_SECRET" | bash "$JWT_HELPER" service_role)"
for k in POSTGRES_PASSWORD JWT_SECRET CRON_SECRET; do v="${!k}"; [[ "$v" =~ ^[0-9a-f]{64}$ ]] || die "could not generate $k"; done
unset v
for k in ANON_KEY SERVICE_ROLE_KEY; do [[ "${!k}" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]] || die "could not sign $k"; done

# ----------------------------------------------------------------- write
KEYS="APP_DOMAIN POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY CRON_SECRET EMAIL_FROM SMTP_HOST SMTP_PORT SMTP_ADMIN_EMAIL SMTP_USER SMTP_PASS SMTP_SENDER_NAME"
tmp="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
{
  printf '# Onboardly (hablu-onboarding). First fill by scripts/init-env.sh on %s.\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '# Change values with hablu-env only. Never change POSTGRES_PASSWORD or JWT_SECRET after bootstrap.\n'
  for k in $KEYS; do [ -n "${!k}" ] && printf '%s=%s\n' "$k" "${!k}"; done
} > "$tmp"
chown root:root "$tmp"
chmod 600 "$tmp"
[ ! -s "$ENV_FILE" ] || die "$ENV_FILE changed while this script ran; nothing written"
mv -f "$tmp" "$ENV_FILE"
trap - EXIT

# --------------------------------------------------------------- summary
printf '\nWrote %s (%s)\n' "$ENV_FILE" "$(stat -c '%a %U:%G' "$ENV_FILE")"
for k in $KEYS; do
  line="$(grep -m1 "^$k=" "$ENV_FILE" || true)"
  if [ -n "$line" ]; then printf '  %-18s set (%s chars)\n' "$k" "$(( ${#line} - ${#k} - 1 ))"; else printf '  %-18s not set\n' "$k"; fi
done
ok "done. Next: pwsh -File ops/deploy.ps1 -Bootstrap (from the PC)"
