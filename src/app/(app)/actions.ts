"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/auth";

export async function switchWorkspace(workspaceId: string) {
  const id = z.string().uuid().parse(workspaceId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // RLS on profiles ensures the user is a member of the target workspace.
  await supabase.from("profiles").update({ current_workspace_id: id }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export type SearchHit = { type: "client" | "request" | "template"; id: string; title: string; subtitle?: string; href: string };

export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = z.string().trim().max(80).parse(query);
  if (q.length < 2) return [];
  const { supabase, workspace } = await requireWorkspace();
  const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const [clients, requests, templates] = await Promise.all([
    supabase.from("clients").select("id, name, email, company").eq("workspace_id", workspace.id).or(`name.ilike.${like},email.ilike.${like},company.ilike.${like}`).limit(5),
    supabase.from("onboarding_requests").select("id, title, client:clients(name)").eq("workspace_id", workspace.id).ilike("title", like).limit(5),
    supabase.from("flow_templates").select("id, name").eq("workspace_id", workspace.id).is("archived_at", null).ilike("name", like).limit(5),
  ]);
  return [
    ...(clients.data ?? []).map((c) => ({ type: "client" as const, id: c.id, title: c.name, subtitle: c.company || c.email, href: `/clients/${c.id}` })),
    ...(requests.data ?? []).map((r) => ({ type: "request" as const, id: r.id, title: r.title, subtitle: r.client?.name, href: `/requests/${r.id}` })),
    ...(templates.data ?? []).map((t) => ({ type: "template" as const, id: t.id, title: t.name, href: `/templates/${t.id}` })),
  ];
}
