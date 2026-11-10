"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, FilePlus2, LayoutTemplate, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StepTypeIcon } from "@/components/builder/step-icon";
import type { StepType } from "@/lib/flows/schema";
import { createTemplate, deleteTemplate, duplicateTemplate } from "./actions";

type Starter = { key: string; name: string; description: string; category: string; types: StepType[] };

export function NewTemplateButton({ starters }: { starters: Starter[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);
  const create = (input: { starter?: string; blank?: boolean }) => {
    setChosen(input.starter ?? "blank");
    start(async () => { await createTemplate(input); });
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus />New template</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>Start from a proven flow and tailor it, or begin with a blank canvas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <button disabled={pending} onClick={() => create({ blank: true })} className="flex items-start gap-3 rounded-lg border border-dashed p-3.5 text-left transition hover:border-foreground/30 hover:bg-accent/40 disabled:opacity-60">
              <FilePlus2 className="mt-0.5 size-5 text-muted-foreground" />
              <div><div className="text-sm font-medium">{pending && chosen === "blank" ? "Creating…" : "Blank template"}</div><div className="text-[13px] text-muted-foreground">Build your own flow step by step.</div></div>
            </button>
            {starters.map((s) => (
              <button key={s.key} disabled={pending} onClick={() => create({ starter: s.key })} className="flex flex-col gap-2 rounded-lg border p-3.5 text-left transition hover:border-foreground/30 hover:bg-accent/40 disabled:opacity-60">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{pending && chosen === s.key ? "Creating…" : s.name}</span>
                </div>
                <p className="line-clamp-2 text-[13px] text-muted-foreground">{s.description}</p>
                <div className="flex gap-1">{s.types.map((t, i) => <StepTypeIcon key={i} type={t} className="size-5" />)}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TemplateMenu({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [, start] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/templates/${id}`)}><Pencil />Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/requests/new?template=${id}`)}><Plus />Use for new onboarding</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => start(async () => { const newId = await duplicateTemplate(id); toast.success("Template duplicated"); router.push(`/templates/${newId}`); })}><Copy />Duplicate</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirm(true)}><Trash2 />Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
            <AlertDialogDescription>Onboardings already created from it are not affected. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => start(async () => { const r = await deleteTemplate(id); if (r.ok) { toast.success("Template deleted"); router.refresh(); } else toast.error(r.error); })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
