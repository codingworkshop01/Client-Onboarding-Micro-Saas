"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { templateSchema, stepsSchema, type Step } from "@/lib/flows/schema";
import { cloneStep, newStep } from "@/lib/flows/logic";
import { getStarter } from "@/lib/flows/starters";
import { toJson } from "@/lib/supabase/json";

type Result = { ok: true } | { ok: false; error: string };

export async function createTemplate(input: { starter?: string; blank?: boolean }) {
  const { supabase, workspace, user } = await requireWorkspace();
  let row: { name: string; description: string | null; category: string | null; steps: Step[]; source: string };
  if (input.starter) {
    const s = getStarter(input.starter);
    if (!s) throw new Error("Unknown starter");
    row = { name: s.name, description: s.description, category: s.category, steps: s.steps.map(cloneStep), source: "starter" };
  } else {
    row = { name: "Untitled onboarding", description: null, category: null, steps: [newStep("form")], source: "blank" };
  }
  const { data, error } = await supabase
    .from("flow_templates")
    .insert({ workspace_id: workspace.id, created_by: user.id, ...row, steps: toJson(row.steps) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/templates");
  redirect(`/templates/${data.id}`);
}

export async function saveTemplate(id: string, input: unknown): Promise<Result> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `${issue.path.join(" › ")}: ${issue.message}` : "Invalid template" };
  }
  const { supabase, workspace } = await requireWorkspace();
  const { error } = await supabase
    .from("flow_templates")
    .update({ name: parsed.data.name, description: parsed.data.description ?? null, category: parsed.data.category ?? null, steps: toJson(parsed.data.steps) })
    .eq("id", z.string().uuid().parse(id))
    .eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: "Couldn't save. Please try again." };
  revalidatePath("/templates");
  return { ok: true };
}

export async function duplicateTemplate(id: string) {
  const { supabase, workspace, user } = await requireWorkspace();
  const { data: t } = await supabase.from("flow_templates").select("*").eq("id", id).eq("workspace_id", workspace.id).single();
  if (!t) throw new Error("Template not found");
  const steps = stepsSchema.parse(t.steps).map(cloneStep);
  const { data, error } = await supabase
    .from("flow_templates")
    .insert({ workspace_id: workspace.id, created_by: user.id, name: `${t.name} (copy)`, description: t.description, category: t.category, steps: toJson(steps), source: "duplicate" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/templates");
  return data.id;
}

export async function deleteTemplate(id: string): Promise<Result> {
  const { supabase, workspace } = await requireWorkspace();
  // Requests keep their own snapshot, so deleting a template never affects them.
  const { error } = await supabase.from("flow_templates").delete().eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/templates");
  return { ok: true };
}
