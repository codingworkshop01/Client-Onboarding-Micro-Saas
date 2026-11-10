import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/tokens";
import { renderMergeFields } from "@/lib/merge-fields";
import { rowToStep } from "@/lib/requests";
import { PLANS } from "@/lib/plans";
import { features } from "@/lib/env";
import type { PortalData, PortalStep } from "@/components/portal/types";

export type PortalAccess =
  | { ok: true; linkId: string; requestId: string; workspaceId: string; clientId: string }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "cancelled" };

/**
 * Resolve a magic-link token. This is the ONLY authorisation for portal
 * actions: every action re-resolves the token and scopes queries to the
 * returned request id.
 */
export async function resolveToken(token: string): Promise<PortalAccess> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return { ok: false, reason: "invalid" };
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("magic_links")
    .select("id, request_id, workspace_id, expires_at, revoked_at, last_used_at, request:onboarding_requests(status, client_id)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!link || !link.request) return { ok: false, reason: "invalid" };
  if (link.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(link.expires_at) < new Date()) return { ok: false, reason: "expired" };
  if (link.request.status === "cancelled") return { ok: false, reason: "cancelled" };
  // Throttle last_used_at writes to once a minute.
  if (!link.last_used_at || Date.now() - new Date(link.last_used_at).getTime() > 60_000) {
    await admin.from("magic_links").update({ last_used_at: new Date().toISOString() }).eq("id", link.id);
  }
  return { ok: true, linkId: link.id, requestId: link.request_id, workspaceId: link.workspace_id, clientId: link.request.client_id };
}

export async function loadPortalData(requestId: string): Promise<PortalData | null> {
  const admin = createAdminClient();
  const { data: r } = await admin.from("onboarding_requests").select("*, client:clients(*), workspace:workspaces(*)").eq("id", requestId).single();
  if (!r || !r.client || !r.workspace) return null;
  const [steps, docs, sigs, pays, comments] = await Promise.all([
    admin.from("request_steps").select("*").eq("request_id", requestId).order("position"),
    admin.from("documents").select("*").eq("request_id", requestId).order("uploaded_at"),
    admin.from("signatures").select("step_id, signer_name, signed_at, pdf_path").eq("request_id", requestId),
    admin.from("payments").select("*").eq("request_id", requestId).order("created_at", { ascending: false }),
    admin.from("comments").select("id, author_type, author_name, body, created_at").eq("request_id", requestId).order("created_at"),
  ]);

  const ctx = { client: r.client, workspace: { name: r.workspace.name }, request: { title: r.title } };
  const portalSteps: PortalStep[] = (steps.data ?? []).map((row) => ({ ...rowToStep(row), status: row.status, data: (row.data ?? {}) as PortalStep["data"] }) as PortalStep);
  const agreements: Record<string, string> = {};
  for (const s of portalSteps) if (s.type === "agreement") agreements[s.id] = renderMergeFields(s.config.body, ctx);

  // Latest payment per step
  const payByStep = new Map<string, NonNullable<typeof pays.data>[number]>();
  for (const p of pays.data ?? []) if (!payByStep.has(p.step_id)) payByStep.set(p.step_id, p);

  return {
    request: { id: r.id, title: r.title, message: r.message, status: r.status, dueDate: r.due_date },
    workspace: {
      name: r.workspace.name,
      color: r.workspace.brand_color,
      logoUrl: r.workspace.logo_url,
      supportEmail: r.workspace.support_email,
      website: r.workspace.website,
      welcomeMessage: r.workspace.welcome_message,
      showBranding: !PLANS[r.workspace.plan].removeBranding,
    },
    client: { name: r.client.name, email: r.client.email, company: r.client.company },
    steps: portalSteps,
    documents: (docs.data ?? []).map((d) => ({ id: d.id, stepId: d.step_id, itemKey: d.item_key, fileName: d.file_name, size: d.size_bytes, mimeType: d.mime_type, status: d.status, rejectionReason: d.rejection_reason, uploadedAt: d.uploaded_at, replaced: !!d.replaced_at })),
    signatures: (sigs.data ?? []).map((s) => ({ stepId: s.step_id, signerName: s.signer_name, signedAt: s.signed_at, hasPdf: !!s.pdf_path })),
    payments: Array.from(payByStep.values()).map((p) => ({ stepId: p.step_id, status: p.status, amountCents: p.amount_cents, currency: p.currency, receiptUrl: p.receipt_url, paidAt: p.paid_at })),
    comments: (comments.data ?? []).map((c) => ({ id: c.id, authorType: c.author_type, authorName: c.author_name, body: c.body, createdAt: c.created_at })),
    agreements,
    paymentsEnabled: features.payments() && r.workspace.stripe_charges_enabled && !!r.workspace.stripe_account_id,
  };
}
