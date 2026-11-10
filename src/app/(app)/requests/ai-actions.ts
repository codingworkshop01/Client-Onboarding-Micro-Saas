"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth";
import { AiNotConfiguredError, detectVagueAnswers, draftReminder, kickoffBrief, summarizeSubmission } from "@/lib/ai";
import { buildRequestContext } from "@/lib/ai/context";
import { assertAiQuota, recordAiUse } from "@/lib/ai/quota";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function prep(requestId: string, kind: string) {
  const ctx = await requireWorkspace();
  const id = z.string().uuid().parse(requestId);
  const { data: request } = await ctx.supabase.from("onboarding_requests").select("*, client:clients(name)").eq("id", id).eq("workspace_id", ctx.workspace.id).single();
  if (!request) throw new Error("Not found");
  if (!(await rateLimit(`ai:${ctx.user.id}:${await clientIp()}`, 20, 600))) throw new Error("Too many AI requests. Please wait a few minutes.");
  await assertAiQuota(ctx.supabase, ctx.workspace);
  const data = await buildRequestContext(ctx.supabase, id);
  return { ...ctx, request, data, kind };
}

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof AiNotConfiguredError) return { ok: false, error: e.message };
  console.error("AI action failed", e);
  return { ok: false, error: e instanceof Error ? e.message : "AI request failed" };
}

export async function aiSummarize(requestId: string): Promise<R> {
  try {
    const c = await prep(requestId, "summary");
    const summary = await summarizeSubmission({ client: c.request.client?.name ?? "Client", title: c.request.title, qa: c.data.qa, extras: c.data.extras });
    await c.supabase.from("onboarding_requests").update({ ai_summary: summary, ai_summary_at: new Date().toISOString() }).eq("id", requestId);
    await recordAiUse(c.workspace.id, c.user.id, "summary", c.data.qa.length);
    revalidatePath(`/requests/${requestId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function aiKickoffBrief(requestId: string): Promise<R> {
  try {
    const c = await prep(requestId, "brief");
    const brief = await kickoffBrief({ client: c.request.client?.name ?? "Client", title: c.request.title, qa: c.data.qa, extras: c.data.extras, agency: c.workspace.name });
    await c.supabase.from("onboarding_requests").update({ ai_brief: brief, ai_brief_at: new Date().toISOString() }).eq("id", requestId);
    await recordAiUse(c.workspace.id, c.user.id, "kickoff_brief", c.data.qa.length);
    revalidatePath(`/requests/${requestId}`);
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function aiCheckAnswers(requestId: string): Promise<R<{ issues: { question: string; answer: string; problem: string; follow_up_question: string }[] }>> {
  try {
    const c = await prep(requestId, "vague");
    if (!c.data.qa.some((q) => q.answer)) return { ok: false, error: "There are no answers to review yet." };
    const issues = await detectVagueAnswers(c.data.qa);
    await recordAiUse(c.workspace.id, c.user.id, "vague_check", c.data.qa.length);
    return { ok: true, issues };
  } catch (e) { return fail(e); }
}

export async function aiDraftReminder(requestId: string): Promise<R<{ draft: string }>> {
  try {
    const c = await prep(requestId, "reminder");
    const draft = await draftReminder({
      client: c.request.client?.name ?? "there",
      agency: c.workspace.name,
      title: c.request.title,
      remaining: c.data.remaining,
      daysSinceSent: c.request.sent_at ? Math.floor((Date.now() - new Date(c.request.sent_at).getTime()) / 86_400_000) : null,
      dueDate: c.request.due_date,
    });
    await recordAiUse(c.workspace.id, c.user.id, "reminder_draft", 0);
    return { ok: true, draft };
  } catch (e) { return fail(e); }
}
