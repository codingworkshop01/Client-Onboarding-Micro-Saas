"use client";
import { useState } from "react";
import { CheckCircle2, Clock, ExternalLink, Info, Lock } from "lucide-react";
import type { PaymentStep } from "@/lib/flows/schema";
import { formatMoney } from "@/lib/utils";
import type { PortalAdapter, PortalData, PortalStep } from "./types";
import { StepActions } from "./portal-app";

const KIND = { deposit: "Deposit", initial: "Initial payment", full: "Payment" };

export function PaymentStepView({ step, data, adapter, onDone }: { step: PortalStep & PaymentStep; data: PortalData; adapter: PortalAdapter; onDone: () => void }) {
  const payment = data.payments.find((p) => p.stepId === step.id);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const amount = formatMoney(step.config.amountCents, step.config.currency);

  const pay = async () => {
    setError(null);
    setLoading(true);
    const r = await adapter.startPayment(step.id);
    if (!r.ok) { setLoading(false); setError(r.error); return; }
    window.location.href = r.url;
  };

  return (
    <div>
      <div className="rounded-xl border bg-surface p-5">
        <div className="text-[13px] text-muted-foreground">{KIND[step.config.kind]}</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight tabular">{amount}</div>
        {step.config.description && <div className="mt-1 text-sm text-muted-foreground">{step.config.description}</div>}
        <div className="mt-1 text-xs text-muted-foreground">Payable to {data.workspace.name}</div>
      </div>

      {payment?.status === "paid" ? (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-success/30 bg-success-soft/40 p-4 text-sm">
          <CheckCircle2 className="size-5 text-success" />
          <div className="flex-1"><div className="font-medium">Payment received</div>{payment.paidAt && <div className="text-muted-foreground">{new Date(payment.paidAt).toLocaleString()}</div>}</div>
          {payment.receiptUrl && <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">Receipt<ExternalLink className="size-3.5" /></a>}
        </div>
      ) : payment?.status === "pending" ? (
        <div className="mt-5 flex items-center gap-3 rounded-lg border bg-warning-soft/50 p-4 text-sm">
          <Clock className="size-5 text-warning" />
          <div>We&apos;re waiting for confirmation from the payment provider. This page updates once the payment is confirmed.</div>
        </div>
      ) : !data.paymentsEnabled ? (
        <div className="mt-5 flex gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>Online payment isn&apos;t available for this onboarding yet. {data.workspace.name} will send you payment details separately. You can continue with the other steps.</p>
        </div>
      ) : (
        <>
          {payment?.status === "failed" && <p className="mt-4 text-sm text-destructive">Your last payment attempt didn&apos;t go through. Please try again.</p>}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3" />Payments are processed securely by Stripe. Your card details never touch our servers.</p>
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <StepActions
        step={step}
        adapter={adapter}
        onDone={onDone}
        onSubmit={payment?.status === "paid" ? onDone : data.paymentsEnabled && payment?.status !== "pending" ? pay : undefined}
        loading={loading}
        submitLabel={payment?.status === "paid" ? "Continue" : `Pay ${amount}`}
      />
    </div>
  );
}
