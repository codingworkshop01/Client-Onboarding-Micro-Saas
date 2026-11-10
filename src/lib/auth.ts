import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

/** Signed-in user or null. Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

/**
 * Resolve the signed-in user, their profile and current workspace.
 * Redirects to /login or /onboarding when either is missing.
 */
export const requireWorkspace = cache(async () => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(*)")
    .eq("user_id", user.id);

  const list = (memberships ?? []).filter((m) => m.workspace);
  if (list.length === 0) redirect("/onboarding");

  const current = list.find((m) => m.workspace!.id === profile?.current_workspace_id) ?? list[0]!;
  return {
    supabase,
    user,
    profile,
    workspace: current.workspace as Workspace,
    role: current.role as MemberRole,
    workspaces: list.map((m) => ({ ...(m.workspace as Workspace), role: m.role })),
  };
});

export function canAdmin(role: MemberRole) {
  return role === "owner" || role === "admin";
}

export function displayName(profile: { full_name: string | null; email: string } | null | undefined) {
  return profile?.full_name || profile?.email?.split("@")[0] || "Team member";
}
