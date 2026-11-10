"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { toJson } from "@/lib/supabase/json";
import { resolveToken } from "@/lib/portal";
import { recomputeRequest, rowToStep } from "@/lib/requests";
import { isFileAllowed, sanitizeAnswers, validateAnswers } from "@/lib/flows/logic";
import { renderMergeFields } from "@/lib/merge-fields";
import { esignConsentText } from "@/lib/esign";
import { buildSignedAgreementPdf } from "@/lib/pdf";
import { sha256 } from "@/lib/tokens";
import { logActivity, audit } from "@/lib/activity";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createPaymentCheckout } from "@/lib/stripe";
import { features, env } from "@/lib/env";
import { sendEmail } from "@/lib/email/provider";
import type { AnswerValue } from "@/lib/flows/schema";
import type { ActionRes, PortalComment, PortalDocument, PortalSignature } from "@/components/portal/types";

const BUCKET = "client-files";
const LINK_ERRORS = { invalid: "This link isn't valid.", expired: "This link has expired. Ask for a new one.", revoked: "This link has been revoked.", cancelled: "This onboarding has been cancelled." };

/** Resolve token + rate limit + load the step (scoped to the token's request). */
async function access(token: string, opts: { limit?: number } = {}) {
  const ip = await clientIp();
  if (!(await rateLimit(`portal:${ip}`, opts.limit ?? 120, 60))) throw new PortalError("You're doing that too fast. Please wait a moment.");
  const a = await resolveToken(token);
  if (!a.ok) throw new PortalError(LINK_ERRORS[a.reason]);
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("name, email").eq("id", a.clientId).single();
  return { ...a, admin, ip, clientName: client?.name ?? "Client", clientEmail: client?.email ?? "" };
}

async function loadStep(ctx: Awaited<ReturnType<typeof access>>, stepId: string) {
  const { data: row } = await ctx.admin.from("request_steps").select("*").eq("id", z.string().uuid().parse(stepId)).eq("request_id", ctx.requestId).single();
  if (!row) throw new PortalError("Step not found");
  return { row, step: rowToStep(row) };
}

class PortalError extends Error {}
function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof PortalError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: "Invalid input" };
  console.error("portal action failed", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function touch(ctx: { admin: ReturnType<typeof createAdminClient>; requestId: string }) {
  await ctx.admin.from("onboarding_requests").update({ last_client_activity_at: new Date().toISOString() }).eq("id", ctx.requestId);
}

// --------------------------------------------------------------- forms ----
export async function portalSaveAnswers(token: string, stepId: string, answers: Record<string, AnswerValue>): Promise<ActionRes> {
  try {
    const ctx = await access(token, { limit: 240 });
    const { row, step } = await loadStep(ctx, stepId);
    if (step.type !== "form") throw new PortalError("Not a form step");
    const clean = sanitizeAnswers(step.config.fields, z.record(z.string(), z.any()).parse(answers));
    const data = { ...((row.data as Record<string, unknown>) ?? {}), answers: clean };
    await ctx.admin.from("request_steps").update({ data: toJson(data) }).eq("id", row.id);
    await touch(ctx);
    await recomputeRequest(ctx.requestId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function portalSubmitStep(token: string, stepId: string): Promise<ActionRes> {
  try {
    const ctx = await access(token);
    const { row, step } = await loadStep(ctx, stepId);
    const data = { ...((row.data as Record<string, unknown>) ?? {}) };
    const { data: docs } = await ctx.admin.from("documents").select("item_key, status, replaced_at").eq("step_id", row.id);
    const live = new Set((docs ?? []).filter((d) => d.status !== "rejected" && !d.replaced_at).map((d) => d.item_key));

    if (step.type === "form") {
      const errors = validateAnswers(step.config.fields, (data.answers ?? {}) as Record<string, AnswerValue>, live);
      if (Object.keys(errors).length) return { ok: false, error: "Please fix the highlighted answers", fieldErrors: errors };
    } else if (step.type === "files") {
      const missing = step.config.items.filter((i) => i.required && !live.has(i.id));
      if (missing.length) throw new PortalError(`Please upload: ${missing.map((m) => m.label).join(", ")}`);
    } else if (step.type === "access") {
      const conf = (data.confirmations ?? {}) as Record<string, { confirmed: boolean }>;
      if (step.config.items.some((i) => i.required && !conf[i.id]?.confirmed)) throw new PortalError("Please confirm each required platform");
    } else {
      throw new PortalError("This step completes automatically");
    }
    const firstTime = typeof data.submitted_at !== "string";
    data.submitted_at = new Date().toISOString();
    delete data.skipped;
    await ctx.admin.from("request_steps").update({ data: toJson(data) }).eq("id", row.id);
    await touch(ctx);
    if (firstTime) await logActivity({ workspaceId: ctx.workspaceId, requestId: ctx.requestId, clientId: ctx.clientId, actorType: "client", actorName: ctx.clientName, type: "step.submitted", payload: { step: row.title } });
    await recomputeRequest(ctx.requestId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function portalSkipStep(token: string, stepId: string): Promise<ActionRes> {
  try {
    const ctx = await access(token);
    const { row } = await loadStep(ctx, stepId);
    if (row.required) throw new PortalError("This step is required");
    if (row.type === "agreement" || row.type === "payment") {
      // fine to skip optional agreement/payment too
    }
    const data = { ...((row.data as Record<string, unknown>) ?? {}), skipped: true };
    await ctx.admin.from("request_steps").update({ data: toJson(data) }).eq("id", row.id);
    await logActivity({ workspaceId: ctx.workspaceId, requestId: ctx.requestId, clientId: ctx.clientId, actorType: "client", actorName: ctx.clientName, type: "step.skipped", payload: { step: row.title } });
    await recomputeRequest(ctx.requestId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

// --------------------------------------------------------------- files ----
function fileRules(step: ReturnType<typeof rowToStep>, itemKey: string) {
  if (step.type === "files") {
    const item = step.config.items.find((i) => i.id === itemKey);
    if (item) return { accept: item.accept, maxSizeMb: item.maxSizeMb, multiple: item.multiple, label: item.label };
  }
  if (step.type === "form") {
    const f = step.config.fields.find((x) => x.id === itemKey && x.type === "file");
    if (f) return { accept: f.accept ?? ["any" as const], maxSizeMb: f.maxSizeMb ?? 25, multiple: true, label: f.label };
  }
  throw new PortalError("Upload slot not found");
}

const fileMeta = z.object({ name: z.string().min(1).max(255), size: z.number().int().positive(), type: z.string().max(200) });

export async function portalCreateUpload(token: string, stepId: string, itemKey: string, meta: z.input<typeof fileMeta>): Promise<ActionRes<{ signedUrl: string; path: string }>> {
  try {
    const ctx = await access(token, { limit: 60 });
    const { step, row } = await loadStep(ctx, stepId);
    const rules = fileRules(step, z.string().max(40).parse(itemKey));
    const m = fileMeta.parse(meta);
    if (!isFileAllowed(m.name, m.type, rules.accept)) throw new PortalError("This file type isn't accepted here");
    if (m.size > rules.maxSizeMb * 1024 * 1024) throw new PortalError(`Files must be under ${rules.maxSizeMb} MB`);
    const safe = m.name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-120);
    const path = `${ctx.workspaceId}/${ctx.requestId}/${row.id}/${randomUUID()}-${safe}`;
    const { data, error } = await ctx.admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "upload url failed");
    return { ok: true, signedUrl: data.signedUrl, path };
  } catch (e) { return fail(e); }
}

export async function portalFinalizeUpload(token: string, stepId: string, itemKey: string, path: string, meta: z.input<typeof fileMeta>): Promise<ActionRes<{ document: PortalDocument }>> {
  try {
    const ctx = await access(token, { limit: 60 });
    const { step, row } = await loadStep(ctx, stepId);
    const rules = fileRules(step, itemKey);
    const m = fileMeta.parse(meta);
    if (!path.startsWith(`${ctx.workspaceId}/${ctx.requestId}/${row.id}/`) || path.includes("..")) throw new PortalError("Invalid upload");
    // Verify the object really exists and check its real size server-side.
    const { data: info, error } = await ctx.admin.storage.from(BUCKET).info(path);
    if (error || !info) throw new PortalError("Upload not found. Please try again.");
    const size = Number(info.size ?? 0);
    if (!size || size > rules.maxSizeMb * 1024 * 1024) {
      await ctx.admin.storage.from(BUCKET).remove([path]);
      throw new PortalError(`Files must be under ${rules.maxSizeMb} MB`);
    }
    const mime = (info.contentType as string | undefined) || m.type || "application/octet-stream";
    if (!isFileAllowed(m.name, mime, rules.accept)) {
      await ctx.admin.storage.from(BUCKET).remove([path]);
      throw new PortalError("This file type isn't accepted here");
    }
    const { data: doc, error: insErr } = await ctx.admin.from("documents").insert({
      workspace_id: ctx.workspaceId, request_id: ctx.requestId, step_id: row.id, client_id: ctx.clientId,
      item_key: itemKey, file_name: m.name.slice(0, 255), storage_path: path, mime_type: mime, size_bytes: size,
    }).select("*").single();
    if (insErr) throw new Error(insErr.message);
    // A new upload replaces any rejected files for the same slot.
    await ctx.admin.from("documents").update({ replaced_at: new Date().toISOString() }).eq("step_id", row.id).eq("item_key", itemKey).eq("status", "rejected").is("replaced_at", null);
    await touch(ctx);
    await logActivity({ workspaceId: ctx.workspaceId, requestId: ctx.requestId, clientId: ctx.clientId, actorType: "client", actorName: ctx.clientName, type: "document.uploaded", payload: { file: m.name, slot: rules.label } });
    await recomputeRequest(ctx.requestId);
    return { ok: true, document: { id: doc.id, stepId: row.id, itemKey, fileName: doc.file_name, size: doc.size_bytes, mimeType: doc.mime_type, status: doc.status, rejectionReason: null, uploadedAt: doc.uploaded_at, replaced: false } };
  } catch (e) { return fail(e); }
}

export async function portalRemoveFile(token: string, documentId: string): Promise<ActionRes> {
  try {
    const ctx = await access(token);
    const { data: doc } = await ctx.admin.from("documents").select("*").eq("id", z.string().uuid().parse(documentId)).eq("request_id", ctx.requestId).single();
    if (!doc) throw new PortalError("File not found");
    if (doc.status !== "pending") throw new PortalError("Reviewed files can't be removed");
    await ctx.admin.storage.from(BUCKET).remove([doc.storage_path]);
    await ctx.admin.from("documents").delete().eq("id", doc.id);
    await recomputeRequest(ctx.requestId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

// -------------------------------------------------------------- access ----
export async function portalConfirmAccess(token: string, stepId: string, itemId: string, confirmed: boolean): Promise<ActionRes> {
  try {
    const ctx = await access(token);
    const { row, step } = await loadStep(ctx, stepId);
    if (step.type !== "access") throw new PortalError("Not an access step");
    const item = step.config.items.find((i) => i.id === itemId);
    if (!item) throw new PortalError("Platform not found");
    const data = { ...((row.data as Record<string, unknown>) ?? {}) } as { confirmations?: Record<string, unknown>; submitted_at?: string };
    data.confirmations = { ...(data.confirmations ?? {}), [itemId]: { confirmed: z.boolean().parse(confirmed), at: new Date().toISOString() } };
    if (!confirmed) delete data.submitted_at;
    await ctx.admin.from("request_steps").update({ data: toJson(data) }).eq("id", row.id);
    await touch(ctx);
    if (confirmed) {
      const { ACCESS_PLATFORM_GUIDES } = await import("@/lib/flows/access-platforms");
      await logActivity({ workspaceId: ctx.workspaceId, requestId: ctx.requestId, clientId: ctx.clientId, actorType: "client", actorName: ctx.clientName, type: "access.confirmed", payload: { platform: item.label || ACCESS_PLATFORM_GUIDES[item.platform].name } });
    }
    await recomputeRequest(ctx.requestId);
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ------------------------------------------------------------- signing ----
const signSchema = z.object({
  signerName: z.string().trim().min(2).max(120),
  signerEmail: z.string().trim().email().max(254),
  type: z.enum(["typed", "drawn"]),
  data: z.string().min(1).max(400_000),
  consent: z.literal(true),
});

export async function portalSign(token: string, stepId: string, input: { signerName: string; signerEmail: string; type: "typed" | "drawn"; data: string; consent: boolean }): Promise<ActionRes<{ signature: PortalSignature }>> {
  try {
    const ctx = await access(token, { limit: 20 });
    const { row, step } = await loadStep(ctx, stepId);
    if (step.type !== "agreement") throw new PortalError("Not an agreement step");
    const v = signSchema.safeParse(input);
    if (!v.success) throw new PortalError("Please complete your name, email, signature and consent");
    if (v.data.type === "drawn" && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.data.data)) throw new PortalError("Invalid signature image");
    const { data: existing } = await ctx.admin.from("signatures").select("id").eq("step_id", row.id).maybeSingle();
    if (existing) throw new PortalError("This agreement is already signed");

    const { data: r } = await ctx.admin.from("onboarding_requests").select("title, client:clients(*), workspace:workspaces(name)").eq("id", ctx.requestId).single();
    const body = renderMergeFields(step.config.body, { client: r!.client!, workspace: { name: r!.workspace!.name }, request: { title: r!.title } });
    const consent = esignConsentText(r!.workspace!.name);
    const ua = (await headers()).get("user-agent")?.slice(0, 500) ?? null;
    const signedAt = new Date();
    const hash = sha256(body);
    const signatureData = v.data.type === "typed" ? v.data.signerName : v.data.data;

    const { data: sig, error } = await ctx.admin.from("signatures").insert({
      workspace_id: ctx.workspaceId, request_id: ctx.requestId, step_id: row.id,
      signer_name: v.data.signerName, signer_email: v.data.signerEmail, signature_type: v.data.type, signature_data: signatureData,
      agreement_title: step.config.agreementTitle, agreement_body: body, document_hash: hash, consent_text: consent,
      ip_address: ctx.ip, user_agent: ua, signed_at: signedAt.toISOString(),
    }).select("id").single();
    if (error) throw new PortalError(error.code === "23505" ? "This agreement is already signed" : "Couldn't save your signature");

    // Signed PDF with audit certificate (stored privately).
    try {
      const pdf = await buildSignedAgreementPdf({
        agencyName: r!.workspace!.name, title: step.config.agreementTitle, body, signerName: v.data.signerName, signerEmail: v.data.signerEmail,
        signatureType: v.data.type, signatureData, signedAt, ip: ctx.ip, userAgent: ua, documentHash: hash, consentText: consent, requestId: ctx.requestId,
      });
      const pdfPath = `${ctx.workspaceId}/${ctx.requestId}/signatures/${sig.id}.pdf`;
      const up = await ctx.admin.storage.from(BUCKET).upload(pdfPath, pdf, { contentType: "application/pdf" });
      if (!up.error) await ctx.admin.from("signatures").update({ pdf_path: pdfPath }).eq("id", sig.id);
    } catch (e) {
      console.error("signed PDF generation failed", e);
    }

    await audit({ workspaceId: ctx.workspaceId, actorType: "client", action: "agreement.signed", entityType: "signature", entityId: sig.id, ip: ctx.ip, metadata: { signer: v.data.signerEmail, hash, userAgent: ua } });
    await logActivity({ workspaceId: ctx.workspaceId, requestId: ctx.requestId, clientId: ctx.clientId, actorType: "client", actorName: v.data.signerName, type: "agreement.signed", payload: { agreement: step.config.agreementTitle } });
    await touch(ctx);
    await recomputeRequest(ctx.requestId);
    return { ok: true, signature: { stepId: row.id, signerName: v.data.signerName, signedAt: signedAt.toISOString(), hasPdf: true } };
  } catch (e) { return fail(e); }
}

// ------------------------------------------------------------- payment ----
export async function portalStartPayment(token: string, stepId: string): Promise<ActionRes<{ url: string }>> {
  try {
    const ctx = await access(token, { limit: 20 });
    const { row, step } = await loadStep(ctx, stepId);
    if (step.type !== "payment") throw new PortalError("Not a payment step");
    const { data: ws } = await ctx.admin.from("workspaces").select("id, name, stripe_account_id, stripe_charges_enabled").eq("id", ctx.workspaceId).single();
    if (!features.payments() || !ws?.stripe_account_id || !ws.stripe_charges_enabled) throw new PortalError("Online payment isn't available yet for this onboarding.");
    const { data: paid } = await ctx.admin.from("payments").select("id").eq("step_id", row.id).eq("status", "paid").maybeSingle();
    if (paid) throw new PortalError("This payment has already been made");
    const url = await createPaymentCheckout({
      workspace: { id: ws.id, name: ws.name, stripe_account_id: ws.stripe_account_id },
      requestId: ctx.requestId, stepId: row.id, clientEmail: ctx.clientEmail,
      amountCents: step.config.amountCents, currency: step.config.currency,
      description: step.config.description || row.title,
      returnUrl: `${env.appUrl}/p/${token}`,
    });
    return { ok: true, url };
  } catch (e) { return fail(e); }
}

// ------------------------------------------------------------ comments ----
export async function portalPostComment(token: string, body: string): Promise<ActionRes<{ comment: PortalComment }>> {
  try {
    const ctx = await access(token, { limit: 10 });
    const text = z.string().trim().min(1).max(4000).parse(body);
    const { data: c, error } = await ctx.admin.from("comments").insert({ workspace_id: ctx.workspaceId, request_id: ctx.requestId, author_type: "client", author_name: ctx.clientName, body: text }).select("*").single();
    if (error) throw new Error(error.message);
    await logActivity({ workspaceId: ctx.workspaceId, requestId: ctx.requestId, clientId: ctx.clientId, actorType: "client", actorName: ctx.clientName, type: "comment.created", payload: { preview: text.slice(0, 120) } });
    // Let the team know (best-effort, logged).
    const { data: members } = await ctx.admin.from("workspace_members").select("profile:profiles(email)").eq("workspace_id", ctx.workspaceId).in("role", ["owner", "admin"]);
    const subject = `${ctx.clientName} left a comment`;
    for (const m of members ?? []) {
      if (!m.profile?.email) continue;
      const res = await sendEmail({ to: m.profile.email, subject, text: `${ctx.clientName} wrote:\n\n${text}\n\nReply: ${env.appUrl}/requests/${ctx.requestId}?tab=comments`, html: `<p><strong>${ctx.clientName.replace(/</g, "&lt;")}</strong> wrote:</p><blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#444">${text.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</blockquote><p><a href="${env.appUrl}/requests/${ctx.requestId}?tab=comments">Reply in ${env.appName}</a></p>` });
      await ctx.admin.from("notifications_log").insert({ workspace_id: ctx.workspaceId, request_id: ctx.requestId, kind: "agency_alert", recipient: m.profile.email, subject, status: res.status, provider: res.provider, error: res.status === "sent" ? null : res.error });
    }
    return { ok: true, comment: { id: c.id, authorType: "client", authorName: c.author_name, body: c.body, createdAt: c.created_at } };
  } catch (e) { return fail(e); }
}
