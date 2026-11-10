# Onboardly: one link, complete client onboarding

A client onboarding SaaS for agencies and freelancers. Send a client one branded link and they complete everything in a single flow:

**Questions → Files → Account access → Agreement & e-signature → Payment → Ready to start.**

> The product name is set by `NEXT_PUBLIC_APP_NAME`, so you can rename it without touching code.

## What works today

| Area | Status |
|---|---|
| Auth: sign up, sign in, sign out, password reset | ✅ Supabase Auth |
| Workspaces: owner/admin/member roles, branding, logo upload, workspace switcher | ✅ |
| Dashboard: stats, completion rate, overdue, needs-attention, activity feed, ⌘K search | ✅ |
| Flow builder: 5 step types, drag-to-reorder, duplicate, required/optional, live client preview | ✅ |
| Smart forms: 11 field types, conditional logic (chained), validation, autosave | ✅ |
| Client portal: magic link (no login), mobile-first, progress, resume anytime, comments | ✅ |
| Documents: per-slot file rules, direct-to-storage uploads, preview, approve/reject with reason, re-upload | ✅ |
| Account access: guides for Meta, Facebook Pages, GA, Google Ads, Search Console, WordPress, Shopify, hosting; client confirmation; **no passwords collected** | ✅ |
| E-signature: typed or drawn, consent disclosure, signed PDF with audit certificate (IP, user agent, SHA-256) | ✅ |
| Payments: Stripe Connect checkout, webhook + server-side confirmation, receipts; record offline payments | ✅ code complete, needs Stripe keys |
| Emails: invitations, automatic reminders (stop on completion), manual reminders, reply notifications, full send log | ✅ (Mailpit locally, Resend in production) |
| AI: Request Builder (proposal → flow), answer summary, vague-answer check, reminder drafts, kickoff brief | ✅ code complete, needs `ANTHROPIC_API_KEY` |
| 10 starter templates, agreement library with merge fields | ✅ |
| Clients: profiles, history, files, agreements, payments, internal notes, timeline | ✅ |
| Export: ZIP (all files + signed PDFs + answers) and CSV per onboarding | ✅ |
| Plans: Free / Solo / Agency / Scale limits enforced; Stripe Billing checkout + portal | ✅ limits enforced, billing needs Stripe keys |

Nothing pretends to succeed. Without a provider key, a feature shows a clear **"not configured"** state. Emails are logged as `skipped`, payment steps tell the client online payment isn't available, and AI buttons explain how to enable it.

## Tech stack

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui-style components on Radix · Supabase (Postgres + RLS, Auth, Storage) · Zod · React Hook Form · dnd-kit · pdf-lib · Resend / SMTP · Anthropic Claude · Stripe · Playwright

## Run it locally

Requirements: Node 20+, pnpm, Docker.

```bash
pnpm install
```

```bash
pnpm db:start
```

`pnpm db:start` runs Supabase locally (Postgres, Auth, Storage, and the Mailpit email inbox). It prints your local keys. Copy `.env.example` to `.env.local` and paste in `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`.

```bash
cp .env.example .env.local
```

```bash
pnpm db:reset
```

```bash
pnpm dev
```

Open http://localhost:3000 and create an account. Emails sent locally land in Mailpit at http://127.0.0.1:54324.

Optional demo data (local only; refuses to run against a remote database):

```bash
pnpm seed:demo
```

Then sign in with `demo@example.com` / `demo-password-123`.

> If Docker can't pull Supabase images from `public.ecr.aws`, use Docker Hub instead: `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io pnpm db:start`.

## Environment variables

See `.env.example` for the full list.

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Everything |
| `NEXT_PUBLIC_APP_URL` | Links in emails, Stripe return URLs |
| `RESEND_API_KEY`, `EMAIL_FROM` | Production email (otherwise `SMTP_HOST`/`SMTP_PORT`) |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | AI features (default model `claude-opus-5-5`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Client payments (Stripe Connect) |
| `STRIPE_PRICE_SOLO/AGENCY/SCALE` | Your own subscription plans |
| `CRON_SECRET` | Protects `/api/cron/reminders` |

The service-role key and all provider keys are only read in server code (`import "server-only"`). Nothing secret reaches the browser.

## Moving to hosted Supabase

1. Create a project at supabase.com.
2. Link it and push the migrations:
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   ```bash
   npx supabase db push
   ```
3. Put the project URL, anon key and service-role key in your hosting environment variables.
4. In Supabase → Auth → URL configuration, set the Site URL to your domain and add `https://YOUR_DOMAIN/auth/callback` to the redirect URLs.
5. In Supabase → Auth → SMTP, configure a real sender (e.g. Resend SMTP) for sign-up and reset emails.

## Turning on Stripe later

1. Enable **Connect** in your Stripe dashboard (Standard accounts).
2. Set `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint at `https://YOUR_DOMAIN/api/webhooks/stripe` that listens to events on **your account and connected accounts**:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `account.updated`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Optionally create three recurring prices and set `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_AGENCY`, `STRIPE_PRICE_SCALE`.
6. Each agency then clicks **Settings → Payments → Connect Stripe**.

Payments are marked paid only from data Stripe confirms: a verified webhook, or a server-side lookup of the Checkout Session when the client returns. Webhooks are idempotent (`processed_webhook_events`).

## Reminders

`GET /api/cron/reminders` with header `Authorization: Bearer $CRON_SECRET` sends every due reminder. `vercel.json` schedules it hourly on Vercel; any scheduler works elsewhere. Reminders stop automatically on completion, cancellation, or after the per-onboarding maximum.

## Architecture

```
src/
  app/
    (auth)/            sign in, sign up, password reset (server actions)
    (app)/             agency app: dashboard, requests, clients, templates, agreements, settings
    p/[token]/         public client portal + its server actions
    api/               cron, Stripe webhook, file downloads, exports
  components/
    ui/                design-system primitives (Radix + Tailwind)
    builder/           flow builder, step editors, field editor with conditions
    portal/            client portal UI, shared by live portal and builder preview
  lib/
    flows/             step/field schemas (Zod), conditional logic, starter templates, access guides
    ai/                Claude integration (drafts only), quotas
    email/             provider abstraction (Resend/SMTP), templates, logged sends
    requests.ts        snapshotting, completion engine
    portal.ts          magic-link resolution, portal data loader
    stripe.ts          Connect checkout, billing, confirmation
    pdf.ts             signed agreement + audit certificate
supabase/migrations/   schema, RLS policies, storage buckets
tests/e2e/             Playwright: full onboarding flow, builder, security/RLS
```

Key design decisions:

- **Requests snapshot their template.** Editing or deleting a template never changes an onboarding already sent.
- **The portal has no Supabase session.** Each portal action re-checks the magic-link token (stored only as a SHA-256 hash, expires after 60 days, revocable). It then uses the service role scoped to that one request.
- **Rows a client creates (signatures, payments) can't be written by agency users.** RLS gives members read-only access, so signatures and payment status can't be forged from the dashboard.
- **Uploads go straight to private storage** through short-lived signed upload URLs. The server then checks the real stored size and type before recording the file. Downloads use 60-second signed URLs.
- **AI never acts on its own.** It returns drafts. Sending, approving and saving always need a human click.

## Security checklist

- Row Level Security on every table; workspace isolation tested in `tests/e2e/security.spec.ts`
- Role checks: owners/admins for settings, billing, deletions, offline payments
- Hashed, expiring, revocable magic links; `noindex` + `no-referrer` on the portal
- Postgres-backed rate limiting on login, sign-up, reset, portal actions and AI
- File validation: allow-lists by category, blocked executable extensions, server-side size checks
- Private storage buckets and short-lived signed URLs
- Stripe webhook signature verification and idempotency
- Audit log for signing, approvals, link creation and revocation, deletions, offline payments
- CSV export guards against formula injection
- E-signature disclosure doesn't claim universal legal validity

## Tests

Requires local Supabase running.

```bash
pnpm test:e2e
```

```bash
pnpm typecheck
```

```bash
pnpm lint
```

## Roadmap

Built so these can be added without restructuring:

- Team invitations and assignments
- Google Drive export
- Encrypted credential vault
- WhatsApp/SMS reminders
- One-click Meta/Google OAuth access
- Zapier/Make/webhooks
- Multiple client stakeholders
- Multi-language portal
- Custom domains
- Analytics
