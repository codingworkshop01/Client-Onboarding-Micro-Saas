"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Copy, Eye, MoreHorizontal, Plus, Settings2, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { STEP_TYPES, STEP_TYPE_META, templateSchema, type Step, type TemplateInput } from "@/lib/flows/schema";
import { cloneStep, newStep } from "@/lib/flows/logic";
import { cn } from "@/lib/utils";
import { SortableItem, SortableList } from "./sortable";
import { StepTypeIcon } from "./step-icon";
import { StepEditor, type AgreementOption } from "./step-editors";
import { PortalPreview } from "@/components/portal/portal-preview";

export type Brand = { name: string; color: string; logoUrl: string | null };
type SaveResult = { ok: true; id?: string } | { ok: false; error: string };

export function FlowBuilder({ initial, onSave, agreements, paymentsEnabled, brand, backHref = "/templates", saveLabel = "Save", afterSaveHref, banner }: {
  initial: TemplateInput;
  onSave: (draft: TemplateInput) => Promise<SaveResult>;
  agreements: AgreementOption[];
  paymentsEnabled: boolean;
  brand: Brand;
  backHref?: string;
  saveLabel?: string;
  afterSaveHref?: (id?: string) => string | undefined;
  banner?: React.ReactNode;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<TemplateInput>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial.steps[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileEditor, setMobileEditor] = useState(false);

  const update = (next: TemplateInput) => { setDraft(next); setDirty(true); };
  const setSteps = (steps: Step[]) => update({ ...draft, steps });
  const selected = draft.steps.find((s) => s.id === selectedId) ?? null;

  const save = useCallback(() => {
    const parsed = templateSchema.safeParse(draft);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      const stepIndex = typeof issue.path[1] === "number" ? issue.path[1] : null;
      if (issue.path[0] === "steps" && stepIndex !== null) setSelectedId(draft.steps[stepIndex]?.id ?? null);
      toast.error(stepIndex !== null ? `Step ${stepIndex + 1}: ${issue.message}` : issue.message);
      return;
    }
    startSave(async () => {
      const res = await onSave(parsed.data);
      if (!res.ok) { toast.error(res.error); return; }
      setDirty(false);
      toast.success("Saved");
      const href = afterSaveHref?.(res.id);
      if (href) router.push(href); else router.refresh();
    });
  }, [draft, onSave, afterSaveHref, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    };
    const onUnload = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onUnload); };
  }, [save, dirty]);

  const addStep = (type: Step["type"]) => {
    const s = newStep(type);
    const idx = selected ? draft.steps.findIndex((x) => x.id === selected.id) + 1 : draft.steps.length;
    const steps = [...draft.steps];
    steps.splice(idx, 0, s);
    setSteps(steps);
    setSelectedId(s.id);
    setMobileEditor(true);
  };

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-10 lg:-my-9">
      <div className="sticky top-14 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur sm:px-6 lg:top-0 lg:px-10">
        <Button variant="ghost" size="icon-sm" asChild><Link href={backHref} aria-label="Back"><ArrowLeft /></Link></Button>
        <input
          aria-label="Template name"
          value={draft.name}
          onChange={(e) => update({ ...draft, name: e.target.value })}
          className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-1 text-[15px] font-semibold outline-none hover:bg-accent/60 focus:bg-accent/60"
        />
        <span className={cn("hidden items-center gap-1 text-xs sm:flex", dirty ? "text-warning" : "text-muted-foreground")}>
          {dirty ? "Unsaved changes" : <><Check className="size-3.5" />Saved</>}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => setSettingsOpen(true)} aria-label="Template settings"><Settings2 /></Button>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}><Eye />Preview</Button>
        <Button size="sm" onClick={save} loading={saving}>{saveLabel}</Button>
      </div>

      {banner && <div className="px-4 pt-4 sm:px-6 lg:px-10">{banner}</div>}

      <div className="grid gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-10">
        <aside className={cn("lg:block", mobileEditor && "hidden")}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Steps <span className="font-normal text-muted-foreground">({draft.steps.length})</span></h2>
          </div>
          <div className="grid gap-1.5">
            {draft.steps.length === 0 && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Add your first step.</p>}
            <SortableList items={draft.steps} onReorder={setSteps}>
              {(step, i) => (
                <SortableItem key={step.id} id={step.id}
                  className={cn("rounded-lg border bg-card transition-colors", step.id === selectedId ? "border-foreground/40 ring-1 ring-foreground/10" : "hover:border-foreground/20")}>
                  <div className="flex items-center gap-2 py-2 pr-1.5">
                    <button type="button" onClick={() => { setSelectedId(step.id); setMobileEditor(true); }} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <StepTypeIcon type={step.type} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{i + 1}. {step.title || "Untitled step"}</span>
                        <span className="block text-xs text-muted-foreground">{STEP_TYPE_META[step.type].label}{!step.required && " · Optional"}</span>
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Step actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { const c = cloneStep(step); c.title = `${step.title} (copy)`; const s = [...draft.steps]; s.splice(i + 1, 0, c); setSteps(s); setSelectedId(c.id); }}><Copy />Duplicate</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => { const s = draft.steps.filter((x) => x.id !== step.id); setSteps(s); if (selectedId === step.id) setSelectedId(s[Math.max(0, i - 1)]?.id ?? null); }}><Trash2 />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </SortableItem>
              )}
            </SortableList>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" className="mt-1 w-full border-dashed"><Plus />Add step</Button></DropdownMenuTrigger>
              <DropdownMenuContent className="w-72" align="start">
                {STEP_TYPES.map((t) => (
                  <DropdownMenuItem key={t} onSelect={() => addStep(t)} className="items-start py-2">
                    <StepTypeIcon type={t} className="size-6" />
                    <span><span className="block text-sm font-medium text-foreground">{STEP_TYPE_META[t].label}</span><span className="block text-xs text-muted-foreground">{STEP_TYPE_META[t].description}</span></span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Tip: press <kbd className="rounded border bg-muted px-1 font-mono">⌘S</kbd> to save.</p>
        </aside>

        <section className={cn("min-w-0 lg:block", !mobileEditor && "hidden")}>
          <Button variant="ghost" size="sm" className="mb-3 lg:hidden" onClick={() => setMobileEditor(false)}><ArrowLeft />All steps</Button>
          {selected ? (
            <div className="rounded-xl border bg-card p-4 shadow-card sm:p-6">
              <StepEditor
                key={selected.id}
                step={selected}
                agreements={agreements}
                paymentsEnabled={paymentsEnabled}
                onChange={(s) => setSteps(draft.steps.map((x) => (x.id === s.id ? s : x)))}
              />
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">Select a step to edit it.</div>
          )}
        </section>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Template settings</DialogTitle><DialogDescription>Internal details. Clients see the onboarding title you set when sending.</DialogDescription></DialogHeader>
          <Field label="Name" htmlFor="t-name"><Input id="t-name" value={draft.name} onChange={(e) => update({ ...draft, name: e.target.value })} /></Field>
          <Field label="Category" htmlFor="t-cat" optionalHint><Input id="t-cat" value={draft.category ?? ""} placeholder="e.g. Web design" onChange={(e) => update({ ...draft, category: e.target.value || undefined })} /></Field>
          <Field label="Description" htmlFor="t-desc" optionalHint><Textarea id="t-desc" value={draft.description ?? ""} onChange={(e) => update({ ...draft, description: e.target.value || undefined })} /></Field>
          <DialogFooter><Button onClick={() => setSettingsOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[calc(100dvh-2rem)] max-w-5xl gap-0 overflow-hidden p-0" hideClose>
          <DialogTitle className="sr-only">Client preview</DialogTitle>
          <div className="flex h-11 items-center justify-between border-b bg-surface px-4">
            <span className="flex items-center gap-2 text-[13px] text-muted-foreground"><Eye className="size-4" />Preview: what your client sees <Badge variant="outline">Nothing is saved</Badge></span>
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)}>Close</Button>
          </div>
          <div className="h-[calc(100%-2.75rem)] overflow-y-auto">
            <PortalPreview steps={draft.steps} brand={brand} title={draft.name} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
