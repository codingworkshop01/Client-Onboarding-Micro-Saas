"use client";
import { useCallback, useState } from "react";
import { CheckCircle2, Download, PenLine, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { AgreementStep } from "@/lib/flows/schema";
import { esignConsentText, ESIGN_DISCLOSURE } from "@/lib/esign";
import type { PortalAdapter, PortalData, PortalStep } from "./types";
import { StepActions } from "./portal-app";
import { SignaturePad } from "./signature-pad";

export function AgreementStepView({ step, data, adapter, onDone }: { step: PortalStep & AgreementStep; data: PortalData; adapter: PortalAdapter; onDone: () => void }) {
  const signature = data.signatures.find((s) => s.stepId === step.id);
  const body = data.agreements[step.id] ?? step.config.body;
  const [name, setName] = useState(data.client.name);
  const [email, setEmail] = useState(data.client.email);
  const [mode, setMode] = useState<"typed" | "drawn">("typed");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const onDraw = useCallback((d: string | null) => setDrawn(d), []);

  const sign = async () => {
    if (!name.trim()) return setError("Enter your full name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email");
    if (mode === "drawn" && !drawn) return setError("Draw your signature in the box");
    if (!consent) return setError("Please confirm you agree to sign electronically");
    setError(null);
    setSigning(true);
    const r = await adapter.sign(step.id, { signerName: name.trim(), signerEmail: email.trim(), type: mode, data: mode === "typed" ? name.trim() : drawn!, consent });
    setSigning(false);
    if (!r.ok) return setError(r.error);
    onDone();
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{step.config.agreementTitle}</h3>
      </div>
      <div tabIndex={0} aria-label="Agreement text" className="prose-agreement max-h-[420px] overflow-y-auto rounded-lg border bg-surface px-5 py-4 text-foreground/90 outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
        {body}
      </div>

      {signature ? (
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-success/30 bg-success-soft/40 p-4 sm:flex-row sm:items-center">
          <CheckCircle2 className="size-5 text-success" />
          <div className="flex-1 text-sm">
            <div className="font-medium">Signed by {signature.signerName}</div>
            <div className="text-muted-foreground">{new Date(signature.signedAt).toLocaleString()}</div>
          </div>
          {signature.hasPdf && adapter.signedPdfUrl && (
            <Button variant="outline" size="sm" asChild><a href={adapter.signedPdfUrl(step.id)}><Download />Download signed PDF</a></Button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full legal name" htmlFor="sig-name" required><Input id="sig-name" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} className="h-11" /></Field>
            <Field label="Email" htmlFor="sig-email" required><Input id="sig-email" type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} className="h-11" /></Field>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "typed" | "drawn")}>
            <TabsList>
              <TabsTrigger value="typed"><Type />Type</TabsTrigger>
              <TabsTrigger value="drawn"><PenLine />Draw</TabsTrigger>
            </TabsList>
            <TabsContent value="typed" className="pt-4">
              <div className="flex h-40 items-center justify-center rounded-lg border bg-white px-4">
                <span className="truncate text-4xl text-zinc-900" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive" }}>{name || "Your name"}</span>
              </div>
            </TabsContent>
            <TabsContent value="drawn" className="pt-4"><SignaturePad onChange={onDraw} /></TabsContent>
          </Tabs>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-[13px] leading-relaxed">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground" />
            <span>{esignConsentText(data.workspace.name)}</span>
          </label>
          <p className="text-xs text-muted-foreground">{ESIGN_DISCLOSURE}</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      )}
      <StepActions step={step} adapter={adapter} onDone={onDone} onSubmit={signature ? onDone : sign} loading={signing} submitLabel={signature ? "Continue" : "Sign agreement"} />
    </div>
  );
}
