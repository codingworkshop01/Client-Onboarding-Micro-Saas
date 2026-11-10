"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, MoreHorizontal, Send, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { changeRole, inviteMember, removeMember, resendInvite, revokeInvite } from "./actions";

function emailToast(status: string) {
  if (status === "sent") toast.success("Invitation sent");
  else toast.warning(`Invitation created, but the email wasn't sent (${status}). Copy the link and share it.`);
}

function LinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check /> : <Copy />}</Button>
    </div>
  );
}

export function InviteDialog({ seatsFull, planName }: { seatsFull: boolean; planName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = (o: boolean) => { setOpen(o); if (!o) { setEmail(""); setRole("member"); setLink(null); } };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={seatsFull} title={seatsFull ? `All seats on the ${planName} plan are in use` : undefined}><UserPlus />Invite teammate</Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{link ? "Invitation created" : "Invite a teammate"}</DialogTitle>
            <DialogDescription>{link ? "They can also join with this link. It works only for the invited email and expires in 7 days." : "They'll get an email with a link to join this workspace."}</DialogDescription>
          </DialogHeader>
          {link ? (
            <>
              <LinkBox link={link} />
              <DialogFooter><Button onClick={() => close(false)}>Done</Button></DialogFooter>
            </>
          ) : (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
              const r = await inviteMember(email, role);
              if (!r.ok) return void toast.error(r.error);
              emailToast(r.emailStatus);
              setLink(r.link);
              router.refresh();
            }); }}>
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field label="Email" htmlFor="inv-email"><Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@agency.com" autoFocus required /></Field>
                <Field label="Role">
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
                <Button type="submit" loading={pending} disabled={!email.trim()}><Send />Send invitation</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InviteRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  return (
    <>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { const r = await resendInvite(id); if (!r.ok) return void toast.error(r.error); emailToast(r.emailStatus); setLink(r.link); router.refresh(); })}>Resend</Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => start(async () => { const r = await revokeInvite(id); if (!r.ok) return void toast.error(r.error); toast.success("Invitation cancelled"); router.refresh(); })}>Cancel</Button>
      </div>
      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>New invitation link</DialogTitle><DialogDescription>The previous link no longer works.</DialogDescription></DialogHeader>
          {link && <LinkBox link={link} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MemberRowActions({ userId, role, name }: { userId: string; role: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <Select value={role} disabled={pending} onValueChange={(v) => start(async () => { const r = await changeRole(userId, v); if (!r.ok) return void toast.error(r.error); toast.success("Role updated"); router.refresh(); })}>
        <SelectTrigger className="h-8 w-28" aria-label={`Role for ${name}`}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
      </Select>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`More for ${name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem destructive onSelect={() => setConfirm(true)}><Trash2 />Remove from workspace</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
            <AlertDialogDescription>They lose access to this workspace immediately. Onboardings they created stay in the workspace.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => start(async () => { const r = await removeMember(userId); if (!r.ok) return void toast.error(r.error); toast.success("Member removed"); router.refresh(); })}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
