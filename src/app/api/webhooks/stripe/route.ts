import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyCheckoutSession, applySubscription, markPaymentFailed, stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Register one endpoint that listens to your platform account
 * AND connected accounts ("Listen to events on Connected accounts").
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.async_payment_failed, account.updated,
 * customer.subscription.created/updated/deleted.
 */
export async function POST(request: NextRequest) {
  if (!env.stripeSecretKey || !env.stripeWebhookSecret) return new NextResponse("Stripe not configured", { status: 503 });
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), sig, env.stripeWebhookSecret);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dup } = await admin.from("processed_webhook_events").insert({ id: event.id, provider: "stripe", type: event.type });
  if (dup?.code === "23505") return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.mode === "payment") await applyCheckoutSession(session, event.account ?? null);
        break;
      }
      case "checkout.session.async_payment_failed":
        await markPaymentFailed(event.data.object);
        break;
      case "account.updated": {
        const acct = event.data.object;
        await admin.from("workspaces").update({ stripe_charges_enabled: acct.charges_enabled }).eq("stripe_account_id", acct.id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object);
        break;
    }
  } catch (e) {
    // Let Stripe retry: remove the idempotency marker.
    await admin.from("processed_webhook_events").delete().eq("id", event.id);
    console.error("stripe webhook failed", event.type, e);
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
  return NextResponse.json({ received: true });
}
