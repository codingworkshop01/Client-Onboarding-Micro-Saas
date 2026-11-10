"use client";
import { useRef } from "react";
import { ExternalLink, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACCESS_PLATFORMS, STEP_TYPE_META, type AccessStep, type AgreementStep, type FilesStep, type FormStep, type PaymentStep, type Step,
} from "@/lib/flows/schema";
import { ACCESS_PLATFORM_GUIDES, renderGuideSteps } from "@/lib/flows/access-platforms";
import { MERGE_FIELDS } from "@/lib/merge-fields";
import { uid } from "@/lib/utils";
import { FieldsEditor, FileRules } from "./fields-editor";
import { SortableItem, SortableList } from "./sortable";
import { StepTypeIcon } from "./step-icon";

export type AgreementOption = { id: string; name: string; body: string };

export function StepEditor({ step, onChange, agreements, paymentsEnabled }: {
  step: Step; onChange: (s: Step) => void; agreements: AgreementOption[]; paymentsEnabled: boolean;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <StepTypeIcon type={step.type} className="size-9" />
        <div>
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{STEP_TYPE_META[step.type].label}</div>
          <div className="text-sm text-muted-foreground">{STEP_TYPE_META[step.type].description}</div>
        </div>
      </div>
      <div className="grid gap-4">
        <Field label="Step title" htmlFor="step-title">
          <Input id="step-title" value={step.title} onChange={(e) => onChange({ ...step, title: e.target.value })} />
        </Field>
        <Field label="Instructions for your client" htmlFor="step-desc" optionalHint>
          <Textarea id="step-desc" rows={2} value={step.description ?? ""} placeholder="Explain why you need this and what good looks like." onChange={(e) => onChange({ ...step, description: e.target.value || undefined })} />
        </Field>
        <label className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <span>
            <span className="block text-sm font-medium">Required step</span>
            <span className="block text-[13px] text-muted-foreground">Optional steps can be skipped and don&apos;t block completion.</span>
          </span>
          <Switch checked={step.required} onCheckedChange={(v) => onChange({ ...step, required: v })} />
        </label>
      </div>
      <div className="border-t pt-6">
        {step.type === "form" && <FormEditor step={step} onChange={onChange} />}
        {step.type === "files" && <FilesEditor step={step} onChange={onChange} />}
        {step.type === "access" && <AccessEditor step={step} onChange={onChange} />}
        {step.type === "agreement" && <AgreementEditor step={step} onChange={onChange} agreements={agreements} />}
        {step.type === "payment" && <PaymentEditor step={step} onChange={onChange} enabled={paymentsEnabled} />}
      </div>
    </div>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold">{children}</h3>
      {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FormEditor({ step, onChange }: { step: FormStep; onChange: (s: Step) => void }) {
  return (
    <>
      <SectionTitle hint="Drag to reorder. Use conditions to show follow-up questions only when relevant.">Questions</SectionTitle>
      <FieldsEditor fields={step.config.fields} onChange={(fields) => onChange({ ...step, config: { fields } })} />
    </>
  );
}

function FilesEditor({ step, onChange }: { step: FilesStep; onChange: (s: Step) => void }) {
  const items = step.config.items;
  const set = (next: FilesStep["config"]["items"]) => onChange({ ...step, config: { items: next } });
  const patch = (id: string, p: Partial<FilesStep["config"]["items"][number]>) => set(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  return (
    <>
      <SectionTitle hint="Each item becomes a separate upload slot your client can fill with one or more files.">Requested documents</SectionTitle>
      <div className="grid gap-2">
        <SortableList items={items} onReorder={set}>
          {(item) => (
            <SortableItem key={item.id} id={item.id} className="rounded-lg border bg-card">
              <div className="grid gap-3 p-3 pl-0">
                <div className="flex gap-2">
                  <Input aria-label="Document name" value={item.label} placeholder="e.g. Logo files" onChange={(e) => patch(item.id, { label: e.target.value })} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove document" disabled={items.length <= 1} onClick={() => set(items.filter((i) => i.id !== item.id))}><Trash2 /></Button>
                </div>
                <Input aria-label="Description" value={item.description ?? ""} placeholder="Help text (optional)" onChange={(e) => patch(item.id, { description: e.target.value || undefined })} />
                <FileRules accept={item.accept} maxSizeMb={item.maxSizeMb} onChange={(p) => patch(item.id, p)} />
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={item.required} onCheckedChange={(v) => patch(item.id, { required: v })} />Required</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={item.multiple} onCheckedChange={(v) => patch(item.id, { multiple: v })} />Allow multiple files</label>
                </div>
              </div>
            </SortableItem>
          )}
        </SortableList>
        <Button type="button" variant="outline" className="border-dashed" onClick={() => set([...items, { id: uid("d_"), label: "", required: true, accept: ["any"], maxSizeMb: 25, multiple: true }])}><Plus />Add document</Button>
      </div>
    </>
  );
}

function AccessEditor({ step, onChange }: { step: AccessStep; onChange: (s: Step) => void }) {
  const items = step.config.items;
  const set = (next: AccessStep["config"]["items"]) => onChange({ ...step, config: { ...step.config, items: next } });
  const patch = (id: string, p: Partial<AccessStep["config"]["items"][number]>) => set(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  return (
    <div className="grid gap-5">
      <div className="flex gap-2 rounded-lg bg-muted/60 p-3 text-[13px] text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>Clients follow step-by-step guides to add you as a user, then confirm. Passwords are never collected.</p>
      </div>
      <Field label="Email to grant access to" htmlFor="grant-email" description="Shown in every guide so clients know exactly who to invite.">
        <Input id="grant-email" type="email" value={step.config.grantToEmail ?? ""} placeholder="access@youragency.com" onChange={(e) => onChange({ ...step, config: { ...step.config, grantToEmail: e.target.value || undefined } })} />
      </Field>
      <div>
        <SectionTitle>Platforms</SectionTitle>
        <div className="grid gap-2">
          <SortableList items={items} onReorder={set}>
            {(item) => {
              const guide = ACCESS_PLATFORM_GUIDES[item.platform];
              return (
                <SortableItem key={item.id} id={item.id} className="rounded-lg border bg-card">
                  <div className="grid gap-3 p-3 pl-0">
                    <div className="flex gap-2">
                      <Select value={item.platform} onValueChange={(v) => patch(item.id, { platform: v as typeof item.platform })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ACCESS_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{ACCESS_PLATFORM_GUIDES[p].name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove platform" disabled={items.length <= 1} onClick={() => set(items.filter((i) => i.id !== item.id))}><Trash2 /></Button>
                    </div>
                    {item.platform === "other" && <Input aria-label="Platform name" value={item.label ?? ""} placeholder="Platform name, e.g. GitHub" onChange={(e) => patch(item.id, { label: e.target.value || undefined })} />}
                    <details className="rounded-md bg-muted/50 px-3 py-2 text-[13px]">
                      <summary className="cursor-pointer text-muted-foreground">Built-in guide ({guide.steps.length} steps)</summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-4">{renderGuideSteps(item.platform, step.config.grantToEmail).map((s, i) => <li key={i}>{s}</li>)}</ol>
                      {guide.helpUrl && <a href={guide.helpUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-info hover:underline">Official help article<ExternalLink className="size-3" /></a>}
                    </details>
                    <Textarea aria-label="Extra instructions" rows={2} value={item.instructions ?? ""} placeholder="Extra instructions, e.g. which ad account or permission level (optional)" onChange={(e) => patch(item.id, { instructions: e.target.value || undefined })} />
                    <Input aria-label="Video walkthrough URL" type="url" value={item.videoUrl ?? ""} placeholder="Loom / YouTube walkthrough URL (optional)" onChange={(e) => patch(item.id, { videoUrl: e.target.value || undefined })} />
                    <label className="flex items-center gap-2 text-sm"><Switch checked={item.required} onCheckedChange={(v) => patch(item.id, { required: v })} />Required</label>
                  </div>
                </SortableItem>
              );
            }}
          </SortableList>
          <Button type="button" variant="outline" className="border-dashed" onClick={() => set([...items, { id: uid("a_"), platform: "google_analytics", required: true }])}><Plus />Add platform</Button>
        </div>
      </div>
    </div>
  );
}

function AgreementEditor({ step, onChange, agreements }: { step: AgreementStep; onChange: (s: Step) => void; agreements: AgreementOption[] }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const cfg = step.config;
  const insert = (key: string) => {
    const el = ref.current;
    const token = `{{${key}}}`;
    if (!el) return onChange({ ...step, config: { ...cfg, body: cfg.body + token } });
    const start = el.selectionStart, end = el.selectionEnd;
    const body = cfg.body.slice(0, start) + token + cfg.body.slice(end);
    onChange({ ...step, config: { ...cfg, body } });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  };
  return (
    <div className="grid gap-4">
      {agreements.length > 0 && (
        <Field label="Start from your agreement library" optionalHint>
          <Select value={cfg.agreementTemplateId ?? ""} onValueChange={(id) => {
            const a = agreements.find((x) => x.id === id);
            if (a) onChange({ ...step, config: { ...cfg, agreementTemplateId: a.id, agreementTitle: a.name, body: a.body } });
          }}>
            <SelectTrigger><SelectValue placeholder="Choose an agreement…" /></SelectTrigger>
            <SelectContent>{agreements.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      )}
      <Field label="Agreement title" htmlFor="ag-title">
        <Input id="ag-title" value={cfg.agreementTitle} onChange={(e) => onChange({ ...step, config: { ...cfg, agreementTitle: e.target.value } })} />
      </Field>
      <Field label="Agreement text" htmlFor="ag-body" description="Merge fields are filled with the client's details when the agreement is shown.">
        <div className="flex flex-wrap gap-1.5">
          {MERGE_FIELDS.map((m) => (
            <button key={m.key} type="button" onClick={() => insert(m.key)} className="rounded-md border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground">{`{{${m.key}}}`}</button>
          ))}
        </div>
        <Textarea id="ag-body" ref={ref} rows={14} className="font-mono text-[13px] leading-relaxed" value={cfg.body} onChange={(e) => onChange({ ...step, config: { ...cfg, body: e.target.value } })} />
      </Field>
    </div>
  );
}

const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "inr", "sgd", "aed", "nzd", "chf"];

function PaymentEditor({ step, onChange, enabled }: { step: PaymentStep; onChange: (s: Step) => void; enabled: boolean }) {
  const cfg = step.config;
  return (
    <div className="grid gap-4">
      {!enabled && (
        <div className="flex gap-2 rounded-lg border border-warning/25 bg-warning-soft p-3 text-[13px] text-warning">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>Payments aren&apos;t set up yet. You can design this step now. Clients will see &ldquo;payment not available yet&rdquo; until Stripe is connected in Settings → Payments.</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <Field label="Amount" htmlFor="pay-amount">
          <Input id="pay-amount" type="number" min={0.5} step="0.01" value={cfg.amountCents / 100} onChange={(e) => onChange({ ...step, config: { ...cfg, amountCents: Math.round((Number(e.target.value) || 0) * 100) } })} />
        </Field>
        <Field label="Currency">
          <Select value={cfg.currency} onValueChange={(v) => onChange({ ...step, config: { ...cfg, currency: v } })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Payment type">
        <Select value={cfg.kind} onValueChange={(v) => onChange({ ...step, config: { ...cfg, kind: v as PaymentStep["config"]["kind"] } })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="deposit">Deposit</SelectItem>
            <SelectItem value="initial">Initial payment / first month</SelectItem>
            <SelectItem value="full">Full payment</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Description on receipt" htmlFor="pay-desc" optionalHint>
        <Input id="pay-desc" value={cfg.description ?? ""} placeholder="e.g. 50% project deposit" onChange={(e) => onChange({ ...step, config: { ...cfg, description: e.target.value || undefined } })} />
      </Field>
    </div>
  );
}
