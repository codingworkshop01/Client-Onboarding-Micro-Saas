"use client";
import { useMemo, useState } from "react";
import type { Step } from "@/lib/flows/schema";
import { renderMergeFields } from "@/lib/merge-fields";
import { uid } from "@/lib/utils";
import { PortalApp } from "./portal-app";
import type { PortalAdapter, PortalData, PortalStep } from "./types";

const SAMPLE_CLIENT = { name: "Jordan Lee", email: "jordan@acme.co", company: "Acme Co." };

/** Fully interactive preview with in-memory state. Nothing is persisted or uploaded. */
export function PortalPreview({ steps, brand, title }: { steps: Step[]; brand: { name: string; color: string; logoUrl: string | null }; title: string }) {
  const initial = useMemo<PortalData>(() => ({
    request: { id: "preview", title: title || "Client onboarding", message: null, status: "sent", dueDate: null },
    workspace: { name: brand.name, color: brand.color, logoUrl: brand.logoUrl, supportEmail: null, website: null, welcomeMessage: "Welcome! This short checklist gives us everything we need to kick off your project.", showBranding: true },
    client: SAMPLE_CLIENT,
    steps: steps.map((s) => ({ ...s, status: "not_started", data: {} }) as PortalStep),
    documents: [],
    signatures: [],
    payments: [],
    comments: [],
    agreements: Object.fromEntries(steps.filter((s) => s.type === "agreement").map((s) => [s.id, renderMergeFields(s.type === "agreement" ? s.config.body : "", { client: SAMPLE_CLIENT, workspace: { name: brand.name }, request: { title } })])),
    paymentsEnabled: true,
  }), [steps, brand, title]);

  const [data, setData] = useState(initial);
  const setStep = (id: string, patch: Partial<PortalStep>) =>
    setData((d) => ({ ...d, steps: d.steps.map((s) => (s.id === id ? ({ ...s, ...patch } as PortalStep) : s)) }));

  const adapter: PortalAdapter = {
    mode: "preview",
    async saveAnswers(stepId, answers) { setStep(stepId, { status: "in_progress", data: { ...data.steps.find((s) => s.id === stepId)!.data, answers } }); return { ok: true }; },
    async submitStep(stepId) { setStep(stepId, { status: "completed" }); return { ok: true }; },
    async skipStep(stepId) { setStep(stepId, { status: "completed", data: { skipped: true } }); return { ok: true }; },
    async uploadFile(stepId, itemKey, file, onProgress) {
      for (const p of [25, 60, 100]) { await new Promise((r) => setTimeout(r, 120)); onProgress(p); }
      const document = { id: uid("doc_"), stepId, itemKey, fileName: file.name, size: file.size, mimeType: file.type, status: "pending" as const, rejectionReason: null, uploadedAt: new Date().toISOString(), replaced: false };
      setData((d) => ({ ...d, documents: [...d.documents, document] }));
      return { ok: true, document };
    },
    async removeFile(id) { setData((d) => ({ ...d, documents: d.documents.filter((x) => x.id !== id) })); return { ok: true }; },
    async confirmAccess(stepId, itemId, confirmed) {
      const s = data.steps.find((x) => x.id === stepId)!;
      setStep(stepId, { status: "in_progress", data: { ...s.data, confirmations: { ...s.data.confirmations, [itemId]: { confirmed, at: new Date().toISOString() } } } });
      return { ok: true };
    },
    async sign(stepId, input) {
      const signature = { stepId, signerName: input.signerName, signedAt: new Date().toISOString(), hasPdf: false };
      setData((d) => ({ ...d, signatures: [...d.signatures, signature], steps: d.steps.map((s) => (s.id === stepId ? { ...s, status: "completed" } : s)) }));
      return { ok: true, signature };
    },
    async startPayment() { return { ok: false, error: "Payments are disabled in preview. Your client will be sent to secure Stripe checkout here." }; },
    async postComment(body) { const comment = { id: uid("c_"), authorType: "client" as const, authorName: SAMPLE_CLIENT.name, body, createdAt: new Date().toISOString() }; return { ok: true, comment }; },
    refresh() {},
  };

  return <PortalApp data={data} adapter={adapter} />;
}
