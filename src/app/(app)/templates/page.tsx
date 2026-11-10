import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { LayoutTemplate, Sparkles } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { stepsSchema } from "@/lib/flows/schema";
import { STARTER_TEMPLATES } from "@/lib/flows/starters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { StepTypeIcon } from "@/components/builder/step-icon";
import { NewTemplateButton, TemplateMenu } from "./template-actions";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const { supabase, workspace } = await requireWorkspace();
  const { data: templates } = await supabase
    .from("flow_templates")
    .select("*")
    .eq("workspace_id", workspace.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable onboarding flows. Each request copies its template, so editing one never affects links you've already sent."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/templates/ai"><Sparkles className="text-[#7c3aed]" />Generate with AI</Link></Button>
            <NewTemplateButton starters={STARTER_TEMPLATES.map(({ key, name, description, category, steps }) => ({ key, name, description, category, types: steps.map((s) => s.type) }))} />
          </>
        }
      />
      {!templates?.length ? (
        <EmptyState icon={LayoutTemplate} title="No templates yet" description="Start from a proven starter template, build from scratch, or let AI draft one from a proposal." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const steps = stepsSchema.safeParse(t.steps);
            const list = steps.success ? steps.data : [];
            return (
              <Card key={t.id} className="group relative flex flex-col p-4 transition-shadow hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/templates/${t.id}`} className="min-w-0 after:absolute after:inset-0">
                    <h3 className="truncate text-sm font-semibold">{t.name}</h3>
                  </Link>
                  <div className="relative z-10 -mt-1 -mr-1"><TemplateMenu id={t.id} name={t.name} /></div>
                </div>
                <p className="mt-1 line-clamp-2 min-h-10 text-[13px] text-muted-foreground">{t.description || "No description"}</p>
                <div className="mt-4 flex items-center gap-1">
                  {list.map((s) => <StepTypeIcon key={s.id} type={s.type} className="size-6" />)}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{list.length} {list.length === 1 ? "step" : "steps"}{t.source === "ai" && <Badge variant="info" className="ml-2">AI</Badge>}</span>
                  <span>Edited {formatDistanceToNowStrict(new Date(t.updated_at), { addSuffix: true })}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
