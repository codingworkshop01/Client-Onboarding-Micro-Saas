"use client";
import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, FileIcon, Trash2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FileCategory, FilesStep } from "@/lib/flows/schema";
import { FILE_CATEGORY_LABELS } from "@/lib/flows/schema";
import { acceptAttribute, isFileAllowed } from "@/lib/flows/logic";
import { cn, formatBytes } from "@/lib/utils";
import type { PortalAdapter, PortalData, PortalStep } from "./types";
import { StepActions } from "./portal-app";

export function FilesStepView({ step, data, adapter, onDone }: { step: PortalStep & FilesStep; data: PortalData; adapter: PortalAdapter; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const live = (key: string) => data.documents.some((d) => d.stepId === step.id && d.itemKey === key && d.status !== "rejected" && !d.replaced);
  const missing = step.config.items.filter((i) => i.required && !live(i.id));

  const submit = async () => {
    if (missing.length) { setError(`Please upload: ${missing.map((m) => m.label).join(", ")}`); return; }
    setError(null);
    setSubmitting(true);
    const r = await adapter.submitStep(step.id);
    setSubmitting(false);
    if (!r.ok) { setError(r.error); return; }
    onDone();
  };

  return (
    <div>
      <div className="grid gap-6">
        {step.config.items.map((item) => (
          <div key={item.id}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium">{item.label}{item.required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}</h3>
            </div>
            {item.description && <p className="-mt-1 mb-2 text-[13px] text-muted-foreground">{item.description}</p>}
            <FileSlot stepId={step.id} itemKey={item.id} accept={item.accept} maxSizeMb={item.maxSizeMb} multiple={item.multiple} data={data} adapter={adapter} />
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="size-4" />{error}</p>}
      <StepActions step={step} adapter={adapter} onDone={onDone} onSubmit={submit} loading={submitting} submitLabel={step.status === "completed" ? "Done" : "Continue"} />
    </div>
  );
}

type Uploading = { name: string; pct: number; error?: string };

export function FileSlot({ stepId, itemKey, accept, maxSizeMb, multiple, data, adapter }: {
  stepId: string; itemKey: string; accept: FileCategory[]; maxSizeMb: number; multiple: boolean; data: PortalData; adapter: PortalAdapter;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const docs = data.documents.filter((d) => d.stepId === stepId && d.itemKey === itemKey && !d.replaced);
  const hasLive = docs.some((d) => d.status !== "rejected");
  const canAdd = multiple || !hasLive;

  const handle = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, multiple ? 20 : 1);
    for (const file of list) {
      const entry: Uploading = { name: file.name, pct: 0 };
      if (!isFileAllowed(file.name, file.type, accept)) entry.error = "This file type isn't accepted here";
      else if (file.size > maxSizeMb * 1024 * 1024) entry.error = `Larger than ${maxSizeMb} MB`;
      else if (file.size === 0) entry.error = "This file is empty";
      setUploading((u) => [...u, entry]);
      if (entry.error) continue;
      const r = await adapter.uploadFile(stepId, itemKey, file, (pct) => setUploading((u) => u.map((x) => (x === entry || (x.name === entry.name && !x.error) ? { ...x, pct } : x))));
      setUploading((u) => (r.ok ? u.filter((x) => x.name !== entry.name) : u.map((x) => (x.name === entry.name ? { ...x, error: r.error } : x))));
    }
  };

  const acceptText = accept.includes("any") ? "Any file type" : accept.map((a) => FILE_CATEGORY_LABELS[a]).join(", ");

  return (
    <div className="grid gap-2">
      {docs.map((d) => (
        <div key={d.id} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5", d.status === "rejected" && "border-destructive/30 bg-danger-soft/40")}>
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{d.fileName}</div>
            <div className="text-xs text-muted-foreground">{formatBytes(d.size)}</div>
            {d.status === "rejected" && <div className="mt-1 text-xs text-destructive">Needs a new upload{d.rejectionReason ? `: ${d.rejectionReason}` : ""}</div>}
          </div>
          {d.status === "approved" && <Badge variant="success"><CheckCircle2 />Approved</Badge>}
          {d.status === "pending" && <Badge variant="outline"><Clock />Received</Badge>}
          {d.status === "rejected" && <Badge variant="danger">Rejected</Badge>}
          {d.status === "pending" && (
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${d.fileName}`} onClick={() => adapter.removeFile(d.id)}><Trash2 /></Button>
          )}
        </div>
      ))}
      {uploading.map((u, i) => (
        <div key={`${u.name}-${i}`} className="rounded-lg border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{u.name}</span>
            {u.error ? (
              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setUploading((x) => x.filter((y) => y !== u))}>Dismiss</button>
            ) : <span className="text-xs text-muted-foreground tabular">{u.pct}%</span>}
          </div>
          {u.error ? <p className="mt-1 text-xs text-destructive">{u.error}</p> : (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand transition-[width]" style={{ width: `${u.pct}%` }} /></div>
          )}
        </div>
      ))}
      {canAdd && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) handle(e.dataTransfer.files); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors outline-none hover:border-brand/60 hover:bg-brand/5 focus-visible:ring-2 focus-visible:ring-brand/40", drag && "border-brand bg-brand/5")}
        >
          <UploadCloud className="size-6 text-muted-foreground" />
          <p className="text-sm"><span className="font-medium text-brand">Choose {multiple ? "files" : "a file"}</span> <span className="hidden sm:inline">or drag and drop</span></p>
          <p className="text-xs text-muted-foreground">{acceptText} · up to {maxSizeMb} MB{multiple ? " each" : ""}</p>
          <input ref={inputRef} type="file" hidden multiple={multiple} accept={acceptAttribute(accept)} onChange={(e) => { if (e.target.files?.length) handle(e.target.files); e.target.value = ""; }} />
        </div>
      )}
    </div>
  );
}
