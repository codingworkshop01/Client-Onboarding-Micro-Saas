"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox, RadioGroup, RadioGroupItem } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnswerValue, Field as FieldDef, FormStep } from "@/lib/flows/schema";
import { validateAnswers, visibleFields } from "@/lib/flows/logic";
import { cn } from "@/lib/utils";
import type { PortalAdapter, PortalData, PortalStep } from "./types";
import { StepActions } from "./portal-app";
import { FileSlot } from "./step-files";

export function FormStepView({ step, data, adapter, onDone }: { step: PortalStep & FormStep; data: PortalData; adapter: PortalAdapter; onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(step.data.answers ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const fields = step.config.fields;
  const shown = useMemo(() => visibleFields(fields, answers), [fields, answers]);

  // Debounced autosave.
  useEffect(() => {
    if (!dirty.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const r = await adapter.saveAnswers(step.id, answers);
      setSaveState(r.ok ? "saved" : "error");
    }, 700);
    return () => clearTimeout(t);
  }, [answers, adapter, step.id]);

  const set = (id: string, v: AnswerValue) => {
    dirty.current = true;
    setAnswers((a) => ({ ...a, [id]: v }));
    if (errors[id]) setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
  };

  const fileFieldIds = new Set(data.documents.filter((d) => d.stepId === step.id && d.status !== "rejected" && !d.replaced).map((d) => d.itemKey));

  const submit = async () => {
    const errs = validateAnswers(fields, answers, fileFieldIds);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`q-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setSubmitting(true);
    const saved = await adapter.saveAnswers(step.id, answers);
    const r = saved.ok ? await adapter.submitStep(step.id) : saved;
    setSubmitting(false);
    if (!r.ok) { setErrors(r.fieldErrors ?? {}); if (!r.fieldErrors) alert(r.error); return; }
    onDone();
  };

  return (
    <div>
      <div className="grid gap-6">
        {shown.map((f) => (
          <div key={f.id} className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <Field label={f.label} htmlFor={`q-${f.id}`} description={f.description} error={errors[f.id]} required={f.required}>
              {f.type === "file" ? (
                <FileSlot stepId={step.id} itemKey={f.id} accept={f.accept ?? ["any"]} maxSizeMb={f.maxSizeMb ?? 25} multiple data={data} adapter={adapter} />
              ) : (
                <FieldInput field={f} value={answers[f.id]} onChange={(v) => set(f.id, v)} invalid={!!errors[f.id]} />
              )}
            </Field>
          </div>
        ))}
      </div>
      <div className="mt-6 flex h-4 items-center justify-end text-xs text-muted-foreground" aria-live="polite">
        {saveState === "saving" && <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" />Saving…</span>}
        {saveState === "saved" && <span className="flex items-center gap-1"><Check className="size-3" />Saved</span>}
        {saveState === "error" && <span className="text-destructive">Couldn&apos;t save. Check your connection.</span>}
      </div>
      <StepActions step={step} adapter={adapter} onDone={onDone} onSubmit={submit} loading={submitting} submitLabel={step.status === "completed" ? "Save changes" : "Continue"} />
    </div>
  );
}

function FieldInput({ field, value, onChange, invalid }: { field: FieldDef; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; invalid: boolean }) {
  const id = `q-${field.id}`;
  const common = { id, "aria-invalid": invalid || undefined, "aria-describedby": invalid ? `${id}-error` : field.description ? `${id}-desc` : undefined };
  const str = typeof value === "string" ? value : value == null ? "" : String(value);
  switch (field.type) {
    case "textarea":
      return <Textarea {...common} rows={4} value={str} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className="text-[15px]" />;
    case "select":
      return (
        <Select value={str || undefined} onValueChange={onChange}>
          <SelectTrigger {...common} className="h-11 text-[15px]"><SelectValue placeholder="Choose…" /></SelectTrigger>
          <SelectContent>{field.options?.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      );
    case "radio":
      return (
        <RadioGroup value={str} onValueChange={onChange} aria-labelledby={id} className="gap-2">
          {field.options?.map((o) => (
            <label key={o.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-[15px] transition-colors hover:bg-accent/50", str === o.id && "border-brand bg-brand/5")}>
              <RadioGroupItem value={o.id} id={`${id}-${o.id}`} className="data-[state=checked]:border-brand [&_span]:bg-brand" />{o.label}
            </label>
          ))}
        </RadioGroup>
      );
    case "checkbox": {
      const arr = Array.isArray(value) ? value.map(String) : [];
      return (
        <div className="grid gap-2 sm:grid-cols-2" id={id}>
          {field.options?.map((o) => {
            const on = arr.includes(o.id);
            return (
              <label key={o.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 text-[15px] transition-colors hover:bg-accent/50", on && "border-brand bg-brand/5")}>
                <Checkbox checked={on} onCheckedChange={(c) => onChange(c ? [...arr, o.id] : arr.filter((x) => x !== o.id))} className="data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground" />{o.label}
              </label>
            );
          })}
        </div>
      );
    }
    default: {
      const type = field.type === "phone" ? "tel" : field.type === "url" ? "url" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text";
      const autoComplete = field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "url" ? "url" : undefined;
      return <Input {...common} type={type} inputMode={field.type === "number" ? "decimal" : undefined} autoComplete={autoComplete} value={str} placeholder={field.placeholder ?? (field.type === "url" ? "https://" : undefined)} min={field.min} max={field.max} onChange={(e) => onChange(e.target.value)} className="h-11 text-[15px]" />;
    }
  }
}
