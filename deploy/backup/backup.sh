#!/bin/sh
# Runs inside the onboardly-backup container (daily via crond).
# Writes db-<timestamp>.dump (Postgres custom format) and files-<timestamp>.tar.gz.
set -eu
ts="$(date +%Y%m%d-%H%M%S)"
out=/backups
mkdir -p "$out"

echo "[$(date)] backup started"
pg_dump -Fc \
  -n public -n auth -n storage -n supabase_migrations \
  --exclude-table-data=auth.schema_migrations \
  --exclude-table-data=storage.migrations \
  -f "$out/db-$ts.dump.partial"
mv "$out/db-$ts.dump.partial" "$out/db-$ts.dump"

tar -czf "$out/files-$ts.tar.gz.partial" -C /storage .
mv "$out/files-$ts.tar.gz.partial" "$out/files-$ts.tar.gz"

find "$out" -maxdepth 1 \( -name 'db-*.dump' -o -name 'files-*.tar.gz' \) -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete
echo "[$(date)] backup finished: db-$ts.dump ($(du -h "$out/db-$ts.dump" | cut -f1)), files-$ts.tar.gz ($(du -h "$out/files-$ts.tar.gz" | cut -f1))"
