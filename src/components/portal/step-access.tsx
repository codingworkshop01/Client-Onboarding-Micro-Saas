"use client";
import { useState } from "react";
import { CheckCircle2, ExternalLink, PlayCircle, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { AccessStep } from "@/lib/flows/schema";
import { ACCESS_PLATFORM_GUIDES, renderGuideSteps } from "@/lib/flows/access-platforms";
import { cn } from "@/lib/utils";
import type { PortalAdapter, PortalStep } from "./types";
import { StepActions } from "./portal-app";

export function AccessStepView({ step, adapter, onDone }: { step: PortalStep & AccessStep; adapter: PortalAdapter; onDone: () => void }) {
  const [conf, setConf] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.entries(step.data.confirmations ?? {}).map(([k, v]) => [k, v.confirmed])),
  );
  const [open, setOpen] = useState<string | null>(step.config.items.find((i) => !conf[i.id])?.id ?? step.config.items[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggle = async (itemId: string, value: boolean) => {
    setConf((c) => ({ ...c, [itemId]: value }));
    const r = await adapter.confirmAccess(step.id, itemId, value);
    if (!r.ok) { setConf((c) => ({ ...c, [itemId]: !value })); setError(r.error); return; }
    if (value) {
      const idx = step.config.items.findIndex((i) => i.id === itemId);
      const next = step.config.items.slice(idx + 1).find((i) => !conf[i.id]);
      if (next) setOpen(next.id);
    }
  };

  const missing = step.config.items.filter((i) => i.required && !conf[i.id]);
  const submit = async () => {
    if (missing.length) { setError("Please confirm each required platform once you've granted access."); return; }
    setSubmitting(true);
    const r = await adapter.submitStep(step.id);
    setSubmitting(false);
    if (!r.ok) { setError(r.error); return; }
    onDone();
  };

  return (
    <div>
      <div className="mb-5 flex gap-2.5 rounded-lg bg-muted/60 p-3 text-[13px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <p>You&apos;ll add us as a user on each platform. <strong className="font-medium text-foreground">Never share your password</strong>. You stay in control and can remove access at any time.</p>
      </div>
      <div className="grid gap-2.5">
        {step.config.items.map((item) => {
          const guide = ACCESS_PLATFORM_GUIDES[item.platform];
          const name = item.label || guide.name;
          const isOpen = open === item.id;
          const confirmed = !!conf[item.id];
          return (
            <div key={item.id} className={cn("rounded-lg border transition-colors", confirmed && "border-success/30 bg-success-soft/30")}>
              <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(isOpen ? null : item.id)} aria-expanded={isOpen}>
                {confirmed ? <CheckCircle2 className="size-5 text-success" /> : <span className="size-5 rounded-full border-2" />}
                <span className="flex-1">
                  <span className="block text-sm font-medium">{name}{!item.required && <span className="font-normal text-muted-foreground"> (optional)</span>}</span>
                  <span className="block text-xs text-muted-foreground">{confirmed ? "Access confirmed" : guide.short}</span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t px-4 pt-3 pb-4">
                  <ol className="grid gap-2 text-sm">
                    {renderGuideSteps(item.platform, step.config.grantToEmail).map((s, i) => (
                      <li key={i} className="flex gap-3"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{i + 1}</span><span className="leading-relaxed">{s}</span></li>
                    ))}
                  </ol>
                  {item.instructions && <p className="mt-3 rounded-md bg-muted/60 p-3 text-sm whitespace-pre-line">{item.instructions}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-[13px]">
                    {item.videoUrl && <a href={item.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline"><PlayCircle className="size-4" />Watch walkthrough</a>}
                    {guide.helpUrl && <a href={guide.helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">{guide.name} help<ExternalLink className="size-3" /></a>}
                  </div>
                  <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border bg-background px-3 py-3 text-sm font-medium">
                    <Checkbox checked={confirmed} onCheckedChange={(v) => toggle(item.id, v === true)} className="data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground" />
                    I&apos;ve granted access to {name}
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <StepActions step={step} adapter={adapter} onDone={onDone} onSubmit={submit} loading={submitting} submitLabel={step.status === "completed" ? "Done" : "Continue"} />
    </div>
  );
}
