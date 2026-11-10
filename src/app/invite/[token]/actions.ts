"use server";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/activity";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { lookupInvite } from "./lookup";

export async function acceptInvite(token: string): Promise<{ ok: false; error: string } | never> {
  if (!(await rateLimit(`invite:${await clientIp()}`, 20, 600))) return { ok: false, error: "Too many attempts. Please wait a few minutes." };
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const inv = await lookupInvite(token);
  if (inv.state !== "open") return { ok: false, error: "This invitation is no longer valid." };
  // The invite is for a specific email address.
  if ((user.email ?? "").toLowerCase() !== inv.email.toLowerCase()) {
    return { ok: false, error: `This invitation was sent to ${inv.email}. Sign in with that email to accept it.` };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("workspace_members").upsert(
    { workspace_id: inv.workspaceId, user_id: user.id, role: inv.role },
    { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: "Couldn't join the workspace. Please try again." };
  await admin.from("workspace_invitations").update({ accepted_at: new Date().toISOString(), accepted_by: user.id }).eq("id", inv.id).is("accepted_at", null);
  await admin.from("profiles").update({ current_workspace_id: inv.workspaceId }).eq("id", user.id);
  await audit({ workspaceId: inv.workspaceId, actorType: "member", actorId: user.id, action: "team.invite_accepted", entityType: "invitation", entityId: inv.id });
  redirect("/dashboard?joined=1");
}
