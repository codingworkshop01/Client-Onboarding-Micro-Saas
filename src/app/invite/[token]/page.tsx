import Link from "next/link";
import type { Metadata } from "next";
import { MailX, Users } from "lucide-react";
import { getUser } from "@/lib/auth";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { lookupInvite } from "./lookup";
import { AcceptButton } from "./accept-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team invitation", robots: { index: false }, referrer: "no-referrer" };

const CLOSED = {
  invalid: "This invitation link isn't valid. Check you copied the whole link.",
  expired: "This invitation has expired. Ask the person who invited you to send a new one.",
  revoked: "This invitation was cancelled. Ask the person who invited you for a new one.",
  accepted: "This invitation has already been accepted.",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await lookupInvite(token);
  const user = await getUser();
  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex h-16 items-center px-5 sm:px-8"><Link href="/"><Logo /></Link></header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-card">
          {inv.state !== "open" ? (
            <>
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border bg-background"><MailX className="size-5 text-muted-foreground" /></div>
              <h1 className="text-lg font-semibold">Invitation unavailable</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{CLOSED[inv.state]}</p>
              {inv.state === "accepted" && <Button asChild className="mt-5 w-full"><Link href="/dashboard">Go to dashboard</Link></Button>}
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border bg-background"><Users className="size-5 text-muted-foreground" /></div>
              <h1 className="text-lg font-semibold">Join {inv.workspaceName}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {inv.inviterName ? `${inv.inviterName} invited you` : "You've been invited"} to join as {inv.role === "admin" ? "an admin" : "a team member"}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Invitation for {inv.email}</p>
              {user ? (
                <div className="mt-5 grid gap-2">
                  <AcceptButton token={token} />
                  <p className="text-xs text-muted-foreground">Signed in as {user.email}</p>
                </div>
              ) : (
                <div className="mt-5 grid gap-2">
                  <Button asChild className="w-full"><Link href={`/signup?next=${next}&email=${encodeURIComponent(inv.email)}`}>Create an account</Link></Button>
                  <Button asChild variant="outline" className="w-full"><Link href={`/login?next=${next}`}>I already have an account</Link></Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
