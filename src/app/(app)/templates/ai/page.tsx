import { requireWorkspace } from "@/lib/auth";
import { features } from "@/lib/env";
import { aiUsageThisMonth } from "@/lib/ai/quota";
import { PLANS } from "@/lib/plans";
import { AiBuilder } from "./ai-builder";

export const metadata = { title: "AI Request Builder" };

export default async function AiBuilderPage() {
  const { supabase, workspace } = await requireWorkspace();
  const [{ data: agreements }, used] = await Promise.all([
    supabase.from("agreement_templates").select("id, name, body").eq("workspace_id", workspace.id),
    aiUsageThisMonth(supabase, workspace.id),
  ]);
  return (
    <AiBuilder
      enabled={features.ai()}
      usage={{ used, limit: PLANS[workspace.plan].aiGenerationsPerMonth }}
      agreements={agreements ?? []}
      paymentsEnabled={features.payments() && workspace.stripe_charges_enabled}
      brand={{ name: workspace.name, color: workspace.brand_color, logoUrl: workspace.logo_url }}
    />
  );
}
