import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { stepsSchema } from "@/lib/flows/schema";
import { features } from "@/lib/env";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { NewRequestForm } from "./new-request-form";

export const metadata = { title: "New onboarding" };

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ template?: string; client?: string }> }) {
  const sp = await searchParams;
  const { supabase, workspace } = await requireWorkspace();
  const [{ data: clients }, { data: templates }] = await Promise.all([
    supabase.from("clients").select("id, name, email, company").eq("workspace_id", workspace.id).is("archived_at", null).order("name"),
    supabase.from("flow_templates").select("id, name, description, steps").eq("workspace_id", workspace.id).is("archived_at", null).order("updated_at", { ascending: false }),
  ]);
  const tpls = (templates ?? []).map((t) => {
    const s = stepsSchema.safeParse(t.steps);
    return { id: t.id, name: t.name, description: t.description, types: s.success ? s.data.map((x) => x.type) : [] };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New onboarding" description="Choose a client and a template. They'll get one secure link to complete everything." />
      {tpls.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">You need a template first.</p>
          <Button asChild className="mt-4"><Link href="/templates">Create a template</Link></Button>
        </div>
      ) : (
        <NewRequestForm
          clients={clients ?? []}
          templates={tpls}
          defaultTemplateId={tpls.find((t) => t.id === sp.template)?.id ?? tpls[0]!.id}
          defaultClientId={(clients ?? []).find((c) => c.id === sp.client)?.id}
          defaultInterval={workspace.reminder_interval_days}
          emailConfigured={features.email() !== null}
        />
      )}
    </div>
  );
}
