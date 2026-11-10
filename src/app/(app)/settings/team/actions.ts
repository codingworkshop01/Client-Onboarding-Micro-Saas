"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireWorkspace, canAdmin, displayName } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken } from "@/lib/tokens";
import { audit } from "@/lib/activity";
import { env } from "@/lib/env";
import { PLANS } from "@/lib/plans";
import { sendEmail } from "@/lib/email/provider";
import { teamInviteEmail } from "@/lib/email/templates";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const INVITE_TTL_DAYS = 7;
const roleSchema = z.enum(["admin", "member"]);

async function adminCtx() {
  const ctx = await requireWorkspace();
  if (!canAdmin(ctx.role)) throw new Error("Only owners and admins can manage the team.");
  return ctx;
}

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

/** Seats used = members + open invitations. */
async function seatsUsed(workspaceId: string) {
  const admin = createAdminClient();
  const [{ count: members }, { count: invites }] = await Promise.all([
    admin.from("workspace_members").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("workspace_invitations").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId)
      .is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  return (members ?? 0) + (invites ?? 0);
}

async function sendInviteEmail(input: { email: string; token: string; role: string; workspace: { name: string; brand_color: string; logo_url: string | null; support_email: string | null }; inviterName: string }) {
  const email = teamInviteEmail({
    brand: { name: input.workspace.name, color: input.workspace.brand_color, logoUrl: input.workspace.logo_url },
    inviterName: input.inviterName, role: input.role, url: `${env.appUrl}/invite/${input.token}`, appName: env.appName,
  });
  return sendEmail({ to: input.email, ...email, replyTo: input.workspace.support_email ?? undefined });
}

export async function inviteMember(emailInput: string, roleInput: string): Promise<R<{ emailStatus: string; link: string }>> {
  try {
    const ctx = await adminCtx();
    const email = z.string().trim().toLowerCase().email("Enter a valid email").parse(emailInput);
    const role = roleSchema.parse(roleInput);
    const admin = createAdminClient();

    const limit = PLANS[ctx.workspace.plan].members;
    if ((await seatsUsed(ctx.workspace.id)) >= limit) {
      return { ok: false, error: `Your ${PLANS[ctx.workspace.plan].name} plan includes ${limit} ${limit === 1 ? "seat" : "seats"}. Upgrade in Plan & billing to add teammates.` };
    }
    const { data: existing } = await admin.from("workspace_members").select("user_id, profile:profiles!inner(email)").eq("workspace_id", ctx.workspace.id).ilike("profile.email", email);
    if (existing?.length) return { ok: false, error: "That person is already on your team." };

    // Replace any older open invite for the same email.
    await admin.from("workspace_invitations").update({ revoked_at: new Date().toISOString() })
      .eq("workspace_id", ctx.workspace.id).ilike("email", email).is("accepted_at", null).is("revoked_at", null);

    const token = generateToken();
    const { data: inv, error } = await ctx.supabase.from("workspace_invitations").insert({
      workspace_id: ctx.workspace.id, email, role, token_hash: hashToken(token), invited_by: ctx.user.id,
      expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
    }).select("id").single();
    if (error) return { ok: false, error: "Couldn't create the invitation." };

    const result = await sendInviteEmail({ email, token, role, workspace: ctx.workspace, inviterName: displayName(ctx.profile) });
    await audit({ workspaceId: ctx.workspace.id, actorType: "member", actorId: ctx.user.id, action: "team.invited", entityType: "invitation", entityId: inv.id, metadata: { email, role, emailStatus: result.status } });
    revalidatePath("/settings/team");
    return { ok: true, emailStatus: result.status, link: `${env.appUrl}/invite/${token}` };
  } catch (e) { return fail(e); }
}

export async function resendInvite(inviteId: string): Promise<R<{ emailStatus: string; link: string }>> {
  try {
    const ctx = await adminCtx();
    const { data: inv } = await ctx.supabase.from("workspace_invitations").select("*").eq("id", z.string().uuid().parse(inviteId)).eq("workspace_id", ctx.workspace.id).single();
    if (!inv || inv.accepted_at || inv.revoked_at) return { ok: false, error: "This invitation is no longer open." };
    // Tokens are only stored hashed, so a resend issues a new token (the old link stops working).
    const token = generateToken();
    await ctx.supabase.from("workspace_invitations").update({ token_hash: hashToken(token), expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString() }).eq("id", inv.id);
    const result = await sendInviteEmail({ email: inv.email, token, role: inv.role, workspace: ctx.workspace, inviterName: displayName(ctx.profile) });
    revalidatePath("/settings/team");
    return { ok: true, emailStatus: result.status, link: `${env.appUrl}/invite/${token}` };
  } catch (e) { return fail(e); }
}

export async function revokeInvite(inviteId: string): Promise<R> {
  try {
    const ctx = await adminCtx();
    await ctx.supabase.from("workspace_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", z.string().uuid().parse(inviteId)).eq("workspace_id", ctx.workspace.id);
    await audit({ workspaceId: ctx.workspace.id, actorType: "member", actorId: ctx.user.id, action: "team.invite_revoked", entityType: "invitation", entityId: inviteId });
    revalidatePath("/settings/team");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function changeRole(userId: string, roleInput: string): Promise<R> {
  try {
    const ctx = await adminCtx();
    const role = roleSchema.parse(roleInput);
    const id = z.string().uuid().parse(userId);
    const { data: target } = await ctx.supabase.from("workspace_members").select("role").eq("workspace_id", ctx.workspace.id).eq("user_id", id).single();
    if (!target) return { ok: false, error: "Member not found" };
    if (target.role === "owner") return { ok: false, error: "The owner's role can't be changed." };
    if (id === ctx.user.id) return { ok: false, error: "You can't change your own role." };
    await ctx.supabase.from("workspace_members").update({ role }).eq("workspace_id", ctx.workspace.id).eq("user_id", id);
    await audit({ workspaceId: ctx.workspace.id, actorType: "member", actorId: ctx.user.id, action: "team.role_changed", entityType: "user", entityId: id, metadata: { role } });
    revalidatePath("/settings/team");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function removeMember(userId: string): Promise<R> {
  try {
    const ctx = await adminCtx();
    const id = z.string().uuid().parse(userId);
    const { data: target } = await ctx.supabase.from("workspace_members").select("role").eq("workspace_id", ctx.workspace.id).eq("user_id", id).single();
    if (!target) return { ok: false, error: "Member not found" };
    if (target.role === "owner") return { ok: false, error: "The owner can't be removed." };
    if (id === ctx.user.id) return { ok: false, error: "You can't remove yourself." };
    await ctx.supabase.from("workspace_members").delete().eq("workspace_id", ctx.workspace.id).eq("user_id", id);
    // If this was their current workspace, clear it so they land on another one.
    await createAdminClient().from("profiles").update({ current_workspace_id: null }).eq("id", id).eq("current_workspace_id", ctx.workspace.id);
    await audit({ workspaceId: ctx.workspace.id, actorType: "member", actorId: ctx.user.id, action: "team.member_removed", entityType: "user", entityId: id });
    revalidatePath("/settings/team");
    return { ok: true };
  } catch (e) { return fail(e); }
}
