"use server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth";
import { AiNotConfiguredError, generateFlowDraft } from "@/lib/ai";
import { assertAiQuota, recordAiUse } from "@/lib/ai/quota";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { templateSchema, type TemplateInput } from "@/lib/flows/schema";
import { toJson } from "@/lib/supabase/json";
import { revalidatePath } from "next/cache";

export async function generateDraft(input: string): Promise<{ ok: true; draft: TemplateInput; summary: string } | { ok: false; error: string }> {
  const text = z.string().trim().min(40, "Paste at least a few sentences so the AI has enough context.").max(40_000, "That's too long. Paste the most relevant part (under 40,000 characters).").safeParse(input);
  if (!text.success) return { ok: false, error: text.error.issues[0]!.message };
  try {
    const { supabase, workspace, user } = await requireWorkspace();
    if (!(await rateLimit(`ai-builder:${user.id}:${await clientIp()}`, 10, 600))) return { ok: false, error: "Too many generations. Please wait a few minutes." };
    await assertAiQuota(supabase, workspace);
    const result = await generateFlowDraft(text.data, { agencyName: workspace.name });
    await recordAiUse(workspace.id, user.id, "request_builder", text.data.length, { name: result.name, steps: result.steps.length });
    return { ok: true, draft: { name: result.name, description: result.description, category: "AI generated", steps: result.steps }, summary: result.summary };
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return { ok: false, error: e.message };
    console.error("AI builder failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" };
  }
}

export async function saveAiTemplate(draft: TemplateInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const v = templateSchema.safeParse(draft);
  if (!v.success) return { ok: false, error: v.error.issues[0]!.message };
  const { supabase, workspace, user } = await requireWorkspace();
  const { data, error } = await supabase.from("flow_templates").insert({
    workspace_id: workspace.id, created_by: user.id, name: v.data.name, description: v.data.description ?? null, category: v.data.category ?? null, steps: toJson(v.data.steps), source: "ai",
  }).select("id").single();
  if (error) return { ok: false, error: "Couldn't save the template" };
  revalidatePath("/templates");
  return { ok: true, id: data.id };
}
