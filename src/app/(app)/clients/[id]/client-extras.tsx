"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MoreHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { addNote, archiveClient, deleteClient, deleteNote } from "../actions";

export function ClientNotes({ clientId, notes }: { clientId: string; notes: { id: string; body: string; author: string; createdAt: string }[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">Internal notes</h2>
      <Card className="p-3">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Notes are only visible to your team…" />
        <div className="mt-2 flex justify-end"><Button size="sm" disabled={!body.trim()} loading={pending} onClick={() => start(async () => { const r = await addNote(clientId, body); if (!r.ok) return void toast.error(r.error); setBody(""); router.refresh(); })}>Add note</Button></div>
      </Card>
      <div className="mt-3 grid gap-2">
        {notes.map((n) => (
          <div key={n.id} className="group rounded-lg border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <button aria-label="Delete note" className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive" onClick={() => start(async () => { await deleteNote(n.id, clientId); router.refresh(); })}><X className="size-3.5" /></button>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{n.author} · {new Date(n.createdAt).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ClientMenu({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [, start] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More"><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => start(async () => { await archiveClient(id, !archived); toast.success(archived ? "Client restored" : "Client archived"); router.refresh(); })}>{archived ? <><ArchiveRestore />Restore</> : <><Archive />Archive</>}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirm(true)}><Trash2 />Delete client & data</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this client permanently?</AlertDialogTitle>
            <AlertDialogDescription>All onboardings, answers, uploaded files, signed agreements and history for this client will be deleted. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => start(async () => { const r = await deleteClient(id); if (!r.ok) return void toast.error(r.error); toast.success("Client deleted"); router.push("/clients"); })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
