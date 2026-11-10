-- =============================================================================
-- Core schema: workspaces, members, clients, flow templates, onboarding
-- requests and everything a client submits through the portal.
--
-- Every business table carries workspace_id and is protected by Row Level
-- Security. Agency users reach data through RLS. The public client portal never
-- uses an authenticated Supabase session: it goes through server code that
-- verifies a hashed magic-link token and then uses the service role, scoped to
-- that single request.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums ----
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.plan_tier as enum ('free', 'solo', 'agency', 'scale');
create type public.step_type as enum ('form', 'files', 'access', 'agreement', 'payment');
create type public.request_status as enum ('draft', 'sent', 'in_progress', 'completed', 'cancelled');
create type public.step_status as enum ('not_started', 'in_progress', 'completed');
create type public.document_status as enum ('pending', 'approved', 'rejected');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');
create type public.actor_type as enum ('member', 'client', 'system');

-- ---------------------------------------------------- shared trigger fns ----
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------- workspaces ----
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  logo_url text,
  brand_color text not null default '#4f46e5' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  support_email text,
  website text,
  welcome_message text,
  -- Default reminder cadence for new requests.
  reminder_interval_days int not null default 3 check (reminder_interval_days between 1 and 30),
  max_reminders int not null default 4 check (max_reminders between 0 and 20),
  -- Plans / billing (SaaS subscription for the agency itself)
  plan public.plan_tier not null default 'free',
  billing_customer_id text,
  billing_subscription_id text,
  billing_status text,
  -- Payment collection from the agency's clients (Stripe Connect)
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  current_workspace_id uuid references public.workspaces (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------- membership helpers ----
-- SECURITY DEFINER so policies can call them without recursive RLS checks.
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(ws uuid, roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

-- Atomically create a workspace and make the caller its owner.
create or replace function public.create_workspace(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ws_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.workspaces (name, slug, created_by)
  values (p_name, lower(p_slug), auth.uid())
  returning id into ws_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, auth.uid(), 'owner');
  update public.profiles set current_workspace_id = ws_id where id = auth.uid();
  return ws_id;
end $$;
revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

-- -------------------------------------------------------------- clients ----
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  company text,
  phone text,
  website text,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_workspace_idx on public.clients (workspace_id, created_at desc);
create unique index clients_workspace_email_idx on public.clients (workspace_id, lower(email));
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_name text,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index client_notes_client_idx on public.client_notes (client_id, created_at desc);

-- ------------------------------------------------------ flow templates ----
-- Steps live in an ordered JSONB array, validated by Zod on the server
-- (see src/lib/flows/schema.ts). Requests copy them into request_steps when
-- they are created, so editing a template never breaks in-flight onboarding.
create table public.flow_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  category text,
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  source text not null default 'blank' check (source in ('blank', 'starter', 'ai', 'duplicate')),
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flow_templates_workspace_idx on public.flow_templates (workspace_id, updated_at desc);
create trigger flow_templates_updated_at before update on public.flow_templates
  for each row execute function public.set_updated_at();

create table public.agreement_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  body text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agreement_templates_workspace_idx on public.agreement_templates (workspace_id);
create trigger agreement_templates_updated_at before update on public.agreement_templates
  for each row execute function public.set_updated_at();

-- -------------------------------------------------- onboarding requests ----
create table public.onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  template_id uuid references public.flow_templates (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  message text,
  status public.request_status not null default 'draft',
  due_date date,
  sent_at timestamptz,
  completed_at timestamptz,
  last_client_activity_at timestamptz,
  -- Reminders
  reminders_enabled boolean not null default true,
  reminder_interval_days int not null default 3 check (reminder_interval_days between 1 and 30),
  max_reminders int not null default 4 check (max_reminders between 0 and 20),
  reminders_sent int not null default 0,
  next_reminder_at timestamptz,
  -- AI outputs (drafts, always reviewed by a human)
  ai_summary text,
  ai_summary_at timestamptz,
  ai_brief text,
  ai_brief_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onboarding_requests_workspace_idx on public.onboarding_requests (workspace_id, status, created_at desc);
create index onboarding_requests_client_idx on public.onboarding_requests (client_id);
create index onboarding_requests_reminder_idx on public.onboarding_requests (next_reminder_at)
  where reminders_enabled and status in ('sent', 'in_progress');
create trigger onboarding_requests_updated_at before update on public.onboarding_requests
  for each row execute function public.set_updated_at();

create table public.request_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.onboarding_requests (id) on delete cascade,
  position int not null,
  type public.step_type not null,
  title text not null,
  description text,
  required boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  -- Client answers for form steps, confirmations for access steps.
  data jsonb not null default '{}'::jsonb,
  status public.step_status not null default 'not_started',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, position)
);
create index request_steps_request_idx on public.request_steps (request_id, position);
create trigger request_steps_updated_at before update on public.request_steps
  for each row execute function public.set_updated_at();

-- Magic links: only the SHA-256 hash of the token is stored.
create table public.magic_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.onboarding_requests (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index magic_links_request_idx on public.magic_links (request_id);

-- ------------------------------------------------------------ documents ----
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.onboarding_requests (id) on delete cascade,
  step_id uuid not null references public.request_steps (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  item_key text not null,           -- which requested document this fulfils
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  status public.document_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  replaced_at timestamptz,          -- set when the client re-uploads after a rejection
  uploaded_at timestamptz not null default now()
);
create index documents_request_idx on public.documents (request_id, uploaded_at desc);
create index documents_client_idx on public.documents (client_id);

-- ----------------------------------------------------------- signatures ----
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.onboarding_requests (id) on delete cascade,
  step_id uuid not null unique references public.request_steps (id) on delete cascade,
  signer_name text not null,
  signer_email text not null,
  signature_type text not null check (signature_type in ('typed', 'drawn')),
  signature_data text not null,     -- typed name or PNG data URL
  agreement_title text not null,
  agreement_body text not null,     -- the exact text that was signed
  document_hash text not null,      -- SHA-256 of agreement_body
  consent_text text not null,
  ip_address text,
  user_agent text,
  pdf_path text,
  signed_at timestamptz not null default now()
);
create index signatures_request_idx on public.signatures (request_id);

-- ------------------------------------------------------------- payments ----
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.onboarding_requests (id) on delete cascade,
  step_id uuid not null references public.request_steps (id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'usd',
  description text,
  status public.payment_status not null default 'unpaid',
  provider text not null default 'stripe',
  provider_account_id text,
  checkout_session_id text unique,
  payment_intent_id text,
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_request_idx on public.payments (request_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Stripe webhook idempotency
create table public.processed_webhook_events (
  id text primary key,
  provider text not null,
  type text not null,
  processed_at timestamptz not null default now()
);

-- ------------------------------------------------------------- comments ----
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null references public.onboarding_requests (id) on delete cascade,
  step_id uuid references public.request_steps (id) on delete set null,
  author_type public.actor_type not null,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 4000),
  read_by_agency_at timestamptz,
  created_at timestamptz not null default now()
);
create index comments_request_idx on public.comments (request_id, created_at);

-- ------------------------------------------------- notifications & logs ----
create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid references public.onboarding_requests (id) on delete cascade,
  kind text not null check (kind in ('invitation', 'reminder', 'manual_reminder', 'completed', 'agency_alert')),
  channel text not null default 'email',
  recipient text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider text,
  provider_message_id text,
  error text,
  triggered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index notifications_log_request_idx on public.notifications_log (request_id, created_at desc);
create index notifications_log_workspace_idx on public.notifications_log (workspace_id, created_at desc);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid references public.onboarding_requests (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  actor_type public.actor_type not null,
  actor_id uuid,
  actor_name text,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_events_workspace_idx on public.activity_events (workspace_id, created_at desc);
create index activity_events_request_idx on public.activity_events (request_id, created_at desc);
create index activity_events_client_idx on public.activity_events (client_id, created_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  actor_type public.actor_type not null,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  ip_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_workspace_idx on public.audit_log (workspace_id, created_at desc);

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  model text,
  input_chars int,
  output jsonb,
  created_at timestamptz not null default now()
);
create index ai_generations_workspace_idx on public.ai_generations (workspace_id, created_at desc);

-- ----------------------------------------------------------- rate limit ----
create table public.rate_limits (
  key text primary key,
  count int not null,
  window_start timestamptz not null
);

-- Returns true when the call is allowed. Fixed window, atomic upsert.
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_count int;
begin
  insert into public.rate_limits as r (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into current_count;
  return current_count <= p_limit;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Lets PostgREST embed a member's profile (both reference auth.users).
alter table public.workspace_members
  add constraint workspace_members_profile_fk foreign key (user_id) references public.profiles (id) on delete cascade;
