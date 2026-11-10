"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireWorkspace, displayName, canAdmin } from "@/lib/auth";
import { stepsSchema } from "@/lib/flows/schema";
import { createMagicLink, recomputeRequest, stepRowsFromTemplate } from "@/lib/requests";
import { notifyClientOfReply, sendInvitation, sendReminder } from "@/lib/email/send";
import { logActivity, audit } from "@/lib/activity";
import { PLANS } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { toJson } from "@/lib/supabase/json";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

const uuid = z.string().uuid();

async function assertCanActivate(workspaceId: string, plan: keyof typeof PLANS) {
  const { supabase } = await requireWorkspace();
  const limit = PLANS[plan].activeRequests;
  if (!Number.isFinite(limit)) return null;
  const { count } = await supabase.from("onboarding_requests").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["sent", "in_progress"]);
  if ((count ?? 0) >= limit) return `Your ${PLANS[plan].name} plan allows ${limit} active onboardings. Complete or cancel one, or upgrade in Settings → Billing.`;
  return null;
}

const createSchema = z.object({
  clientId: uuid.optional(),
  newClient: z.object({
    name: z.string().trim().min(1, "Client name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    company: z.string().trim().max(120).optional(),
  }).optional(),
  templateId: uuid,
  title: z.string().trim().min(1, "Title is required").max(160),
  message: z.string().trim().max(4000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  remindersEnabled: z.boolean(),
  reminderIntervalDays: z.number().int().min(1).max(30),
  send: z.boolean(),
}).refine((v) => v.clientId || v.newClient, { message: "Choose or add a client", path: ["clientId"] });

export async function createRequest(input: z.input<typeof createSchema>): Promise<R<{ id: string; link?: string; emailStatus?: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const v = parsed.data;
  const { supabase, workspace, user, profile } = await requireWorkspace();

  if (v.send) {
    const limitError = await assertCanActivate(workspace.id, workspace.plan);
    if (limitError) return { ok: false, error: limitError };
  }

  // Template → snapshot
  const { data: template } = await supabase.from("flow_templates").select("*").eq("id", v.templateId).eq("workspace_id", workspace.id).single();
  if (!template) return { ok: false, error: "Template not found" };
  const steps = stepsSchema.safeParse(template.steps);
  if (!steps.success || steps.data.length === 0) return { ok: false, error: "That template has no valid steps. Open it in the builder and save it first." };

  // Client: existing, or find-or-create by email
  let clientId = v.clientId;
  if (!clientId && v.newClient) {
    const { data: existing } = await supabase.from("clients").select("id").eq("workspace_id", workspace.id).ilike("email", v.newClient.email).maybeSingle();
    if (existing) clientId = existing.id;
    else {
      const { data: c, error } = await supabase.from("clients").insert({ workspace_id: workspace.id, name: v.newClient.name, email: v.newClient.email, company: v.newClient.company || null, created_by: user.id }).select("id").single();
      if (error) return { ok: false, error: "Couldn't create the client." };
      clientId = c.id;
      await logActivity({ workspaceId: workspace.id, clientId, actorType: "member", actorId: user.id, actorName: displayName(profile), type: "client.created", payload: { name: v.newClient.name } });
    }
  }
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId!).eq("workspace_id", workspace.id).single();
  if (!client) return { ok: false, error: "Client not found" };

  const now = new Date();
  const { data: req, error } = await supabase.from("onboarding_requests").insert({
    workspace_id: workspace.id,
    client_id: client.id,
    template_id: template.id,
    title: v.title,
    message: v.message || null,
    due_date: v.dueDate || null,
    reminders_enabled: v.remindersEnabled,
    reminder_interval_days: v.reminderIntervalDays,
    max_reminders: workspace.max_reminders,
    status: v.send ? "sent" : "draft",
    sent_at: v.send ? now.toISOString() : null,
    next_reminder_at: v.send && v.remindersEnabled ? new Date(now.getTime() + v.reminderIntervalDays * 86_400_000).toISOString() : null,
    created_by: user.id,
  }).select("id").single();
  if (error) return { ok: false, error: "Couldn't create the onboarding." };

  const { error: stepErr } = await supabase.from("request_steps").insert(stepRowsFromTemplate(steps.data, { workspaceId: workspace.id, requestId: req.id }));
  if (stepErr) {
    await supabase.from("onboarding_requests").delete().eq("id", req.id);
    return { ok: false, error: "Couldn't create the onboarding steps." };
  }

  await logActivity({ workspaceId: workspace.id, requestId: req.id, clientId: client.id, actorType: "member", actorId: user.id, actorName: displayName(profile), type: v.send ? "request.sent" : "request.created", payload: { title: v.title, client: client.name } });

  if (v.send) {
    const { result, link } = await sendInvitation(req.id, { triggeredBy: user.id, senderName: displayName(profile) });
    revalidatePath("/requests");
    return { ok: true, id: req.id, link: link.url, emailStatus: result.status };
  }
  revalidatePath("/requests");
  return { ok: true, id: req.id };
}

async function loadOwned(id: string) {
  const ctx = await requireWorkspace();
  const { data } = await ctx.supabase.from("onboarding_requests").select("*, client:clients(*)").eq("id", uuid.parse(id)).eq("workspace_id", ctx.workspace.id).single();
  if (!data) throw new Error("Not found");
  return { ...ctx, request: data };
}

export async function sendRequest(id: string): Promise<R<{ link: string; emailStatus: string }>> {
  const { supabase, workspace, user, profile, request } = await loadOwned(id);
  if (request.status !== "draft") return { ok: false, error: "This onboarding was already sent." };
  const limitError = await assertCanActivate(workspace.id, workspace.plan);
  if (limitError) return { ok: false, error: limitError };
  const now = Date.now();
  await supabase.from("onboarding_requests").update({
    status: "sent",
    sent_at: new Date(now).toISOString(),
    next_reminder_at: request.reminders_enabled ? new Date(now + request.reminder_interval_days * 86_400_000).toISOString() : null,
  }).eq("id", id);
  const { result, link } = await sendInvitation(id, { triggeredBy: user.id, senderName: displayName(profile) });
  await logActivity({ workspaceId: workspace.id, requestId: id, clientId: request.client_id, actorType: "member", actorId: user.id, actorName: displayName(profile), type: "request.sent", payload: { title: request.title, client: request.client?.name } });
  revalidatePath(`/requests/${id}`);
  return { ok: true, link: link.url, emailStatus: result.status };
}

export async function resendInvitation(id: string): Promise<R<{ emailStatus: string; error?: string }>> {
  const { user, profile, request } = await loadOwned(id);
  if (request.status === "draft" || request.status === "cancelled") return { ok: false, error: "Send or reopen the onboarding first." };
  const { result } = await sendInvitation(id, { triggeredBy: user.id, senderName: displayName(profile) });
  revalidatePath(`/requests/${id}`);
  return { ok: true, emailStatus: result.status, error: result.status === "sent" ? undefined : result.error };
}

/** Generate a fresh client link to copy. Tokens are never stored in plain text, so each copy is a new link. */
export async function getClientLink(id: string): Promise<R<{ url: string; expiresAt: string }>> {
  const { supabase, workspace, user, request } = await loadOwned(id);
  if (request.status === "cancelled") return { ok: false, error: "This onboarding is cancelled." };
  if (request.status === "draft") {
    // Sharing a link activates the onboarding (same as sending it).
    const limitError = await assertCanActivate(workspace.id, workspace.plan);
    if (limitError) return { ok: false, error: limitError };
    const now = Date.now();
    await supabase.from("onboarding_requests").update({
      status: "sent",
      sent_at: new Date(now).toISOString(),
      next_reminder_at: request.reminders_enabled ? new Date(now + request.reminder_interval_days * 86_400_000).toISOString() : null,
    }).eq("id", id);
    revalidatePath(`/requests/${id}`);
  }
  const link = await createMagicLink({ workspaceId: workspace.id, requestId: id, createdBy: user.id });
  await audit({ workspaceId: workspace.id, actorType: "member", actorId: user.id, action: "link.created", entityType: "onboarding_request", entityId: id });
  return { ok: true, url: link.url, expiresAt: link.expiresAt.toISOString() };
}

export async function revokeLinks(id: string): Promise<R> {
  const { supabase, workspace, user, profile, request } = await loadOwned(id);
  await supabase.from("magic_links").update({ revoked_at: new Date().toISOString() }).eq("request_id", id).is("revoked_at", null);
  await audit({ workspaceId: workspace.id, actorType: "member", actorId: user.id, action: "link.revoked_all", entityType: "onboarding_request", entityId: id });
  await logActivity({ workspaceId: workspace.id, requestId: id, clientId: request.client_id, actorType: "member", actorId: user.id, actorName: displayName(profile), type: "link.revoked" });
  revalidatePath(`/requests/${id}`);
  return { ok: true };
}

export async function setRequestStatus(id: string, action: "cancel" | "reopen"): Promise<R> {
  const { supabase, workspace, user, profile, request } = await loadOwned(id);
  if (action === "cancel") {
    await supabase.from("onboarding_requests").update({ status: "cancelled", next_reminder_at: null }).eq("id", id);
    await supabase.from("magic_links").update({ revoked_at: new Date().toISOString() }).eq("request_id", id).is("revoked_at", null);
  } else {
    const limitError = await assertCanActivate(workspace.id, workspace.plan);
    if (limitError) return { ok: false, error: limitError };
    await supabase.from("onboarding_requests").update({ status: request.sent_at ? "in_progress" : "draft", completed_at: null }).eq("id", id);
    await recomputeRequest(id);
  }
  await logActivity({ workspaceId: workspace.id, requestId: id, clientId: request.client_id, actorType: "member", actorId: user.id, actorName: displayName(profile), type: action === "cancel" ? "request.cancelled" : "request.reopened", payload: { title: request.title } });
  revalidatePath(`/requests/${id}`);
  revalidatePath("/requests");
  return { ok: true };
}

export async function deleteRequest(id: string): Promise<R> {
  const { supabase, workspace, user, role, request } = await loadOwned(id);
  if (!canAdmin(role)) return { ok: false, error: "Only owners and admins can delete onboardings." };
  const admin = createAdminClient();
  const { data: docs } = await admin.from("documents").select("storage_path").eq("request_id", id);
  const { data: sigs } = await admin.from("signatures").select("pdf_path").eq("request_id", id);
  const paths = [...(docs ?? []).map((d) => d.storage_path), ...(sigs ?? []).map((s) => s.pdf_path).filter((p): p is string => !!p)];
  if (paths.length) await admin.storage.from("client-files").remove(paths);
  const { error } = await supabase.from("onboarding_requests").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await audit({ workspaceId: workspace.id, actorType: "member", actorId: user.id, action: "request.deleted", entityType: "onboarding_request", entityId: id, metadata: { title: request.title } });
  revalidatePath("/requests");
  return { ok: true };
}

const reminderSchema = z.object({ enabled: z.boolean(), intervalDays: z.number().int().min(1).max(30), maxReminders: z.number().int().min(0).max(20), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });

export async function updateRequestSettings(id: string, input: z.input<typeof reminderSchema>): Promise<R> {
  const v = reminderSchema.parse(input);
  const { supabase, request } = await loadOwned(id);
  const active = request.status === "sent" || request.status === "in_progress";
  const base = request.next_reminder_at ? Date.now() : Date.now();
  await supabase.from("onboarding_requests").update({
    reminders_enabled: v.enabled,
    reminder_interval_days: v.intervalDays,
    max_reminders: v.maxReminders,
    due_date: v.dueDate,
    next_reminder_at: v.enabled && active && request.reminders_sent < v.maxReminders ? new Date(base + v.intervalDays * 86_400_000).toISOString() : null,
  }).eq("id", id);
  revalidatePath(`/requests/${id}`);
  return { ok: true };
}

export async function sendManualReminder(id: string, body?: string | null): Promise<R<{ status: string; error?: string }>> {
  const { workspace, user, profile, request } = await loadOwned(id);
  if (request.status !== "sent" && request.status !== "in_progress") return { ok: false, error: "Reminders can only be sent for active onboardings." };
  const text = body ? z.string().trim().max(4000).parse(body) : null;
  const result = await sendReminder(id, { manual: true, triggeredBy: user.id, body: text });
  if (result.status === "sent") {
    await logActivity({ workspaceId: workspace.id, requestId: id, clientId: request.client_id, actorType: "member", actorId: user.id, actorName: displayName(profile), type: "reminder.sent", payload: { recipient: request.client?.email } });
  }
  revalidatePath(`/requests/${id}`);
  return { ok: true, status: result.status, error: result.status === "sent" ? undefined : result.error };
}

// ------------------------------------------------------------- reviews ----
export async function reviewDocument(documentId: string, decision: "approved" | "rejected", reason?: string): Promise<R> {
  const ctx = await requireWorkspace();
  const { data: doc } = await ctx.supabase.from("documents").select("*").eq("id", uuid.parse(documentId)).eq("workspace_id", ctx.workspace.id).single();
  if (!doc) return { ok: false, error: "Document not found" };
  const why = decision === "rejected" ? z.string().trim().min(3, "Tell the client what to fix").max(500).safeParse(reason) : null;
  if (why && !why.success) return { ok: false, error: why.error.issues[0]!.message };
  await ctx.supabase.from("documents").update({
    status: decision,
    rejection_reason: decision === "rejected" ? why!.data! : null,
    reviewed_by: ctx.user.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", doc.id);
  await audit({ workspaceId: ctx.workspace.id, actorType: "member", actorId: ctx.user.id, action: `document.${decision}`, entityType: "document", entityId: doc.id, metadata: { reason } });
  await logActivity({ workspaceId: ctx.workspace.id, requestId: doc.request_id, clientId: doc.client_id, actorType: "member", actorId: ctx.user.id, actorName: displayName(ctx.profile), type: `document.${decision}`, payload: { file: doc.file_name, reason } });
  if (decision === "rejected") {
    // Re-open the step so the client is asked for a replacement.
    const admin = createAdminClient();
    const { data: step } = await admin.from("request_steps").select("data").eq("id", doc.step_id).single();
    const data = { ...((step?.data as Record<string, unknown>) ?? {}) };
    delete data.submitted_at;
    await admin.from("request_steps").update({ data: toJson(data) }).eq("id", doc.step_id);
  }
  await recomputeRequest(doc.request_id);
  revalidatePath(`/requests/${doc.request_id}`);
  return { ok: true };
}

export async function reopenStep(stepId: string): Promise<R> {
  const ctx = await requireWorkspace();
  const { data: step } = await ctx.supabase.from("request_steps").select("*, request:onboarding_requests(id, client_id, status)").eq("id", uuid.parse(stepId)).eq("workspace_id", ctx.workspace.id).single();
  if (!step) return { ok: false, error: "Step not found" };
  if (step.type === "agreement" || step.type === "payment") return { ok: false, error: "Signed agreements and payments can't be reopened." };
  const data = { ...((step.data as Record<string, unknown>) ?? {}) };
  delete data.submitted_at;
  delete data.skipped;
  await ctx.supabase.from("request_steps").update({ data: toJson(data) }).eq("id", step.id);
  await logActivity({ workspaceId: ctx.workspace.id, requestId: step.request_id, clientId: step.request?.client_id, actorType: "member", actorId: ctx.user.id, actorName: displayName(ctx.profile), type: "step.reopened", payload: { step: step.title } });
  await recomputeRequest(step.request_id);
  revalidatePath(`/requests/${step.request_id}`);
  return { ok: true };
}

// ------------------------------------------------------------ comments ----
export async function postAgencyComment(requestId: string, body: string): Promise<R> {
  const text = z.string().trim().min(1).max(4000).safeParse(body);
  if (!text.success) return { ok: false, error: "Write a message first" };
  const { supabase, workspace, user, profile, request } = await loadOwned(requestId);
  const { error } = await supabase.from("comments").insert({ workspace_id: workspace.id, request_id: requestId, author_type: "member", author_id: user.id, author_name: displayName(profile), body: text.data });
  if (error) return { ok: false, error: "Couldn't post the comment" };
  await logActivity({ workspaceId: workspace.id, requestId, clientId: request.client_id, actorType: "member", actorId: user.id, actorName: displayName(profile), type: "comment.created", payload: { preview: text.data.slice(0, 120) } });
  if (request.client && request.status !== "draft" && request.status !== "cancelled") {
    await notifyClientOfReply(requestId, displayName(profile), text.data).catch((e) => console.error("reply email failed", e));
  }
  revalidatePath(`/requests/${requestId}`);
  return { ok: true };
}

export async function markCommentsRead(requestId: string) {
  const { supabase, workspace } = await requireWorkspace();
  await supabase.from("comments").update({ read_by_agency_at: new Date().toISOString() }).eq("request_id", uuid.parse(requestId)).eq("workspace_id", workspace.id).eq("author_type", "client").is("read_by_agency_at", null);
  revalidatePath("/", "layout");
}

/** Agency records a payment received outside Stripe (bank transfer, cash...). Clearly marked as manual. */
export async function recordOfflinePayment(stepId: string, note: string): Promise<R> {
  const ctx = await requireWorkspace();
  if (!canAdmin(ctx.role)) return { ok: false, error: "Only owners and admins can record payments." };
  const { data: step } = await ctx.supabase.from("request_steps").select("*, request:onboarding_requests(id, client_id)").eq("id", uuid.parse(stepId)).eq("workspace_id", ctx.workspace.id).single();
  if (!step || step.type !== "payment") return { ok: false, error: "Payment step not found" };
  const cfg = step.config as { amountCents: number; currency: string; description?: string };
  const admin = createAdminClient();
  const { data: existing } = await admin.from("payments").select("id").eq("step_id", step.id).eq("status", "paid").maybeSingle();
  if (existing) return { ok: false, error: "This step is already paid." };
  const memo = z.string().trim().max(200).parse(note || "");
  const { data: pay, error } = await admin.from("payments").insert({
    workspace_id: ctx.workspace.id, request_id: step.request_id, step_id: step.id, amount_cents: cfg.amountCents, currency: cfg.currency,
    description: memo ? `${cfg.description ?? "Payment"} (offline: ${memo})` : `${cfg.description ?? "Payment"} (recorded offline)`,
    status: "paid", provider: "manual", paid_at: new Date().toISOString(),
  }).select("id").single();
  if (error) return { ok: false, error: "Couldn't record the payment" };
  await audit({ workspaceId: ctx.workspace.id, actorType: "member", actorId: ctx.user.id, action: "payment.recorded_offline", entityType: "payment", entityId: pay.id, metadata: { note: memo } });
  await logActivity({ workspaceId: ctx.workspace.id, requestId: step.request_id, clientId: step.request?.client_id, actorType: "member", actorId: ctx.user.id, actorName: displayName(ctx.profile), type: "payment.recorded", payload: { amount: `${(cfg.amountCents / 100).toFixed(2)} ${cfg.currency.toUpperCase()}` } });
  await recomputeRequest(step.request_id);
  revalidatePath(`/requests/${step.request_id}`);
  return { ok: true };
}
