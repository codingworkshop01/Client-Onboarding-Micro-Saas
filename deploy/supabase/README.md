# Vendored Supabase self-hosting files

Copied unchanged from the official Supabase repo, tag `self-hosted/v0.8.4`
(`docker/volumes/api/envoy/*`, `docker/volumes/db/roles.sql`, `docker/volumes/db/jwt.sql`).
They are mounted read-only by `compose.yaml`. To upgrade, copy the same files from a newer
tag and bump the image versions in `compose.yaml` to that tag's `docker-compose.yml`.
