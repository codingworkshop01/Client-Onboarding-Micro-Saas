"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Lock, MessageCircle, PartyPopper } from "lucide-react";
import { cn, readableOn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { STEP_ICON } from "@/components/builder/step-icon";
import type { PortalAdapter, PortalData, PortalStep } from "./types";
import { FormStepView } from "./step-form";
import { FilesStepView } from "./step-files";
import { AccessStepView } from "./step-access";
import { AgreementStepView } from "./step-agreement";
import { PaymentStepView } from "./step-payment";
import { CommentsPanel } from "./comments";

export function PortalApp({ data, adapter, initialStepId }: { data: PortalData; adapter: PortalAdapter; initialStepId?: string | null }) {
  const steps = data.steps;
  const firstOpen = steps.find((s) => s.status !== "completed")?.id ?? null;
  const [activeId, setActiveId] = useState<string | null>(initialStepId ?? null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // On desktop, always show a step (defaults to the first unfinished one).
  const shownId = activeId ?? (isDesktop ? firstOpen ?? steps[0]?.id ?? null : null);
  const active = steps.find((s) => s.id === shownId) ?? null;
  const done = steps.filter((s) => s.status === "completed").length;
  const requiredLeft = steps.filter((s) => s.required && s.status !== "completed").length;
  const allDone = steps.length > 0 && requiredLeft === 0;
  const percent = steps.length ? Math.round((done / steps.length) * 100) : 0;

  const brandStyle = useMemo(() => ({ "--brand": data.workspace.color, "--brand-foreground": readableOn(data.workspace.color) }) as React.CSSProperties, [data.workspace.color]);

  const goNext = (fromId: string) => {
    const idx = steps.findIndex((s) => s.id === fromId);
    const next = steps.slice(idx + 1).find((s) => s.status !== "completed") ?? steps.find((s) => s.status !== "completed" && s.id !== fromId);
    setActiveId(next?.id ?? null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={brandStyle} className="min-h-full bg-surface">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          {data.workspace.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.workspace.logoUrl} alt={data.workspace.name} className="h-8 max-w-[160px] object-contain" />
          ) : (
            <span className="flex items-center gap-2 font-semibold">
              <span className="flex size-8 items-center justify-center rounded-lg text-sm" style={{ background: data.workspace.color, color: readableOn(data.workspace.color) }}>{data.workspace.name[0]}</span>
              {data.workspace.name}
            </span>
          )}
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setCommentsOpen(true)}>
            <MessageCircle />Questions?
            {data.comments.some((c) => c.authorType === "member") && <span className="size-1.5 rounded-full bg-brand" />}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
        <div className={cn("mb-6", active && !isDesktop && "hidden")}>
          <p className="text-sm text-muted-foreground">Hi {data.client.name.split(" ")[0]} 👋</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance sm:text-[28px]">{data.request.title}</h1>
          {(data.request.message || data.workspace.welcomeMessage) && (
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed whitespace-pre-line text-muted-foreground">{data.request.message || data.workspace.welcomeMessage}</p>
          )}
          <div className="mt-5 max-w-md">
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="font-medium">{allDone ? "All done" : `${done} of ${steps.length} complete`}</span>
              {data.request.dueDate && !allDone && <span className="text-muted-foreground">Due {new Date(`${data.request.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
          <nav aria-label="Onboarding steps" className={cn("lg:sticky lg:top-6", active && !isDesktop && "hidden")}>
            <ol className="overflow-hidden rounded-xl border bg-background">
              {steps.map((s, i) => (
                <li key={s.id} className="border-b last:border-b-0">
                  <StepRow step={s} index={i} active={s.id === shownId} onClick={() => setActiveId(s.id)} />
                </li>
              ))}
            </ol>
            <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><Lock className="size-3" />Your progress saves automatically. Come back with this link anytime.</p>
          </nav>

          <main className="min-w-0">
            {active ? (
              <div className="rounded-xl border bg-background shadow-card">
                <div className="border-b px-5 py-4 sm:px-7 sm:py-5">
                  {!isDesktop && (
                    <button onClick={() => setActiveId(null)} className="mb-3 flex items-center gap-1 text-[13px] text-muted-foreground"><ArrowLeft className="size-3.5" />All steps</button>
                  )}
                  <div className="text-xs font-medium text-muted-foreground">Step {steps.findIndex((s) => s.id === active.id) + 1} of {steps.length}{!active.required && " · Optional"}</div>
                  <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{active.title}</h2>
                  {active.description && <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{active.description}</p>}
                </div>
                <div className="px-5 py-5 sm:px-7 sm:py-6">
                  <StepBody key={active.id} step={active} data={data} adapter={adapter} onDone={() => goNext(active.id)} />
                </div>
              </div>
            ) : allDone ? (
              <CompletionCard data={data} />
            ) : null}
          </main>
        </div>

        {allDone && active && (
          <div className="mt-6 lg:ml-[304px]"><CompletionCard data={data} compact /></div>
        )}

        {data.workspace.showBranding && (
          <p className="mt-12 text-center text-xs text-muted-foreground">Secure onboarding powered by <span className="font-medium">{process.env.NEXT_PUBLIC_APP_NAME ?? "Onboardly"}</span></p>
        )}
      </div>

      <CommentsPanel open={commentsOpen} onOpenChange={setCommentsOpen} data={data} adapter={adapter} />
    </div>
  );
}

function StepRow({ step, index, active, onClick }: { step: PortalStep; index: number; active: boolean; onClick: () => void }) {
  const Icon = STEP_ICON[step.type];
  const complete = step.status === "completed";
  return (
    <button onClick={onClick} aria-current={active ? "step" : undefined}
      className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors", active ? "bg-accent/70" : "hover:bg-accent/40")}>
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
        complete ? "border-transparent bg-brand text-brand-foreground" : step.status === "in_progress" ? "border-brand text-brand" : "text-muted-foreground")}>
        {complete ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", complete && "text-muted-foreground")}>{step.title}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon className="size-3" />
          {complete ? (step.data.skipped ? "Skipped" : "Complete") : step.status === "in_progress" ? "In progress" : step.required ? "To do" : "Optional"}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground lg:hidden" />
    </button>
  );
}

function StepBody({ step, data, adapter, onDone }: { step: PortalStep; data: PortalData; adapter: PortalAdapter; onDone: () => void }) {
  switch (step.type) {
    case "form": return <FormStepView step={step} data={data} adapter={adapter} onDone={onDone} />;
    case "files": return <FilesStepView step={step} data={data} adapter={adapter} onDone={onDone} />;
    case "access": return <AccessStepView step={step} adapter={adapter} onDone={onDone} />;
    case "agreement": return <AgreementStepView step={step} data={data} adapter={adapter} onDone={onDone} />;
    case "payment": return <PaymentStepView step={step} data={data} adapter={adapter} onDone={onDone} />;
  }
}

function CompletionCard({ data, compact }: { data: PortalData; compact?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-background text-center shadow-card", compact ? "p-5" : "px-6 py-14")}>
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground"><PartyPopper className="size-6" /></div>
      <h2 className="text-lg font-semibold">You&apos;re all set!</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Thanks, {data.client.name.split(" ")[0]}. {data.workspace.name} has everything they need to get started and will be in touch shortly.
        You can come back to this page anytime to review what you submitted.
      </p>
    </div>
  );
}

/** Shared footer for steps: optional skip + primary continue. */
export function StepActions({ step, adapter, onSubmit, submitLabel = "Continue", loading, onDone, disabled }: {
  step: PortalStep; adapter: PortalAdapter; onSubmit?: () => void; submitLabel?: string; loading?: boolean; onDone: () => void; disabled?: boolean;
}) {
  const [skipping, setSkipping] = useState(false);
  const canSkip = !step.required && step.status !== "completed";
  if (!onSubmit && !canSkip) return null;
  return (
    <div className="mt-8 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-end">
      {canSkip && (
        <Button variant="ghost" loading={skipping} onClick={async () => { setSkipping(true); const r = await adapter.skipStep(step.id); setSkipping(false); if (r.ok) onDone(); }}>Skip this step</Button>
      )}
      {onSubmit && <Button variant="brand" size="lg" onClick={onSubmit} loading={loading} disabled={disabled} className="sm:min-w-36">{submitLabel}</Button>}
    </div>
  );
}
