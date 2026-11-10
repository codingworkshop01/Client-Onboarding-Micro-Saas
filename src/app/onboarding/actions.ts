"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStarter } from "@/lib/flows/starters";
import { cloneStep } from "@/lib/flows/logic";
import { toJson } from "@/lib/supabase/json";

export type CreateWorkspaceState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "3–40 characters: lowercase letters, numbers and dashes"),
  starter: z.string().max(40).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function createWorkspace(_: CreateWorkspaceState, form: FormData): Promise<CreateWorkspaceState> {
  const parsed = schema.safeParse({
    name: form.get("name"),
    slug: form.get("slug"),
    starter: form.get("starter") || undefined,
    brandColor: form.get("brandColor") || undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wsId, error } = await supabase.rpc("create_workspace", { p_name: parsed.data.name, p_slug: parsed.data.slug });
  if (error) {
    if (error.code === "23505") return { fieldErrors: { slug: ["That URL is taken. Try another."] } };
    return { error: "Couldn't create your workspace. Please try again." };
  }
  if (parsed.data.brandColor) await supabase.from("workspaces").update({ brand_color: parsed.data.brandColor }).eq("id", wsId);

  // Install the chosen starter template plus the general one so the workspace isn't empty.
  const keys = Array.from(new Set([parsed.data.starter, "general"].filter(Boolean))) as string[];
  const rows = keys.map(getStarter).filter((s): s is NonNullable<typeof s> => Boolean(s)).map((s) => ({
    workspace_id: wsId,
    name: s.name,
    description: s.description,
    category: s.category,
    source: "starter",
    steps: toJson(s.steps.map(cloneStep)),
    created_by: user.id,
  }));
  if (rows.length) await supabase.from("flow_templates").insert(rows);

  redirect("/dashboard?welcome=1");
}
