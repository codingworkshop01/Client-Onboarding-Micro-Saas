import type { Metadata } from "next";
import { Link2Off } from "lucide-react";
import { resolveToken, loadPortalData } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { features } from "@/lib/env";
import { applyCheckoutSession, stripe } from "@/lib/stripe";
import { PortalClient } from "./portal-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your onboarding", robots: { index: false, follow: false }, referrer: "no-referrer" };

const MESSAGES = {
  invalid: { title: "This link isn't valid", body: "Check that you copied the whole link from your email, or ask for a new one." },
  expired: { title: "This link has expired", body: "For your security, onboarding links expire. Ask your contact to send you a fresh link." },
  revoked: { title: "This link is no longer active", body: "A newer link may have been sent to you. Check your inbox, or ask your contact for a new one." },
  cancelled: { title: "This onboarding was cancelled", body: "If you think this is a mistake, contact the business that sent it to you." },
};

export default async function PortalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ payment?: string; session_id?: string; step?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const access = await resolveToken(token);
  if (!access.ok) {
    const m = MESSAGES[access.reason];
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface px-5">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border bg-background"><Link2Off className="size-5 text-muted-foreground" /></div>
          <h1 className="text-lg font-semibold">{m.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{m.body}</p>
        </div>
      </main>
    );
  }

  // Returning from Stripe Checkout: confirm with Stripe server-side (never trust the URL alone).
  let paymentNotice: "success" | "cancelled" | null = null;
  if (sp.payment === "success" && sp.session_id && features.payments()) {
    try {
      const admin = createAdminClient();
      const { data: pay } = await admin.from("payments").select("provider_account_id").eq("checkout_session_id", sp.session_id).eq("request_id", access.requestId).maybeSingle();
      if (pay?.provider_account_id) {
        const session = await stripe().checkout.sessions.retrieve(sp.session_id, undefined, { stripeAccount: pay.provider_account_id });
        await applyCheckoutSession(session, pay.provider_account_id);
        paymentNotice = "success";
      }
    } catch (e) {
      console.error("payment return check failed", e);
    }
  } else if (sp.payment === "cancelled") paymentNotice = "cancelled";

  const data = await loadPortalData(access.requestId);
  if (!data) return null;

  // First open: log it once per link (cheap check on activity).
  const admin = createAdminClient();
  const { count } = await admin.from("activity_events").select("*", { count: "exact", head: true }).eq("request_id", access.requestId).eq("type", "request.opened");
  if (!count) await logActivity({ workspaceId: access.workspaceId, requestId: access.requestId, clientId: access.clientId, actorType: "client", actorName: data.client.name, type: "request.opened" });

  return <PortalClient token={token} data={data} paymentNotice={paymentNotice} initialStepId={sp.step ?? null} />;
}
