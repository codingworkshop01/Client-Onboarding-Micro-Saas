"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Copy, Info, Mail, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StepTypeIcon } from "@/components/builder/step-icon";
import type { StepType } from "@/lib/flows/schema";
import { cn } from "@/lib/utils";
import { createRequest } from "../actions";

type Client = { id: string; name: string; email: string; company: string | null };
type Template = { id: string; name: string; description: string | null; types: StepType[] };

const schema = z.object({
  clientMode: z.enum(["existing", "new"]),
  clientId: z.string().optional(),
  newName: z.string().optional(),
  newEmail: z.string().optional(),
  newCompany: z.string().optional(),
  templateId: z.string().min(1, "Choose a template"),
  title: z.string().trim().min(1, "Give this onboarding a title").max(160),
  message: z.string().max(4000).optional(),
  dueDate: z.string().optional(),
  remindersEnabled: z.boolean(),
  reminderIntervalDays: z.number().int().min(1).max(30),
}).superRefine((v, ctx) => {
  if (v.clientMode === "existing" && !v.clientId) ctx.addIssue({ code: "custom", path: ["clientId"], message: "Choose a client" });
  if (v.clientMode === "new") {
    if (!v.newName?.trim()) ctx.addIssue({ code: "custom", path: ["newName"], message: "Enter the client's name" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.newEmail ?? "")) ctx.addIssue({ code: "custom", path: ["newEmail"], message: "Enter a valid email" });
  }
});
type Values = z.infer<typeof schema>;

export function NewRequestForm({ clients, templates, defaultTemplateId, defaultClientId, defaultInterval, emailConfigured }: {
  clients: Client[]; templates: Template[]; defaultTemplateId: string; defaultClientId?: string; defaultInterval: number; emailConfigured: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<{ id: string; link: string; emailStatus?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState<"send" | "draft" | null>(null);
  const tplName = (id: string) => templates.find((t) => t.id === id)?.name ?? "";

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientMode: clients.length ? "existing" : "new",
      clientId: defaultClientId,
      templateId: defaultTemplateId,
      title: `${tplName(defaultTemplateId)} onboarding`.replace(/ onboarding onboarding$/i, " onboarding"),
      remindersEnabled: true,
      reminderIntervalDays: defaultInterval,
    },
  });
  const mode = watch("clientMode");
  const templateId = watch("templateId");
  const reminders = watch("remindersEnabled");

  const submit = (send: boolean) => handleSubmit(async (v) => {
    setSubmitting(send ? "send" : "draft");
    const r = await createRequest({
      clientId: v.clientMode === "existing" ? v.clientId : undefined,
      newClient: v.clientMode === "new" ? { name: v.newName!, email: v.newEmail!, company: v.newCompany || undefined } : undefined,
      templateId: v.templateId,
      title: v.title,
      message: v.message || undefined,
      dueDate: v.dueDate || "",
      remindersEnabled: v.remindersEnabled,
      reminderIntervalDays: v.reminderIntervalDays,
      send,
    });
    setSubmitting(null);
    if (!r.ok) { toast.error(r.error); return; }
    if (send && r.link) setResult({ id: r.id, link: r.link, emailStatus: r.emailStatus });
    else { toast.success("Draft saved"); router.push(`/requests/${r.id}`); }
  });

  return (
    <form onSubmit={(e) => e.preventDefault()} className="grid gap-5" noValidate>
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Client</h2>
          {clients.length > 0 && (
            <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-[13px]">
              {(["existing", "new"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setValue("clientMode", m)} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 transition", mode === m ? "bg-background font-medium shadow-xs" : "text-muted-foreground")}>
                  {m === "existing" ? <><Users className="size-3.5" />Existing</> : <><UserPlus className="size-3.5" />New client</>}
                </button>
              ))}
            </div>
          )}
        </div>
        {mode === "existing" ? (
          <Field label="Choose client" error={errors.clientId?.message}>
            <Controller control={control} name="clientId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-invalid={!!errors.clientId}><SelectValue placeholder="Select a client…" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""} ({c.email})</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" htmlFor="newName" error={errors.newName?.message} required><Input id="newName" {...register("newName")} placeholder="Jordan Lee" aria-invalid={!!errors.newName} /></Field>
            <Field label="Email" htmlFor="newEmail" error={errors.newEmail?.message} required><Input id="newEmail" type="email" {...register("newEmail")} placeholder="jordan@acme.co" aria-invalid={!!errors.newEmail} /></Field>
            <Field label="Company" htmlFor="newCompany" optionalHint className="sm:col-span-2"><Input id="newCompany" {...register("newCompany")} placeholder="Acme Co." /></Field>
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-[15px] font-semibold">Onboarding flow</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <button key={t.id} type="button" onClick={() => { setValue("templateId", t.id); setValue("title", `${t.name} onboarding`.replace(/ onboarding onboarding$/i, " onboarding")); }}
              className={cn("rounded-lg border p-3 text-left transition", templateId === t.id ? "border-foreground/50 ring-1 ring-foreground/15" : "hover:bg-accent/40")}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{t.name}</span>
                {templateId === t.id && <Check className="size-4" />}
              </div>
              <div className="mt-2 flex gap-1">{t.types.map((ty, i) => <StepTypeIcon key={i} type={ty} className="size-5" />)}</div>
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4">
          <Field label="Title your client sees" htmlFor="title" error={errors.title?.message}><Input id="title" {...register("title")} aria-invalid={!!errors.title} /></Field>
          <Field label="Personal message" htmlFor="message" optionalHint description="Shown in the invitation email and at the top of their onboarding page.">
            <Textarea id="message" rows={3} {...register("message")} placeholder="Hi Jordan, great to be working together! Here's everything we need to kick off." />
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-[15px] font-semibold">Deadline & reminders</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date" htmlFor="dueDate" optionalHint><Input id="dueDate" type="date" {...register("dueDate")} min={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label="Remind every">
            <Controller control={control} name="reminderIntervalDays" render={({ field }) => (
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))} disabled={!reminders}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 5, 7, 14].map((d) => <SelectItem key={d} value={String(d)}>{d === 1 ? "Every day" : `Every ${d} days`}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
        </div>
        <label className="mt-4 flex items-center justify-between rounded-lg border px-3 py-2.5">
          <span><span className="block text-sm font-medium">Automatic reminders</span><span className="block text-[13px] text-muted-foreground">Gentle email nudges until they finish. They stop automatically on completion.</span></span>
          <Controller control={control} name="remindersEnabled" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
        </label>
      </Card>

      {!emailConfigured && (
        <div className="flex gap-2 rounded-lg border border-warning/25 bg-warning-soft p-3 text-[13px] text-warning">
          <Info className="mt-0.5 size-4 shrink-0" />Email isn&apos;t configured, so invitations won&apos;t be emailed. You&apos;ll get a link to share with your client yourself.
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={submit(false)} loading={submitting === "draft"} disabled={!!submitting}>Save as draft</Button>
        <Button type="button" onClick={submit(true)} loading={submitting === "send"} disabled={!!submitting}><Mail />Create & send</Button>
      </div>

      <Dialog open={!!result} onOpenChange={(o) => { if (!o && result) router.push(`/requests/${result.id}`); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Onboarding is live 🎉</DialogTitle>
            <DialogDescription>
              {result?.emailStatus === "sent" ? "We've emailed your client their secure link. You can also share it directly:" : "Share this secure link with your client:"}
            </DialogDescription>
          </DialogHeader>
          {result?.emailStatus && result.emailStatus !== "sent" && (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning">The invitation email was not sent ({result.emailStatus}). Copy the link below instead.</p>
          )}
          <div className="flex gap-2">
            <Input readOnly value={result?.link ?? ""} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(result!.link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Anyone with this link can view and complete this onboarding. It expires in 60 days and you can revoke it anytime.</p>
          <DialogFooter><Button onClick={() => router.push(`/requests/${result!.id}`)}>View onboarding</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
