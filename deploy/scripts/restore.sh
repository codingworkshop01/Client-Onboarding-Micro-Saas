#!/usr/bin/env bash
# Restore data from a backup into the running stack (same or a fresh server).
#   ./deploy/scripts/restore.sh deploy/backups/db-YYYYMMDD-HHMMSS.dump [deploy/backups/files-YYYYMMDD-HHMMSS.tar.gz]
# Run deploy.sh first so the database schema is up to date.
# WARNING: replaces ALL current app data (users, workspaces, onboardings, files).
source "$(dirname "$0")/lib.sh"

DUMP="${1:-}"; FILES="${2:-}"
[ -f "$DUMP" ] || die "Usage: restore.sh <db-*.dump> [files-*.tar.gz]"
[ -z "$FILES" ] || [ -f "$FILES" ] || die "Files backup not found: $FILES"
PGPASS="$(get_env POSTGRES_PASSWORD "$STACK_ENV")"

if [ "${FORCE:-}" != "1" ]; then
  read -r -p "This replaces ALL current data with the backup. Type 'restore' to continue: " answer
  [ "$answer" = "restore" ] || die "Cancelled"
fi

info "Stopping the app while restoring"
app_compose stop app cron >/dev/null

info "Restoring database"
docker cp "$DUMP" "$DB_CONTAINER:/tmp/restore.dump"
admin_psql() { docker exec -i -e PGPASSWORD="$PGPASS" "$DB_CONTAINER" psql -h localhost -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
admin_psql <<'SQL'
do $$
declare t text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ') into t
  from pg_tables
  where schemaname in ('public', 'auth', 'storage', 'supabase_migrations')
    and not (schemaname = 'auth' and tablename = 'schema_migrations')
    and not (schemaname = 'storage' and tablename = 'migrations');
  if t is not null then execute 'truncate ' || t || ' cascade'; end if;
end $$;
SQL
docker exec -e PGPASSWORD="$PGPASS" "$DB_CONTAINER" pg_restore -h localhost -U supabase_admin -d postgres \
  --data-only --disable-triggers --no-owner \
  -n public -n auth -n storage -n supabase_migrations /tmp/restore.dump
docker exec "$DB_CONTAINER" rm -f /tmp/restore.dump
ok "Database restored"

if [ -n "$FILES" ]; then
  info "Restoring uploaded files"
  STORAGE_DIR="$STACK/volumes/storage"
  find "$STORAGE_DIR" -mindepth 1 -delete
  tar -xzf "$FILES" -C "$STORAGE_DIR"
  ok "Files restored"
fi

info "Starting the app"
app_compose start app cron >/dev/null
wait_healthy onboardly-app 120
ok "Restore complete"
