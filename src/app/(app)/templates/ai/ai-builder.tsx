"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, Info, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FlowBuilder, type Brand } from "@/components/builder/flow-builder";
import type { AgreementOption } from "@/components/builder/step-editors";
import type { TemplateInput } from "@/lib/flows/schema";
import { generateDraft, saveAiTemplate } from "../ai-actions";

const EXAMPLE = `Hi Sam,

Thanks for the call! As discussed, we'll redesign the Bloom Bakery website on WordPress: 6 pages (Home, Menu, About, Catering, Blog, Contact), an online ordering integration with Square, and basic on-page SEO. We'll also set up Google Analytics 4 and Search Console.

Timeline: 5 weeks from kickoff. Total fee is $4,800 with a 50% deposit ($2,400) to start.

To get going we'll need your logo files, any brand colours/fonts, photos of the shop and products, your current menu (PDF is fine), and access to your hosting (SiteGround) and domain.

Best,
Alex`;

export function AiBuilder({ enabled, usage, agreements, paymentsEnabled, brand }: { enabled: boolean; usage: { used: number; limit: number }; agreements: AgreementOption[]; paymentsEnabled: boolean; brand: Brand }) {
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<{ template: TemplateInput; summary: string } | null>(null);

  if (draft) {
    return (
      <FlowBuilder
        initial={draft.template}
        onSave={saveAiTemplate}
        agreements={agreements}
        paymentsEnabled={paymentsEnabled}
        brand={brand}
        saveLabel="Save template"
        afterSaveHref={(id) => (id ? `/templates/${id}` : undefined)}
        banner={
          <div className="flex flex-col gap-3 rounded-xl border border-[#7c3aed]/20 bg-[#7c3aed]/5 p-4 sm:flex-row sm:items-start">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-[#7c3aed]" />
            <div className="flex-1 text-sm"><span className="font-medium">AI draft. Review everything before saving.</span> <span className="text-muted-foreground">{draft.summary}</span></div>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}><ArrowLeft />Start over</Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#7c3aed]/20 bg-[#7c3aed]/5 px-2.5 py-0.5 text-xs font-medium text-[#7c3aed]"><Sparkles className="size-3" />AI Request Builder</div>
        <h1 className="text-[22px] font-semibold tracking-tight">Turn a proposal into an onboarding flow</h1>
        <p className="mt-1 text-sm text-muted-foreground">Paste a proposal, scope of work or client email. You&apos;ll get tailored questions, a document checklist, account access steps, an agreement draft and a payment step, ready for you to review and edit.</p>
      </div>
      {!enabled && (
        <div className="mb-4 flex gap-2 rounded-lg border border-warning/25 bg-warning-soft p-3 text-[13px] text-warning">
          <Info className="mt-0.5 size-4 shrink-0" />AI isn&apos;t configured on this server. Add <code className="font-mono">ANTHROPIC_API_KEY</code> to the environment to enable it.
        </div>
      )}
      <Card className="p-4">
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={14} placeholder="Paste your proposal, scope of work, or client email here…" className="border-0 p-1 text-[15px] shadow-none focus-visible:ring-0" maxLength={40000} />
        <div className="mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button className="font-medium text-foreground hover:underline" onClick={() => setInput(EXAMPLE)}>Use an example</button>
            <span>{usage.used} of {usage.limit} generations used this month</span>
          </div>
          <Button disabled={!enabled || input.trim().length < 40} loading={pending} onClick={() => start(async () => {
            const r = await generateDraft(input);
            if (!r.ok) return void toast.error(r.error);
            setDraft({ template: r.draft, summary: r.summary });
          })}>{!pending && <Wand2 />}{pending ? "Designing your flow…" : "Generate onboarding"}</Button>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Your text is sent to our AI provider (Anthropic) to generate the draft and isn&apos;t shown to your clients. Nothing is sent to clients until you review, save and send it.</p>
    </div>
  );
}
