import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { createMagicLink } from "@/lib/requests";
import { sendEmail, type SendResult } from "./provider";
import { completedEmail, invitationEmail, reminderEmail } from "./templates";

type Kind = "invitation" | "reminder" | "manual_reminder" | "completed" | "agency_alert";

async function log(input: {
  workspaceId: string; requestId: string; kind: Kind; recipient: string; subject: string; result: SendResult; triggeredBy?: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("notifications_log").insert({
    workspace_id: input.workspaceId,
    request_id: input.requestId,
    kind: input.kind,
    recipient: input.recipient,
    subject: input.subject,
    status: input.result.status,
    provider: input.result.provider,
    provider_message_id: input.result.status === "sent" ? input.result.messageId ?? null : null,
    error: input.result.status === "sent" ? null : input.result.error,
    triggered_by: input.triggeredBy ?? null,
  });
}

async function loadContext(requestId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("onboarding_requests")
    .select("*, client:clients(*), workspace:workspaces(*), steps:request_steps(status, required)")
    .eq("id", requestId)
    .single();
  if (!data || !data.client || !data.workspace) throw new Error("Request not found");
  return data;
}

/** Send the invitation (or a re-send) with a fresh magic link. */
export async function sendInvitation(requestId: string, opts: { triggeredBy?: string | null; senderName: string }) {
  const r = await loadContext(requestId);
  const link = await createMagicLink({ workspaceId: r.workspace_id, requestId, createdBy: opts.triggeredBy });
  const brand = { name: r.workspace.name, color: r.workspace.brand_color, logoUrl: r.workspace.logo_url };
  const email = invitationEmail({ brand, clientName: r.client.name, title: r.title, message: r.message, url: link.url, dueDate: r.due_date, senderName: opts.senderName });
  const result = await sendEmail({ to: r.client.email, ...email, replyTo: r.workspace.support_email ?? undefined });
  await log({ workspaceId: r.workspace_id, requestId, kind: "invitation", recipient: r.client.email, subject: email.subject, result, triggeredBy: opts.triggeredBy });
  return { result, link };
}

/** Reminder (automatic or manual). `body` lets a human-approved AI draft be used. */
export async function sendReminder(requestId: string, opts: { manual: boolean; triggeredBy?: string | null; body?: string | null }) {
  const r = await loadContext(requestId);
  const remaining = (r.steps ?? []).filter((s) => s.required && s.status !== "completed").length;
  const link = await createMagicLink({ workspaceId: r.workspace_id, requestId, createdBy: opts.triggeredBy });
  const brand = { name: r.workspace.name, color: r.workspace.brand_color, logoUrl: r.workspace.logo_url };
  const email = reminderEmail({ brand, clientName: r.client.name, title: r.title, url: link.url, remaining, body: opts.body });
  const result = await sendEmail({ to: r.client.email, ...email, replyTo: r.workspace.support_email ?? undefined });
  await log({ workspaceId: r.workspace_id, requestId, kind: opts.manual ? "manual_reminder" : "reminder", recipient: r.client.email, subject: email.subject, result, triggeredBy: opts.triggeredBy });
  return result;
}

/** Tell the workspace owners and admins that a client finished. */
export async function notifyAgencyCompleted(requestId: string) {
  const r = await loadContext(requestId);
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("workspace_members")
    .select("role, profile:profiles(email)")
    .eq("workspace_id", r.workspace_id)
    .in("role", ["owner", "admin"]);
  const brand = { name: r.workspace.name, color: r.workspace.brand_color, logoUrl: r.workspace.logo_url };
  const email = completedEmail({ brand, clientName: r.client.name, title: r.title, url: `${env.appUrl}/requests/${requestId}` });
  for (const m of members ?? []) {
    const to = m.profile?.email;
    if (!to) continue;
    const result = await sendEmail({ to, ...email });
    await log({ workspaceId: r.workspace_id, requestId, kind: "completed", recipient: to, subject: email.subject, result });
  }
}
