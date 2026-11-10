-- =============================================================================
-- Row Level Security. Agency users only ever see rows from workspaces they
-- belong to. Rows a client creates through the portal (documents, signatures,
-- payments) are inserted by server code using the service role after the
-- magic-link token has been verified, so authenticated users cannot forge them.
-- =============================================================================

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_notes enable row level security;
alter table public.flow_templates enable row level security;
alter table public.agreement_templates enable row level security;
alter table public.onboarding_requests enable row level security;
alter table public.request_steps enable row level security;
alter table public.magic_links enable row level security;
alter table public.documents enable row level security;
alter table public.signatures enable row level security;
alter table public.payments enable row level security;
alter table public.processed_webhook_events enable row level security;
alter table public.comments enable row level security;
alter table public.notifications_log enable row level security;
alter table public.activity_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.ai_generations enable row level security;
alter table public.rate_limits enable row level security;

-- The anonymous role never reads application tables directly.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------- workspaces ----
create policy "members read workspace" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy "admins update workspace" on public.workspaces
  for update to authenticated
  using (public.has_workspace_role(id, array['owner','admin']::public.member_role[]))
  with check (public.has_workspace_role(id, array['owner','admin']::public.member_role[]));
create policy "owners delete workspace" on public.workspaces
  for delete to authenticated using (public.has_workspace_role(id, array['owner']::public.member_role[]));

-- Billing and payment-connection columns are only written by trusted server code.
-- (a column-level revoke does not override a table-level grant, so we revoke
-- table-wide UPDATE and grant back only the editable columns)
revoke update on public.workspaces from authenticated;
grant update (name, slug, logo_url, brand_color, support_email, website, welcome_message,
              reminder_interval_days, max_reminders)
  on public.workspaces to authenticated;

create policy "members read memberships" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "admins manage memberships" on public.workspace_members
  for all to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]));

-- ------------------------------------------------------------- profiles ----
create policy "read own and teammates profiles" on public.profiles
  for select to authenticated using (
    id = auth.uid() or exists (
      select 1 from public.workspace_members a
      join public.workspace_members b on a.workspace_id = b.workspace_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (
    id = auth.uid()
    and (current_workspace_id is null or public.is_workspace_member(current_workspace_id))
  );

-- --------------------------------------- generic workspace-scoped tables ----
-- Members can read and write; destructive actions on clients and requests
-- are limited to owners and admins.
do $$
declare
  t text;
begin
  foreach t in array array['clients','flow_templates','agreement_templates','onboarding_requests'] loop
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using (public.is_workspace_member(workspace_id))', t);
    execute format('create policy "members insert %1$s" on public.%1$I for insert to authenticated with check (public.is_workspace_member(workspace_id))', t);
    execute format('create policy "members update %1$s" on public.%1$I for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))', t);
  end loop;
end $$;

create policy "admins delete clients" on public.clients
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]));
create policy "admins delete requests" on public.onboarding_requests
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]));
create policy "members delete templates" on public.flow_templates
  for delete to authenticated using (public.is_workspace_member(workspace_id));
create policy "members delete agreements" on public.agreement_templates
  for delete to authenticated using (public.is_workspace_member(workspace_id));

-- request steps: members manage them (agency side edits, e.g. reopening a step)
create policy "members read steps" on public.request_steps
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members insert steps" on public.request_steps
  for insert to authenticated with check (
    public.is_workspace_member(workspace_id)
    and exists (select 1 from public.onboarding_requests r where r.id = request_id and r.workspace_id = request_steps.workspace_id)
  );
create policy "members update steps" on public.request_steps
  for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members delete steps" on public.request_steps
  for delete to authenticated using (public.is_workspace_member(workspace_id));

-- client notes: authors write their own
create policy "members read notes" on public.client_notes
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members write notes" on public.client_notes
  for insert to authenticated with check (public.is_workspace_member(workspace_id) and author_id = auth.uid());
create policy "authors delete notes" on public.client_notes
  for delete to authenticated using (public.is_workspace_member(workspace_id) and author_id = auth.uid());

-- magic links
create policy "members read links" on public.magic_links
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members create links" on public.magic_links
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "members revoke links" on public.magic_links
  for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- documents: clients upload via server; members review
create policy "members read documents" on public.documents
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members review documents" on public.documents
  for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "admins delete documents" on public.documents
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]));

-- signatures & payments are read-only for members (written by trusted server code)
create policy "members read signatures" on public.signatures
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read payments" on public.payments
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- comments
create policy "members read comments" on public.comments
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members write comments" on public.comments
  for insert to authenticated with check (
    public.is_workspace_member(workspace_id) and author_type = 'member' and author_id = auth.uid()
  );
create policy "members mark comments read" on public.comments
  for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

-- logs
create policy "members read notifications" on public.notifications_log
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read activity" on public.activity_events
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members write activity" on public.activity_events
  for insert to authenticated with check (
    public.is_workspace_member(workspace_id) and actor_type = 'member' and actor_id = auth.uid()
  );
create policy "admins read audit" on public.audit_log
  for select to authenticated using (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]));
create policy "members read ai generations" on public.ai_generations
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- processed_webhook_events and rate_limits: service role only (no policies).

-- ------------------------------------------------------------- storage ----
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-files', 'client-files', false, 52428800)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- Object paths always start with the workspace id: <workspace_id>/...
create policy "members read client files" on storage.objects
  for select to authenticated using (
    bucket_id = 'client-files'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

create policy "admins upload branding" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'branding'
    and public.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner','admin']::public.member_role[])
  );
create policy "admins update branding" on storage.objects
  for update to authenticated using (
    bucket_id = 'branding'
    and public.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner','admin']::public.member_role[])
  );
create policy "admins delete branding" on storage.objects
  for delete to authenticated using (
    bucket_id = 'branding'
    and public.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner','admin']::public.member_role[])
  );
