"use client";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PortalApp } from "@/components/portal/portal-app";
import type { PortalAdapter, PortalData } from "@/components/portal/types";
import {
  portalConfirmAccess, portalCreateUpload, portalFinalizeUpload, portalPostComment, portalRemoveFile,
  portalSaveAnswers, portalSign, portalSkipStep, portalStartPayment, portalSubmitStep,
} from "./actions";

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 95)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function PortalClient({ token, data, paymentNotice, initialStepId }: { token: string; data: PortalData; paymentNotice: "success" | "cancelled" | null; initialStepId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (paymentNotice === "success") toast.success("Thanks! Your payment is being confirmed.");
    if (paymentNotice === "cancelled") toast("Payment cancelled. You can try again anytime.");
    if (paymentNotice) router.replace(`/p/${token}`, { scroll: false });
  }, [paymentNotice, router, token]);

  const adapter = useMemo<PortalAdapter>(() => {
    const after = <T extends { ok: boolean }>(r: T) => { if (r.ok) router.refresh(); return r; };
    return {
      mode: "live",
      saveAnswers: (stepId, answers) => portalSaveAnswers(token, stepId, answers),
      submitStep: async (stepId) => after(await portalSubmitStep(token, stepId)),
      skipStep: async (stepId) => after(await portalSkipStep(token, stepId)),
      async uploadFile(stepId, itemKey, file, onProgress) {
        const meta = { name: file.name, size: file.size, type: file.type };
        const created = await portalCreateUpload(token, stepId, itemKey, meta);
        if (!created.ok) return created;
        try { await putWithProgress(created.signedUrl, file, onProgress); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Upload failed" }; }
        const r = await portalFinalizeUpload(token, stepId, itemKey, created.path, meta);
        onProgress(100);
        return after(r);
      },
      removeFile: async (id) => after(await portalRemoveFile(token, id)),
      confirmAccess: async (stepId, itemId, confirmed) => after(await portalConfirmAccess(token, stepId, itemId, confirmed)),
      sign: async (stepId, input) => after(await portalSign(token, stepId, input)),
      startPayment: (stepId) => portalStartPayment(token, stepId),
      postComment: async (body) => after(await portalPostComment(token, body)),
      signedPdfUrl: (stepId) => `/api/portal/${token}/signature/${stepId}`,
      refresh: () => router.refresh(),
    };
  }, [token, router]);

  return <PortalApp data={data} adapter={adapter} initialStepId={initialStepId} />;
}
