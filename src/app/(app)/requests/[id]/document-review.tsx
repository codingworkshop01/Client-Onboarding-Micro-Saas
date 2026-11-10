"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Download, Eye, FileIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes, cn } from "@/lib/utils";
import { reviewDocument } from "../actions";

type Doc = { id: string; file_name: string; size_bytes: number; mime_type: string; status: "pending" | "approved" | "rejected"; rejection_reason: string | null; uploaded_at: string; replaced_at: string | null };

const PREVIEWABLE = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain|video\/(mp4|webm)|audio\/)/;

export function DocumentRow({ doc }: { doc: Doc }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(false);
  const url = `/api/documents/${doc.id}/download`;

  const decide = (d: "approved" | "rejected", why?: string) => start(async () => {
    const r = await reviewDocument(doc.id, d, why);
    if (!r.ok) return void toast.error(r.error);
    toast.success(d === "approved" ? "File approved" : "Re-upload requested");
    setRejectOpen(false);
    router.refresh();
  });

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2", doc.replaced_at && "opacity-60")}>
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{doc.file_name}</div>
        <div className="text-xs text-muted-foreground">{formatBytes(doc.size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString()}{doc.replaced_at && " · replaced"}</div>
        {doc.status === "rejected" && doc.rejection_reason && <div className="text-xs text-destructive">Rejected: {doc.rejection_reason}</div>}
      </div>
      <Badge variant={doc.status === "approved" ? "success" : doc.status === "rejected" ? "danger" : "warning"} className="capitalize">{doc.status === "pending" ? "Needs review" : doc.status}</Badge>
      <div className="flex gap-0.5">
        {PREVIEWABLE.test(doc.mime_type) && <Button variant="ghost" size="icon-sm" aria-label="Preview" onClick={() => setPreview(true)}><Eye /></Button>}
        <Button variant="ghost" size="icon-sm" aria-label="Download" asChild><a href={`${url}?download=1`}><Download /></a></Button>
        {doc.status === "pending" && !doc.replaced_at && (
          <>
            <Button variant="ghost" size="icon-sm" aria-label="Approve" className="text-success hover:text-success" disabled={pending} onClick={() => decide("approved")}><Check /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Request re-upload" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => setRejectOpen(true)}><X /></Button>
          </>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a re-upload</DialogTitle>
            <DialogDescription>Your client will see this reason next to the file and be asked for a replacement.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. The logo is too low resolution. Please upload an SVG or PNG at least 1000px wide." autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={pending} onClick={() => decide("rejected", reason)}>Request re-upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle className="truncate">{doc.file_name}</DialogTitle></DialogHeader>
          <div className="flex max-h-[75vh] items-center justify-center overflow-auto rounded-lg bg-muted">
            {doc.mime_type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={doc.file_name} className="max-h-[75vh] object-contain" />
            ) : doc.mime_type.startsWith("video/") ? (
              <video src={url} controls className="max-h-[75vh]" />
            ) : doc.mime_type.startsWith("audio/") ? (
              <audio src={url} controls />
            ) : (
              <iframe src={url} title={doc.file_name} className="h-[75vh] w-full bg-white" sandbox="" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
