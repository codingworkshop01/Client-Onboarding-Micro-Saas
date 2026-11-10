import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/plans";
import type { Workspace } from "@/lib/auth";

export async function aiUsageThisMonth(supabase: SupabaseClient<Database>, workspaceId: string) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase.from("ai_generations").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", start.toISOString());
  return count ?? 0;
}

export async function assertAiQuota(supabase: SupabaseClient<Database>, workspace: Workspace) {
  const used = await aiUsageThisMonth(supabase, workspace.id);
  const limit = PLANS[workspace.plan].aiGenerationsPerMonth;
  if (used >= limit) throw new Error(`You've used all ${limit} AI generations on the ${PLANS[workspace.plan].name} plan this month. Upgrade in Settings → Billing for more.`);
}

export async function recordAiUse(workspaceId: string, userId: string, kind: string, inputChars: number, output?: unknown) {
  await createAdminClient().from("ai_generations").insert({ workspace_id: workspaceId, user_id: userId, kind, input_chars: inputChars, model: process.env.AI_MODEL || "claude-opus-5-5", output: (output ?? null) as never });
}
