-- =============================================================================
-- Team invitations. Only the SHA-256 hash of the invite token is stored.
-- Accepting an invite is done by trusted server code (service role) after it
-- checks the token, expiry, and that the signed-in user's email matches.
-- =============================================================================

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (char_length(email) <= 254),
  role public.member_role not null default 'member' check (role in ('admin', 'member')),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index workspace_invitations_workspace_idx on public.workspace_invitations (workspace_id, created_at desc);
-- At most one open invitation per email per workspace.
create unique index workspace_invitations_open_idx on public.workspace_invitations (workspace_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.workspace_invitations enable row level security;
revoke all on public.workspace_invitations from anon;

create policy "members read invitations" on public.workspace_invitations
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "admins create invitations" on public.workspace_invitations
  for insert to authenticated with check (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]) and invited_by = auth.uid()
  );
create policy "admins update invitations" on public.workspace_invitations
  for update to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]));
create policy "admins delete invitations" on public.workspace_invitations
  for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]));
