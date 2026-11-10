import { CheckCircle2, CircleAlert, CreditCard, ExternalLink } from "lucide-react";
import { requireWorkspace, canAdmin } from "@/lib/auth";
import { features } from "@/lib/env";
import { syncConnectAccount } from "@/lib/stripe";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { connectStripe, refreshStripeStatus } from "../actions";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ return?: string }> }) {
  const sp = await searchParams;
  const { workspace, role } = await requireWorkspace();
  let charges = workspace.stripe_charges_enabled;
  if (sp.return && workspace.stripe_account_id && features.payments()) {
    try { charges = (await syncConnectAccount(workspace.id, workspace.stripe_account_id)).charges_enabled; } catch (e) { console.error(e); }
  }
  const configured = features.payments();
  return (
    <div className="max-w-2xl">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#635bff]/10 text-[#635bff]"><CreditCard className="size-5" /></div>
          <div className="flex-1">
            <div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">Stripe</h2>
              {!configured ? <Badge variant="outline">Not available</Badge> : charges ? <Badge variant="success"><CheckCircle2 />Connected</Badge> : workspace.stripe_account_id ? <Badge variant="warning">Setup incomplete</Badge> : <Badge variant="outline">Not connected</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Collect deposits and initial payments in your onboarding flows. Payments go directly to your own Stripe account; we never hold your funds.</p>
          </div>
        </div>
        <div className="mt-5 border-t pt-5">
          {!configured ? (
            <div className="flex gap-2 text-[13px] text-muted-foreground"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p>Payments aren&apos;t enabled on this server yet. The platform admin needs to add <code className="font-mono">STRIPE_SECRET_KEY</code> and <code className="font-mono">STRIPE_WEBHOOK_SECRET</code>. Until then, payment steps show clients that online payment isn&apos;t available, and nothing is marked as paid.</p></div>
          ) : !canAdmin(role) ? (
            <p className="text-sm text-muted-foreground">Ask a workspace owner or admin to connect Stripe.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <form action={connectStripe}><Button type="submit">{workspace.stripe_account_id ? (charges ? "Update Stripe details" : "Finish Stripe setup") : "Connect Stripe"}<ExternalLink /></Button></form>
              {workspace.stripe_account_id && <form action={async () => { "use server"; await refreshStripeStatus(); }}><Button type="submit" variant="outline">Refresh status</Button></form>}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
