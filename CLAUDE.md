# CLAUDE.md: Onboardly (ai-client-onboarding)

Handoff for any new Claude Code session. Read all of it before doing anything.
This file contains key NAMES only, never secret values. Never add values here.

## 1. Project
Onboardly is a client-onboarding SaaS. An agency sends a client one link; the client fills in forms,
uploads files, grants account access, signs an agreement and pays.
- **Stack:** Next.js 15 (App Router, React 19, TypeScript, Tailwind v4) on **self-hosted Supabase**
  (Postgres + RLS, GoTrue auth, PostgREST, Storage, Envoy gateway). pnpm.
- **Key paths:**
  - `src/` is the app;
  - `supabase/migrations/` holds the DB schema (applied in order);
  - `compose.yaml` is the production stack;
  - `deploy/supabase/` holds the vendored official Supabase files, `self-hosted/v0.8.4` (Envoy config, DB init SQL);
  - `scripts/remote-deploy.sh` runs on the host; `ops/deploy.ps1` runs on the Windows PC;
  - `scripts/gen-supabase-jwt.sh` signs the `ANON_KEY` / `SERVICE_ROLE_KEY` JWTs from `JWT_SECRET` on stdin;
  - `tests/e2e/` is the Playwright suite.
- **Local dev:** `pnpm install`, `pnpm db:start` (local Supabase via Docker), `pnpm dev`.
  Checks: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`.

## 2. Deploy rules (from the owner, follow exactly)
- **Manual deploy only.** No CI/CD, no git on the server, no GitHub involvement in deploys.
- **Access:** `ssh hablu-vps` (root, BatchMode) is the only entry point. Local PC: Windows, git + ssh/scp, NO rsync.
- **Install path:** `/srv/apps/ai-client-onboarding` (NOT under `/srv/hablu`).
  - Layout: `compose.yaml`, `.env` (root:root 0600), `REVISION`, `app/` (build context), `data/`.
  - Symlink: `/opt/apps-ai-client-onboarding` -> `/srv/apps/ai-client-onboarding`.
- `/srv/hablu/**` belongs to the Hablu LMS stack. Don't read or write it, except the ops-repo files listed in section 7.
- **Deploy = `git archive` -> `scp` to `/tmp` -> bash script on the host.** `.env` lives only on the server and is never uploaded.
- **Allowed:** read repo files, run READ-ONLY ssh/docker/compose commands, create/edit files in this repo,
  build images, run the deploy script.
- **NEVER:**
  - add `ports:` to compose;
  - modify other projects on the host (hablu-backend, hablu-frontend, hablu-staging-*,
    hablu-support-library, hablu-panel, root/traefik/n8n, langflow). They are read-only;
  - write `/srv/apps/ai-client-onboarding/.env` (not with nano, not with `cat >`). Only the host CLI `hablu-env` writes env files, and
    the OWNER runs those commands;
  - ask for, print, or store secret values. If a step needs a secret, print the exact command for the owner to run;
  - run `docker system prune -a`, `rm -rf /srv/*`, or `docker compose down` on any stack;
  - deploy the app without `--no-deps` (so db/auth/rest/storage are never recreated).
- **Standard of work:**
  - one step at a time: plan first, wait for approval, implement, then verify with REAL command output;
  - never report "done" without showing the output;
  - every service has `mem_limit`, `cpus`, `stop_grace_period` and json-file logs 10m x 3;
  - shell scripts are LF only (`.gitattributes` enforces `*.sh text eol=lf`).

## 3. Host facts (already verified, don't re-verify)
- **Server:** Docker 29.9.2, Compose v5.6.1, Ubuntu 24.04, 16 vCPU / 32 GB RAM, 502 GB free.
- **Traefik:** already runs on the shared network `root_default`. Entrypoints `web`(80) -> `websecure`(443),
  certresolver `mytlschallenge` (TLS-ALPN). ufw allows only 22/80/443.
- **App:** compose project `hablu-onboarding`, service `app`, container `hablu-onboarding-app-1`.
- **Domain:** `ai-client-onboarding.hablu-programmer.com` (DNS exists -> 103.118.16.55).

## 4. How the deploy works
- **From the PC (repo root):**
  - `pwsh -File ops/deploy.ps1` deploys HEAD; `-Sha <commit>` deploys or rolls back;
  - `-Bootstrap` is for the first install only: it also starts the database stack.
- **What `deploy.ps1` does:** `git archive <sha>` -> `scp` to `hablu-vps:/tmp/hablu-onboarding-<sha12>.tar.gz` -> runs
  `scripts/remote-deploy.sh` taken from that same tarball.
- **What `remote-deploy.sh` does on the host:**
  1. preflight: `.env` is 0600 root and has the required keys, and `root_default` exists;
  2. unpack into `app/` (the previous copy is kept in `app.prev/`), copy `compose.yaml` up one level, `compose config -q`;
  3. `--bootstrap` only: `up -d db auth rest storage gateway`;
  4. wait for db/auth/storage to be healthy, then apply new `supabase/migrations/*.sql` (tracked in
     `supabase_migrations.schema_migrations`);
  5. build `hablu-onboarding-app:<sha>`, or reuse it if it exists, which makes rollback instant; also tag it `:current`;
  6. write `REVISION`, then `up -d --no-deps app cron`;
  7. check `/api/version` == sha and `/healthz` 200, and keep the 5 newest app images.
- **Services in `compose.yaml`:**

  | service | memory | cpus | notes |
  |---|---|---|---|
  | db | 2g | 2 | supabase/postgres 17.6.1.136; `./data/db` + named volume `db-config` |
  | auth | 256m | 0.5 | gotrue v2.197.0 |
  | rest | 256m | 0.5 | postgrest v14.18 |
  | storage | 512m | 1 | storage-api v1.89.12; files in `./data/storage` |
  | gateway | 256m | 0.5 | envoy v1.39.6; joins `root_default` |
  | app | 1g | 2 | joins `root_default` |
  | cron | 32m | 0.1 | hourly reminder call to `app:3000` |

- **Routing:** Traefik sends `Host(domain) && PathPrefix(/auth/v1|/rest/v1|/storage/v1)` (priority 100)
  to `gateway`, and everything else to `app`. Studio and the meta API are not deployed and not routed.
- **Endpoints:** `/healthz` (200 = app + DB ok), `/api/version` -> `{"revision":"<sha12>"}`.
- **Rollback:** `pwsh -File ops/deploy.ps1 -Sha <old>`. The old image is reused and the DB is untouched (migrations only go
  forward).

## 5. Required `.env` keys (names only; the owner sets them with hablu-env)
- **Required:** `APP_DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `CRON_SECRET`, `EMAIL_FROM`,
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_ADMIN_EMAIL`.
- **Optional:** `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_NAME`, `NEXT_PUBLIC_APP_NAME`, `RESEND_API_KEY`,
  `ANTHROPIC_API_KEY`, `AI_MODEL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOLO|AGENCY|SCALE`.
- `ANON_KEY` and `SERVICE_ROLE_KEY` are JWTs signed with `JWT_SECRET`: `printf '%s\n' "$JWT" | bash gen-supabase-jwt.sh anon`
  (or `service_role`).
- **Never change `POSTGRES_PASSWORD` or `JWT_SECRET` after the first bootstrap:** the database is initialised with them.

## 6. Status (LIVE on hablu-vps since 2026-11-10, revision e398e3c6bdab)
- **Install:** `/srv/apps/ai-client-onboarding` (+ `/opt` symlink). `.env` was first filled by
  `scripts/init-env.sh` (owner, on the host), because hablu-env cannot write an empty `.env` before the
  first deploy (it runs `compose config` and recreates `app` on every write). From now on: hablu-env only.
- **Verified on the real host (2026-11-10):**
  - bootstrap deploy, 3 migrations applied, 7/7 up (6 healthy; cron has no healthcheck);
  - `/healthz` 200 and `/api/version` == `REVISION` via Traefik; http->https 301; landing page 200;
  - Let's Encrypt cert (issuer YR2), valid until 2027-02-08;
  - `/auth/v1/health` 200 and `/storage/v1/status` 200 (auth needs the `apikey` header, 401 without);
    `/rest/v1` reaches Postgres (anon is denied by design: migration 2 revokes anon on public tables);
  - Studio/meta not routed (`/pg/` -> app 404);
  - only app and gateway on `root_default`; no host ports; limits and json-file 10m x 3 on all 7;
  - normal redeploy recreated only `app`; the 11 other containers kept the same IDs;
  - `ops/deploy.ps1` works on Windows (pwsh 7.6).
- **Bug fixed on the real host:** `remote-deploy.sh` image cleanup failed with pipefail when there were no
  old images (first install); fixed in e398e3c.
- **UNVERIFIED:** real SMTP delivery (`.env` has `SMTP_PASS` but no `SMTP_USER`); sign-up flow on the real
  host; rollback on the real host (done in the sandbox only); DB backups (not implemented).

## 7. Next steps (owner runs host commands; verify each with real output)
1. Owner: add this hablu-env allowlist line in the OPS repo (`/etc/hablu-env.conf`), so `.env` can be edited:
   `onboarding|/srv/apps/ai-client-onboarding|compose.yaml|app|.env|mode=interp,rebuild=allow`
   Then `hablu-env set onboarding KEY` changes a value (hidden input, recreates `app`).
2. Check SMTP: `SMTP_USER` is missing; add it with `hablu-env add onboarding SMTP_USER` if the server needs login,
   then test a sign-up email.
3. Later, only when the owner asks, OPS-repo updates for the new root `/srv/apps`:
   - hablu-env doctor/prune `find` roots;
   - hablu-env-uninstall `ENV_DIRS`;
   - hablu-status dir list;
   - config-backup tar path (`.env` and `compose.yaml`).
4. Later: DB + storage backups (`pg_dump` as `supabase_admin`, plus a tar of `data/storage`).
