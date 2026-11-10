#!/usr/bin/env bash
# Prints a Supabase API key (HS256 JWT, valid 10 years) for ROLE, signed with the
# JWT secret read from STDIN. Prints only the token; pipe it into hablu-env.
#   usage: <jwt-secret on stdin> | bash gen-supabase-jwt.sh anon|service_role
set -euo pipefail
role="${1:-}"
case "$role" in anon|service_role) ;; *) echo "usage: ... | gen-supabase-jwt.sh anon|service_role" >&2; exit 2;; esac
IFS= read -r secret || true
[ "${#secret}" -ge 32 ] || { echo "JWT secret on stdin must be at least 32 characters" >&2; exit 1; }
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
now="$(date +%s)"; exp=$((now + 10 * 365 * 24 * 3600))
header="$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)"
payload="$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$role" "$now" "$exp" | b64url)"
sig="$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$secret" -binary | b64url)"
printf '%s.%s.%s\n' "$header" "$payload" "$sig"
