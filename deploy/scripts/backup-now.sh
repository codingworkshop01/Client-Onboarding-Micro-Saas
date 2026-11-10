#!/usr/bin/env bash
# Take a backup right now (same as the daily one). Files land in deploy/backups/.
source "$(dirname "$0")/lib.sh"
docker exec onboardly-backup /bin/sh /scripts/backup.sh
ls -lh "$DEPLOY/backups" | tail -4
