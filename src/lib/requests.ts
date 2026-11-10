import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toJson } from "@/lib/supabase/json";
import { stepSchema, type AccessStepData, type FormStepData, type Step } from "@/lib/flows/schema";
import { validateAnswers } from "@/lib/flows/logic";
import { generateToken, hashToken, MAGIC_LINK_TTL_DAYS } from "@/lib/tokens";
import { env } from "@/lib/env";
import { logActivity } from "@/lib/activity";

export type RequestRow = Database["public"]["Tables"]["onboarding_requests"]["Row"];
export type RequestStepRow = Database["public"]["Tables"]["request_steps"]["Row"];
export type StepStatus = Database["public"]["Enums"]["step_status"];

/** Turn a request_steps row back into a typed Step (config validated). */
export function rowToStep(row: Pick<RequestStepRow, "id" | "type" | "title" | "description" | "required" | "config">): Step {
  const parsed = stepSchema.safeParse({
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description ?? undefined,
    required: row.required,
    config: row.config,
  });
  if (!parsed.success) throw new Error(`Invalid step config for ${row.id}: ${parsed.error.message}`);
  return parsed.data;
}

export function stepRowsFromTemplate(steps: Step[], ctx: { workspaceId: string; requestId: string }) {
  return steps.map((s, i) => ({
    workspace_id: ctx.workspaceId,
    request_id: ctx.requestId,
    position: i,
    type: s.type,
    title: s.title,
    description: s.description ?? null,
    required: s.required,
    config: toJson(s.config),
  }));
}

/** Create a fresh magic link (old ones stay valid unless revoked). */
export async function createMagicLink(input: { workspaceId: string; requestId: string; createdBy?: string | null }) {
  const admin = createAdminClient();
  const token = generateToken();
  const expires = new Date(Date.now() + MAGIC_LINK_TTL_DAYS * 86_400_000);
  const { error } = await admin.from("magic_links").insert({
    workspace_id: input.workspaceId,
    request_id: input.requestId,
    token_hash: hashToken(token),
    expires_at: expires.toISOString(),
    created_by: input.createdBy ?? null,
  });
  if (error) throw new Error(`Could not create link: ${error.message}`);
  return { token, url: `${env.appUrl}/p/${token}`, expiresAt: expires };
}

type DocLite = { step_id: string; item_key: string; status: Database["public"]["Enums"]["document_status"]; replaced_at: string | null };

/** Is a single step complete, based on what the client has submitted? */
export function evaluateStep(
  row: RequestStepRow,
  ctx: { documents: DocLite[]; signed: Set<string>; paid: Set<string> },
): StepStatus {
  const step = rowToStep(row);
  const data = (row.data ?? {}) as Record<string, unknown>;
  if (data.skipped === true && !row.required) return "completed";

  const liveDocs = ctx.documents.filter((d) => d.step_id === row.id && d.status !== "rejected" && !d.replaced_at);
  const itemsWithFiles = new Set(liveDocs.map((d) => d.item_key));
  const anyDocs = ctx.documents.some((d) => d.step_id === row.id);

  switch (step.type) {
    case "form": {
      const answers = ((data as FormStepData).answers ?? {}) as Record<string, never>;
      const errors = validateAnswers(step.config.fields, answers, itemsWithFiles);
      const submitted = typeof data.submitted_at === "string";
      if (submitted && Object.keys(errors).length === 0) return "completed";
      return Object.keys(answers).length > 0 || anyDocs ? "in_progress" : "not_started";
    }
    case "files": {
      const ok = step.config.items.every((i) => !i.required || itemsWithFiles.has(i.id));
      if (ok && typeof data.submitted_at === "string") return "completed";
      return anyDocs ? "in_progress" : "not_started";
    }
    case "access": {
      const conf = (data as AccessStepData).confirmations ?? {};
      const ok = step.config.items.every((i) => !i.required || conf[i.id]?.confirmed);
      if (ok && typeof data.submitted_at === "string") return "completed";
      return Object.keys(conf).length > 0 ? "in_progress" : "not_started";
    }
    case "agreement":
      return ctx.signed.has(row.id) ? "completed" : "not_started";
    case "payment":
      return ctx.paid.has(row.id) ? "completed" : "not_started";
  }
}

/**
 * Re-evaluate every step and the overall request after any client action.
 * Uses the service role: callers must have authorised access to this request.
 */
export async function recomputeRequest(requestId: string) {
  const admin = createAdminClient();
  const [{ data: request }, { data: steps }, { data: docs }, { data: sigs }, { data: pays }] = await Promise.all([
    admin.from("onboarding_requests").select("*").eq("id", requestId).single(),
    admin.from("request_steps").select("*").eq("request_id", requestId).order("position"),
    admin.from("documents").select("step_id, item_key, status, replaced_at").eq("request_id", requestId),
    admin.from("signatures").select("step_id").eq("request_id", requestId),
    admin.from("payments").select("step_id, status").eq("request_id", requestId),
  ]);
  if (!request || !steps) return null;

  const ctx = {
    documents: docs ?? [],
    signed: new Set((sigs ?? []).map((s) => s.step_id)),
    paid: new Set((pays ?? []).filter((p) => p.status === "paid").map((p) => p.step_id)),
  };

  for (const row of steps) {
    const status = evaluateStep(row, ctx);
    if (status !== row.status) {
      await admin
        .from("request_steps")
        .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
        .eq("id", row.id);
      row.status = status;
    }
  }

  const required = steps.filter((s) => s.required);
  const allDone = required.every((s) => s.status === "completed") && steps.length > 0;
  const anyStarted = steps.some((s) => s.status !== "not_started");

  if (request.status === "cancelled" || request.status === "draft") return { request, steps };

  if (allDone && request.status !== "completed") {
    await admin
      .from("onboarding_requests")
      .update({ status: "completed", completed_at: new Date().toISOString(), next_reminder_at: null })
      .eq("id", requestId);
    await logActivity({
      workspaceId: request.workspace_id,
      requestId,
      clientId: request.client_id,
      actorType: "system",
      type: "request.completed",
      payload: { title: request.title },
    });
    // Notify the agency (lazy import avoids a cycle with the email module).
    const { notifyAgencyCompleted } = await import("@/lib/email/send");
    await notifyAgencyCompleted(requestId).catch((e) => console.error("completion email failed", e));
    request.status = "completed";
  } else if (!allDone && request.status === "completed") {
    // e.g. a document was rejected after completion
    await admin.from("onboarding_requests").update({ status: "in_progress", completed_at: null }).eq("id", requestId);
    request.status = "in_progress";
  } else if (anyStarted && request.status === "sent") {
    await admin.from("onboarding_requests").update({ status: "in_progress" }).eq("id", requestId);
    request.status = "in_progress";
  }
  return { request, steps };
}

export function progressOf(steps: Pick<RequestStepRow, "status" | "required">[]) {
  const total = steps.length;
  const done = steps.filter((s) => s.status === "completed").length;
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function isOverdue(r: Pick<RequestRow, "due_date" | "status">) {
  if (!r.due_date || r.status === "completed" || r.status === "cancelled" || r.status === "draft") return false;
  return new Date(`${r.due_date}T23:59:59`) < new Date();
}
