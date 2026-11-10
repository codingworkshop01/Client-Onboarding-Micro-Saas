import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/tokens";

type MemberRole = "admin" | "member";
export type InviteLookup =
  | { state: "invalid" }
  | { state: "expired" | "accepted" | "revoked"; workspaceName: string }
  | { state: "open"; id: string; workspaceId: string; workspaceName: string; email: string; role: MemberRole; inviterName: string | null };

export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return { state: "invalid" };
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("workspace_invitations")
    .select("id, workspace_id, email, role, expires_at, accepted_at, revoked_at, invited_by, workspace:workspaces(name)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!inv || !inv.workspace) return { state: "invalid" };
  const workspaceName = inv.workspace.name;
  if (inv.accepted_at) return { state: "accepted", workspaceName };
  if (inv.revoked_at) return { state: "revoked", workspaceName };
  if (new Date(inv.expires_at) < new Date()) return { state: "expired", workspaceName };
  const { data: inviter } = inv.invited_by ? await admin.from("profiles").select("full_name, email").eq("id", inv.invited_by).maybeSingle() : { data: null };
  return {
    state: "open", id: inv.id, workspaceId: inv.workspace_id, workspaceName, email: inv.email,
    role: inv.role === "admin" ? "admin" : "member", inviterName: inviter?.full_name || inviter?.email || null,
  };
}
