#!/usr/bin/env bash
# Nightly backup of Onboardly on hablu-vps. Runs ON THE HOST as root.
# remote-deploy.sh installs it as /srv/apps/ai-client-onboarding/backup.sh (0700), so a rollback
# to an older commit never removes it. Cron (/etc/cron.d/hablu-onboarding-backup):
#   0 22 * * * root /srv/apps/ai-client-onboarding/backup.sh >> /srv/apps/ai-client-onboarding/backups/backup.log 2>&1
#
#   backup.sh          take a backup, then apply retention
#   backup.sh --list   list existing backups
#
# One run writes four files to $ROOT/backups (dir 0700, files 0600):
#   db-<ts>.dump          pg_dump -Fc of the whole `postgres` DB as supabase_admin (public, auth, storage, ...)
#   roles-<ts>.sql        pg_dumpall --roles-only (role password hashes: treat as secret)
#   storage-<ts>.tar.gz   uploaded files (data/storage)
#   config-<ts>.tar.gz    .env, compose.yaml, REVISION (contains secrets)
# The DB password is read inside the db container from its own env, never from argv or the screen.
# Same disk as the data: this protects against mistakes and bad migrations, not against losing the disk.
set -Eeuo pipefail
umask 077

ROOT="${APP_ROOT:-/srv/apps/ai-client-onboarding}"
DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PROJECT="hablu-onboarding"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "FAILED: $*" >&2; exit 1; }

mkdir -p "$DIR"
chmod 700 "$DIR"

if [ "${1:-}" = "--list" ]; then
  ls -lht "$DIR" | grep -E ' (db|roles|storage|config)-' | head -20 || echo "(no backups yet)"
  exit 0
fi
[ $# -eq 0 ] || die "usage: backup.sh [--list]"
[ "$(id -u)" = 0 ] || die "run as root"

exec 9>"$DIR/.lock"
flock -n 9 || die "another backup is running"

db="$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=db")"
[ -n "$db" ] || die "db container of $PROJECT is not running"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
work="$DIR/.partial-$ts"
mkdir "$work"
trap 'rm -rf "$work"' EXIT

pg() { docker exec "$db" sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" "$@"' sh "$@"; }
min_size() { # file bytes label
  local n; n="$(stat -c %s "$1")"
  [ "$n" -ge "$2" ] || die "$3 is only $n bytes (expected >= $2); nothing kept"
}

log "start $ts"

pg pg_dump -h localhost -U supabase_admin -d postgres -Fc > "$work/db-$ts.dump"
min_size "$work/db-$ts.dump" 10240 "db dump"
tables="$(docker exec -i "$db" pg_restore --list < "$work/db-$ts.dump" | grep -c 'TABLE DATA ' || true)"
[ "$tables" -gt 0 ] || die "db dump has no table data"

pg pg_dumpall -h localhost -U supabase_admin --roles-only > "$work/roles-$ts.sql"
grep -q '^CREATE ROLE' "$work/roles-$ts.sql" || die "roles dump has no CREATE ROLE"

tar -czf "$work/storage-$ts.tar.gz" -C "$ROOT/data" storage
tar -tzf "$work/storage-$ts.tar.gz" >/dev/null || die "storage archive is unreadable"

tar -czf "$work/config-$ts.tar.gz" -C "$ROOT" .env compose.yaml REVISION
tar -tzf "$work/config-$ts.tar.gz" >/dev/null || die "config archive is unreadable"

chmod 600 "$work"/*
mv "$work"/* "$DIR"/

removed="$(find "$DIR" -maxdepth 1 -type f -regextype posix-extended \
  -regex '.*/(db|roles|storage|config)-[0-9]{8}T[0-9]{6}Z\.(dump|sql|tar\.gz)' -mtime +"$KEEP_DAYS" -print -delete | wc -l)"

size() { du -h "$DIR/$1" | cut -f1; }
log "OK $ts db=$(size "db-$ts.dump") ($tables tables) roles=$(size "roles-$ts.sql") storage=$(size "storage-$ts.tar.gz") config=$(size "config-$ts.tar.gz") removed_old=$removed kept_days=$KEEP_DAYS"
