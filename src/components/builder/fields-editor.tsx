"use client";
import { useState } from "react";
import { ChevronDown, Copy, GitBranch, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field as FieldWrap } from "@/components/ui/field";
import { Switch, Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  CONDITION_OPERATORS, FIELD_TYPES, FIELD_TYPE_LABELS, FILE_CATEGORIES, FILE_CATEGORY_LABELS,
  type ConditionOperator, type Field, type FileCategory,
} from "@/lib/flows/schema";
import { newField } from "@/lib/flows/logic";
import { cn, uid } from "@/lib/utils";
import { SortableItem, SortableList } from "./sortable";

const OP_LABEL: Record<ConditionOperator, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  is_filled: "is answered",
  is_empty: "is not answered",
};

export function FieldsEditor({ fields, onChange }: { fields: Field[]; onChange: (f: Field[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(fields[0]?.id ?? null);
  const update = (id: string, patch: Partial<Field>) => onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) =>
    // Removing a field also removes conditions that depended on it.
    onChange(fields.filter((f) => f.id !== id).map((f) => (f.condition?.fieldId === id ? { ...f, condition: undefined } : f)));
  const add = (type: Field["type"]) => {
    const f = newField(type);
    onChange([...fields, f]);
    setOpenId(f.id);
  };

  return (
    <div className="grid gap-2">
      {fields.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No questions yet. Add your first one below.</p>}
      <SortableList items={fields} onReorder={onChange}>
        {(field, index) => (
          <SortableItem key={field.id} id={field.id} className="rounded-lg border bg-card">
            <FieldCard
              field={field}
              index={index}
              open={openId === field.id}
              onToggle={() => setOpenId(openId === field.id ? null : field.id)}
              previous={fields.slice(0, index)}
              onChange={(patch) => update(field.id, patch)}
              onRemove={() => remove(field.id)}
              onDuplicate={() => {
                const copy = { ...structuredClone(field), id: uid("f_"), label: `${field.label} (copy)` };
                const next = [...fields];
                next.splice(index + 1, 0, copy);
                onChange(next);
                setOpenId(copy.id);
              }}
            />
          </SortableItem>
        )}
      </SortableList>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full border-dashed"><Plus />Add question</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="grid w-64 grid-cols-2">
          {FIELD_TYPES.map((t) => <DropdownMenuItem key={t} onSelect={() => add(t)}>{FIELD_TYPE_LABELS[t]}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function FieldCard({ field, index, open, onToggle, previous, onChange, onRemove, onDuplicate }: {
  field: Field; index: number; open: boolean; onToggle: () => void; previous: Field[];
  onChange: (p: Partial<Field>) => void; onRemove: () => void; onDuplicate: () => void;
}) {
  const hasOptions = field.type === "select" || field.type === "radio" || field.type === "checkbox";
  const id = (s: string) => `${field.id}-${s}`;
  return (
    <div>
      <div className="flex items-center gap-2 py-2 pr-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <span className="text-xs text-muted-foreground tabular">{index + 1}.</span>
          <span className={cn("truncate text-sm", !field.label && "text-muted-foreground italic")}>{field.label || "Untitled question"}</span>
          {field.required && <span className="text-destructive">*</span>}
          <Badge variant="outline" className="ml-auto shrink-0">{FIELD_TYPE_LABELS[field.type]}</Badge>
          {field.condition && <GitBranch className="size-3.5 shrink-0 text-info" aria-label="Has condition" />}
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div className="grid gap-4 border-t px-3 pt-4 pb-3 sm:pr-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <FieldWrap label="Question" htmlFor={id("label")}>
              <Input id={id("label")} value={field.label} placeholder="e.g. What's your website URL?" onChange={(e) => onChange({ label: e.target.value })} autoFocus={!field.label} />
            </FieldWrap>
            <FieldWrap label="Type">
              <Select value={field.type} onValueChange={(v) => {
                const t = v as Field["type"];
                const needsOptions = t === "select" || t === "radio" || t === "checkbox";
                onChange({
                  type: t,
                  options: needsOptions ? field.options ?? newField(t).options : undefined,
                  accept: t === "file" ? field.accept ?? ["any"] : undefined,
                  maxSizeMb: t === "file" ? field.maxSizeMb ?? 25 : undefined,
                });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </FieldWrap>
          </div>
          <FieldWrap label="Help text" htmlFor={id("desc")} optionalHint>
            <Input id={id("desc")} value={field.description ?? ""} placeholder="Add context or an example" onChange={(e) => onChange({ description: e.target.value || undefined })} />
          </FieldWrap>
          {!hasOptions && field.type !== "file" && field.type !== "date" && (
            <FieldWrap label="Placeholder" htmlFor={id("ph")} optionalHint>
              <Input id={id("ph")} value={field.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value || undefined })} />
            </FieldWrap>
          )}
          {field.type === "number" && (
            <div className="grid grid-cols-2 gap-3">
              <FieldWrap label="Minimum" optionalHint><Input type="number" value={field.min ?? ""} onChange={(e) => onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })} /></FieldWrap>
              <FieldWrap label="Maximum" optionalHint><Input type="number" value={field.max ?? ""} onChange={(e) => onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })} /></FieldWrap>
            </div>
          )}
          {hasOptions && <OptionsEditor options={field.options ?? []} onChange={(options) => onChange({ options })} />}
          {field.type === "file" && (
            <FileRules accept={field.accept ?? ["any"]} maxSizeMb={field.maxSizeMb ?? 25} onChange={(p) => onChange(p)} />
          )}
          <ConditionEditor field={field} previous={previous} onChange={(condition) => onChange({ condition })} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={field.required} onCheckedChange={(v) => onChange({ required: v })} />Required
            </label>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={onDuplicate}><Copy />Duplicate</Button>
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRemove}><Trash2 />Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionsEditor({ options, onChange }: { options: NonNullable<Field["options"]>; onChange: (o: NonNullable<Field["options"]>) => void }) {
  return (
    <FieldWrap label="Options">
      <div className="grid gap-1.5">
        {options.map((o, i) => (
          <div key={o.id} className="flex gap-1.5">
            <Input value={o.label} aria-label={`Option ${i + 1}`} onChange={(e) => onChange(options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onChange([...options, { id: uid("o_"), label: "" }]); } }} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove option" disabled={options.length <= 1} onClick={() => onChange(options.filter((x) => x.id !== o.id))}><X /></Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => onChange([...options, { id: uid("o_"), label: `Option ${options.length + 1}` }])}><Plus />Add option</Button>
      </div>
    </FieldWrap>
  );
}

export function FileRules({ accept, maxSizeMb, onChange }: { accept: FileCategory[]; maxSizeMb: number; onChange: (p: { accept?: FileCategory[]; maxSizeMb?: number }) => void }) {
  const toggle = (c: FileCategory) => {
    if (c === "any") return onChange({ accept: ["any"] });
    const without = accept.filter((a) => a !== "any" && a !== c);
    const next = accept.includes(c) ? without : [...without, c];
    onChange({ accept: next.length ? next : ["any"] });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
      <FieldWrap label="Accepted file types">
        <div className="flex flex-wrap gap-1.5">
          {FILE_CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => toggle(c)} aria-pressed={accept.includes(c)}
              className={cn("rounded-md border px-2 py-1 text-xs transition", accept.includes(c) ? "border-foreground bg-foreground text-background" : "hover:bg-accent")}>
              {FILE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </FieldWrap>
      <FieldWrap label="Max size (MB)">
        <Input type="number" min={1} max={50} value={maxSizeMb} onChange={(e) => onChange({ maxSizeMb: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} />
      </FieldWrap>
    </div>
  );
}

function ConditionEditor({ field, previous, onChange }: { field: Field; previous: Field[]; onChange: (c: Field["condition"]) => void }) {
  const candidates = previous.filter((f) => f.type !== "file");
  const c = field.condition;
  if (!c) {
    return (
      <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2">
        <span className="text-[13px] text-muted-foreground">Always shown</span>
        <Button type="button" variant="ghost" size="sm" disabled={candidates.length === 0} onClick={() => onChange({ fieldId: candidates[candidates.length - 1]!.id, operator: "equals", value: "" })}
          title={candidates.length === 0 ? "Add a question above this one first" : undefined}>
          <GitBranch />Add condition
        </Button>
      </div>
    );
  }
  const source = candidates.find((f) => f.id === c.fieldId);
  const needsValue = c.operator !== "is_filled" && c.operator !== "is_empty";
  return (
    <div className="grid gap-2 rounded-md border border-info/20 bg-info-soft/50 p-3">
      <div className="flex items-center justify-between text-[13px] font-medium text-info"><span className="flex items-center gap-1.5"><GitBranch className="size-3.5" />Show this question only when</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove condition" onClick={() => onChange(undefined)}><X /></Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={c.fieldId} onValueChange={(v) => onChange({ ...c, fieldId: v, value: "" })}>
          <SelectTrigger className="bg-background"><SelectValue placeholder="Question" /></SelectTrigger>
          <SelectContent>{candidates.map((f) => <SelectItem key={f.id} value={f.id}>{f.label || "Untitled question"}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={c.operator} onValueChange={(v) => onChange({ ...c, operator: v as ConditionOperator })}>
          <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>{CONDITION_OPERATORS.map((o) => <SelectItem key={o} value={o}>{OP_LABEL[o]}</SelectItem>)}</SelectContent>
        </Select>
        {needsValue && (source?.options?.length ? (
          <Select value={c.value || undefined} onValueChange={(v) => onChange({ ...c, value: v })}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Choose answer" /></SelectTrigger>
            <SelectContent>{source.options.map((o) => <SelectItem key={o.id} value={o.label}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <Input className="bg-background" value={c.value ?? ""} placeholder="Answer" onChange={(e) => onChange({ ...c, value: e.target.value })} />
        ))}
      </div>
    </div>
  );
}

export { Checkbox, Textarea };
