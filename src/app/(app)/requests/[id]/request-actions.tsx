"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, Copy, Download, FileSpreadsheet, Link2Off, Mail, MoreHorizontal, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteRequest, getClientLink, reopenStep, resendInvitation, revokeLinks, sendRequest, setRequestStatus } from "../actions";

type Status = "draft" | "sent" | "in_progress" | "completed" | "cancelled";

export function RequestActions({ id, status, clientEmail }: { id: string; status: Status; clientEmail: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "cancel" | "revoke">(null);

  const emailToast = (s: string, err?: string) =>
    s === "sent" ? toast.success(`Email sent to ${clientEmail}`) : toast.warning(`Email not sent (${s}${err ? `: ${err}` : ""}). Copy the link instead.`);

  const copyLink = () => start(async () => {
    const r = await getClientLink(id);
    if (!r.ok) return void toast.error(r.error);
    setLink(r.url);
    try { await navigator.clipboard.writeText(r.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* dialog shows it */ }
  });

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" ? (
        <Button loading={pending} onClick={() => start(async () => { const r = await sendRequest(id); if (!r.ok) return void toast.error(r.error); emailToast(r.emailStatus); setLink(r.link); router.refresh(); })}><Send />Send to client</Button>
      ) : status !== "cancelled" && (
        <>
          <Button variant="outline" onClick={copyLink} disabled={pending}>{copied ? <Check /> : <Copy />}Copy client link</Button>
          {status !== "completed" && <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await resendInvitation(id); if (!r.ok) return void toast.error(r.error); emailToast(r.emailStatus, r.error); router.refresh(); })}><Mail />Resend invite</Button>}
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild><a href={`/api/requests/${id}/export?format=zip`}><Download />Download all files (ZIP)</a></DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`/api/requests/${id}/export?format=csv`}><FileSpreadsheet />Export answers (CSV)</a></DropdownMenuItem>
          <DropdownMenuSeparator />
          {status !== "draft" && status !== "cancelled" && <DropdownMenuItem onSelect={() => setConfirm("revoke")}><Link2Off />Revoke all client links</DropdownMenuItem>}
          {status === "cancelled" || status === "completed"
            ? <DropdownMenuItem onSelect={() => start(async () => { const r = await setRequestStatus(id, "reopen"); if (!r.ok) toast.error(r.error); else { toast.success("Reopened"); router.refresh(); } })}><Undo2 />Reopen onboarding</DropdownMenuItem>
            : <DropdownMenuItem onSelect={() => setConfirm("cancel")}><Ban />Cancel onboarding</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirm("delete")}><Trash2 />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client link</DialogTitle>
            <DialogDescription>{copied ? "Copied to your clipboard. " : ""}This secure link opens the onboarding without a login. It expires in 60 days.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={link ?? ""} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(link!); setCopied(true); }}>{copied ? <Check /> : <Copy />}</Button>
          </div>
          <a href={link ?? "#"} target="_blank" rel="noreferrer" className="text-[13px] text-info hover:underline">Open as client ↗</a>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? "Delete this onboarding?" : confirm === "cancel" ? "Cancel this onboarding?" : "Revoke all client links?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete" && "All answers, uploaded files, signatures and history for this onboarding will be permanently deleted."}
              {confirm === "cancel" && "The client's links stop working and reminders stop. You can reopen it later."}
              {confirm === "revoke" && "Every link sent so far stops working immediately. Use “Copy client link” or “Resend invite” to issue a new one."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction destructive={confirm !== "revoke"} onClick={() => start(async () => {
              if (confirm === "delete") { const r = await deleteRequest(id); if (!r.ok) return void toast.error(r.error); toast.success("Deleted"); router.push("/requests"); }
              if (confirm === "cancel") { await setRequestStatus(id, "cancel"); toast.success("Onboarding cancelled"); router.refresh(); }
              if (confirm === "revoke") { await revokeLinks(id); toast.success("All links revoked"); router.refresh(); }
            })}>{confirm === "delete" ? "Delete" : confirm === "cancel" ? "Cancel onboarding" : "Revoke links"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ReopenStepButton({ stepId }: { stepId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="icon-sm" title="Reopen step so the client can edit" aria-label="Reopen step" disabled={pending}
      onClick={() => start(async () => { const r = await reopenStep(stepId); if (!r.ok) toast.error(r.error); else { toast.success("Step reopened"); router.refresh(); } })}>
      <RotateCcw />
    </Button>
  );
}
