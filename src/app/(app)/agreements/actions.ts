"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { STARTER_TEMPLATES } from "@/lib/flows/starters";

const schema = z.object({ name: z.string().trim().min(1, "Name is required").max(120), body: z.string().min(1, "Agreement text is required").max(100_000) });

export async function createAgreement() {
  const { supabase, workspace, user } = await requireWorkspace();
  const starter = STARTER_TEMPLATES.find((t) => t.key === "general")!.steps.find((s) => s.type === "agreement");
  const body = starter?.type === "agreement" ? starter.config.body : "";
  const { data, error } = await supabase.from("agreement_templates").insert({ workspace_id: workspace.id, created_by: user.id, name: "Untitled agreement", body }).select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/agreements/${data.id}`);
}

export async function saveAgreement(id: string, input: z.input<typeof schema>) {
  const v = schema.safeParse(input);
  if (!v.success) return { ok: false as const, error: v.error.issues[0]!.message };
  const { supabase, workspace } = await requireWorkspace();
  const { error } = await supabase.from("agreement_templates").update(v.data).eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { ok: false as const, error: "Couldn't save" };
  revalidatePath("/agreements");
  return { ok: true as const };
}

export async function deleteAgreement(id: string) {
  const { supabase, workspace } = await requireWorkspace();
  await supabase.from("agreement_templates").delete().eq("id", id).eq("workspace_id", workspace.id);
  revalidatePath("/agreements");
  redirect("/agreements");
}
