"use client";
import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import type { AuthState } from "./actions";

type FieldDef = { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string; hint?: React.ReactNode; defaultValue?: string };

export function AuthForm({ action, fields, submitLabel, next, footer }: {
  action: (s: AuthState, f: FormData) => Promise<AuthState>;
  fields: FieldDef[];
  submitLabel: string;
  next?: string;
  footer?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-danger-soft px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />{state.error}
        </div>
      )}
      {state?.message && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-success/20 bg-success-soft px-3 py-2.5 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />{state.message}
        </div>
      )}
      {fields.map((f) => {
        const err = state?.fieldErrors?.[f.name]?.[0];
        return (
          <Field key={f.name} label={<span className="flex w-full items-center justify-between">{f.label}{f.hint}</span>} htmlFor={f.name} error={err}>
            <Input id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} placeholder={f.placeholder} defaultValue={f.defaultValue} aria-invalid={!!err} aria-describedby={err ? `${f.name}-error` : undefined} className="h-10" />
          </Field>
        );
      })}
      <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">{submitLabel}</Button>
      {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
    </form>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export { Link };
