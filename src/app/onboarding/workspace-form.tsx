"use client";
import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { slugify, cn } from "@/lib/utils";
import { createWorkspace } from "./actions";

const COLORS = ["#4f46e5", "#0f766e", "#2563eb", "#be123c", "#c2410c", "#7c3aed", "#18181b"];

export function WorkspaceForm({ starters }: { starters: { key: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createWorkspace, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [color, setColor] = useState(COLORS[0]!);
  const [starter, setStarter] = useState("web-design");
  const fe = state?.fieldErrors;

  return (
    <form action={action} className="grid gap-5" noValidate>
      {state?.error && (
        <div role="alert" className="flex gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4" />{state.error}</div>
      )}
      <Field label="Business name" htmlFor="name" error={fe?.name?.[0]}>
        <Input id="name" name="name" value={name} placeholder="Northwind Studio" autoFocus aria-invalid={!!fe?.name}
          onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
      </Field>
      <Field label="Workspace URL" htmlFor="slug" error={fe?.slug?.[0]} description="Used to identify your workspace. Custom domains are coming on the Scale plan.">
        <div className="flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">workspace/</span>
          <Input id="slug" name="slug" value={slug} className="rounded-l-none" aria-invalid={!!fe?.slug}
            onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} />
        </div>
      </Field>
      <Field label="Brand color" description="Used for buttons and progress in your client portal.">
        <input type="hidden" name="brandColor" value={color} />
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Use ${c}`} aria-pressed={color === c}
              className={cn("size-8 rounded-full ring-offset-2 ring-offset-card transition", color === c && "ring-2 ring-foreground")} style={{ background: c }} />
          ))}
        </div>
      </Field>
      <Field label="What kind of work do you do?" description="We'll add a ready-made onboarding template for it.">
        <input type="hidden" name="starter" value={starter} />
        <Select value={starter} onValueChange={setStarter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{starters.map((s) => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">Create workspace</Button>
    </form>
  );
}
