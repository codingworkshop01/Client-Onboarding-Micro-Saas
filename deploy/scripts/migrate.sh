#!/usr/bin/env bash
# Apply supabase/migrations/*.sql that haven't run yet. Each file runs in one
# transaction and is recorded in supabase_migrations.schema_migrations (the same
# table the Supabase CLI uses), so every migration runs exactly once.
source "$(dirname "$0")/lib.sh"

PGPASS="$(get_env POSTGRES_PASSWORD "$STACK_ENV")"
[ -n "$PGPASS" ] || die "Run setup-supabase.sh first"
psql_db() { docker exec -i -e PGPASSWORD="$PGPASS" "$DB_CONTAINER" psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

psql_db -c "create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);" >/dev/null

applied=0
for file in "$ROOT"/supabase/migrations/*.sql; do
  base="$(basename "$file" .sql)"
  version="${base%%_*}"
  name="${base#*_}"
  [[ "$version" =~ ^[0-9]+$ ]] || die "Unexpected migration file name: $base"
  if [ "$(psql_db -Atc "select 1 from supabase_migrations.schema_migrations where version = '$version'")" = "1" ]; then
    continue
  fi
  info "Applying $base"
  { echo "begin;"; cat "$file"; echo; echo "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name');"; echo "commit;"; } | psql_db >/dev/null
  applied=$((applied + 1))
done
ok "Database is up to date ($applied new migration(s))"
