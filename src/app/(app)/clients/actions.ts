"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireWorkspace, displayName, canAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createAdminClient } from "@/lib/supabase/admin";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
});

export async function saveClient(id: string | null, input: z.input<typeof clientSchema>): Promise<R<{ id: string }>> {
  const v = clientSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]!.message, fieldErrors: v.error.flatten().fieldErrors };
  const { supabase, workspace, user, profile } = await requireWorkspace();
  const row = { name: v.data.name, email: v.data.email, company: v.data.company || null, phone: v.data.phone || null, website: v.data.website || null };
  if (id) {
    const { error } = await supabase.from("clients").update(row).eq("id", id).eq("workspace_id", workspace.id);
    if (error) return { ok: false, error: error.code === "23505" ? "Another client already uses that email" : "Couldn't save" };
    revalidatePath(`/clients/${id}`);
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("clients").insert({ ...row, workspace_id: workspace.id, created_by: user.id }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? "A client with that email already exists" : "Couldn't save" };
  await logActivity({ workspaceId: workspace.id, clientId: data.id, actorType: "member", actorId: user.id, actorName: displayName(profile), type: "client.created", payload: { name: row.name } });
  revalidatePath("/clients");
  return { ok: true, id: data.id };
}

export async function addNote(clientId: string, body: string): Promise<R> {
  const text = z.string().trim().min(1).max(5000).safeParse(body);
  if (!text.success) return { ok: false, error: "Write a note first" };
  const { supabase, workspace, user, profile } = await requireWorkspace();
  const { error } = await supabase.from("client_notes").insert({ workspace_id: workspace.id, client_id: clientId, author_id: user.id, author_name: displayName(profile), body: text.data });
  if (error) return { ok: false, error: "Couldn't save note" };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function deleteNote(noteId: string, clientId: string): Promise<R> {
  const { supabase } = await requireWorkspace();
  await supabase.from("client_notes").delete().eq("id", noteId);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function archiveClient(id: string, archived: boolean): Promise<R> {
  const { supabase, workspace } = await requireWorkspace();
  await supabase.from("clients").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id).eq("workspace_id", workspace.id);
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

export async function deleteClient(id: string): Promise<R> {
  const { supabase, workspace, role } = await requireWorkspace();
  if (!canAdmin(role)) return { ok: false, error: "Only owners and admins can delete clients" };
  const admin = createAdminClient();
  const { data: docs } = await admin.from("documents").select("storage_path").eq("client_id", id).eq("workspace_id", workspace.id);
  const { data: reqs } = await admin.from("onboarding_requests").select("id").eq("client_id", id).eq("workspace_id", workspace.id);
  const { data: sigs } = reqs?.length ? await admin.from("signatures").select("pdf_path").in("request_id", reqs.map((r) => r.id)) : { data: [] };
  const paths = [...(docs ?? []).map((d) => d.storage_path), ...(sigs ?? []).map((s) => s.pdf_path).filter((p): p is string => !!p)];
  if (paths.length) await admin.storage.from("client-files").remove(paths);
  const { error } = await supabase.from("clients").delete().eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  return { ok: true };
}
