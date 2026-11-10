import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { stepsSchema } from "@/lib/flows/schema";
import { features } from "@/lib/env";
import { TemplateEditor } from "./template-editor";

export const metadata = { title: "Edit template" };

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, workspace } = await requireWorkspace();
  const [{ data: t }, { data: agreements }] = await Promise.all([
    supabase.from("flow_templates").select("*").eq("id", id).eq("workspace_id", workspace.id).maybeSingle(),
    supabase.from("agreement_templates").select("id, name, body").eq("workspace_id", workspace.id).order("name"),
  ]);
  if (!t) notFound();
  const steps = stepsSchema.safeParse(t.steps);

  return (
    <TemplateEditor
      id={t.id}
      initial={{ name: t.name, description: t.description ?? undefined, category: t.category ?? undefined, steps: steps.success ? steps.data : [] }}
      agreements={agreements ?? []}
      paymentsEnabled={features.payments() && workspace.stripe_charges_enabled}
      brand={{ name: workspace.name, color: workspace.brand_color, logoUrl: workspace.logo_url }}
    />
  );
}
