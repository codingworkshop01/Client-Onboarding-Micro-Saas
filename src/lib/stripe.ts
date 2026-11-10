import "server-only";
import Stripe from "stripe";
import { env, features } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";
import { recomputeRequest } from "@/lib/requests";
import { formatMoney } from "@/lib/utils";
import type { PlanTier } from "@/lib/plans";

/**
 * Two separate Stripe flows:
 *  1. Stripe Connect (Standard accounts): agencies collect payments from their
 *     own clients; money goes straight to the agency's Stripe account.
 *  2. Stripe Billing: agencies pay for their plan.
 * Payment status changes ONLY from data Stripe confirms (webhooks, or a
 * server-side session lookup on return) — never from the browser.
 */
let _stripe: Stripe | null = null;
export function stripe() {
  if (!env.stripeSecretKey) throw new Error("Stripe is not configured");
  _stripe ??= new Stripe(env.stripeSecretKey, { appInfo: { name: env.appName } });
  return _stripe;
}

// ------------------------------------------------------------ connect ----
export async function createConnectOnboardingLink(workspace: { id: string; name: string; stripe_account_id: string | null; support_email: string | null }) {
  const s = stripe();
  let accountId = workspace.stripe_account_id;
  if (!accountId) {
    const account = await s.accounts.create({
      type: "standard",
      email: workspace.support_email ?? undefined,
      business_profile: { name: workspace.name },
      metadata: { workspace_id: workspace.id },
    });
    accountId = account.id;
    await createAdminClient().from("workspaces").update({ stripe_account_id: accountId }).eq("id", workspace.id);
  }
  const link = await s.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.appUrl}/settings/payments?refresh=1`,
    return_url: `${env.appUrl}/settings/payments?return=1`,
  });
  return link.url;
}

export async function syncConnectAccount(workspaceId: string, accountId: string) {
  const account = await stripe().accounts.retrieve(accountId);
  await createAdminClient().from("workspaces").update({ stripe_charges_enabled: account.charges_enabled }).eq("id", workspaceId).eq("stripe_account_id", accountId);
  return account;
}

// ----------------------------------------------------------- checkout ----
export async function createPaymentCheckout(input: {
  workspace: { id: string; name: string; stripe_account_id: string };
  requestId: string;
  stepId: string;
  clientEmail: string;
  amountCents: number;
  currency: string;
  description: string;
  returnUrl: string;
}) {
  const admin = createAdminClient();
  const { data: payment, error } = await admin.from("payments").insert({
    workspace_id: input.workspace.id,
    request_id: input.requestId,
    step_id: input.stepId,
    amount_cents: input.amountCents,
    currency: input.currency,
    description: input.description,
    status: "unpaid",
    provider_account_id: input.workspace.stripe_account_id,
  }).select("id").single();
  if (error) throw new Error("Couldn't start payment");

  const metadata = { payment_id: payment.id, request_id: input.requestId, step_id: input.stepId, workspace_id: input.workspace.id };
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: input.clientEmail,
    line_items: [{ quantity: 1, price_data: { currency: input.currency, unit_amount: input.amountCents, product_data: { name: input.description } } }],
    payment_intent_data: { description: `${input.description} (${input.workspace.name})`, metadata },
    metadata,
    success_url: `${input.returnUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.returnUrl}?payment=cancelled`,
  }, { stripeAccount: input.workspace.stripe_account_id, idempotencyKey: `checkout-${payment.id}` });

  await admin.from("payments").update({ checkout_session_id: session.id }).eq("id", payment.id);
  return session.url!;
}

/** Apply a Checkout Session's confirmed state to our payment row. Idempotent. */
export async function applyCheckoutSession(session: Stripe.Checkout.Session, accountId: string | null) {
  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("*").eq("checkout_session_id", session.id).maybeSingle();
  if (!payment) return;
  if (accountId && payment.provider_account_id && payment.provider_account_id !== accountId) return;
  if (payment.status === "paid") return;

  let status: "paid" | "pending" | "unpaid" = session.payment_status === "paid" || session.payment_status === "no_payment_required" ? "paid" : session.status === "complete" ? "pending" : "unpaid";
  let receiptUrl: string | null = null;
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  if (status === "paid" && piId) {
    try {
      const pi = await stripe().paymentIntents.retrieve(piId, { expand: ["latest_charge"] }, accountId ? { stripeAccount: accountId } : undefined);
      const charge = pi.latest_charge && typeof pi.latest_charge !== "string" ? pi.latest_charge : null;
      receiptUrl = charge?.receipt_url ?? null;
      if (pi.status !== "succeeded") status = "pending";
    } catch (e) {
      console.error("Couldn't load payment intent", e);
    }
  }
  if (status === "unpaid") return;
  await admin.from("payments").update({
    status,
    payment_intent_id: piId,
    receipt_url: receiptUrl,
    paid_at: status === "paid" ? new Date().toISOString() : null,
  }).eq("id", payment.id);

  if (status === "paid") {
    const { data: req } = await admin.from("onboarding_requests").select("client_id, client:clients(name)").eq("id", payment.request_id).single();
    await logActivity({ workspaceId: payment.workspace_id, requestId: payment.request_id, clientId: req?.client_id, actorType: "client", actorName: req?.client?.name, type: "payment.paid", payload: { amount: formatMoney(payment.amount_cents, payment.currency) } });
    await recomputeRequest(payment.request_id);
  }
}

export async function markPaymentFailed(session: Stripe.Checkout.Session) {
  const admin = createAdminClient();
  const { data: p } = await admin.from("payments").update({ status: "failed" }).eq("checkout_session_id", session.id).neq("status", "paid").select("workspace_id, request_id").maybeSingle();
  if (p) await logActivity({ workspaceId: p.workspace_id, requestId: p.request_id, actorType: "system", type: "payment.failed" });
}

// ------------------------------------------------------------ billing ----
export function priceToPlan(priceId: string | undefined): PlanTier {
  if (!priceId) return "free";
  if (priceId === env.stripePrices.scale) return "scale";
  if (priceId === env.stripePrices.agency) return "agency";
  if (priceId === env.stripePrices.solo) return "solo";
  return "free";
}

export async function createBillingCheckout(workspace: { id: string; billing_customer_id: string | null }, plan: Exclude<PlanTier, "free">, email: string) {
  const price = env.stripePrices[plan];
  if (!price) throw new Error("This plan isn't available yet.");
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: workspace.billing_customer_id ?? undefined,
    customer_email: workspace.billing_customer_id ? undefined : email,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: workspace.id,
    subscription_data: { metadata: { workspace_id: workspace.id } },
    metadata: { workspace_id: workspace.id, kind: "billing" },
    success_url: `${env.appUrl}/settings/billing?upgraded=1`,
    cancel_url: `${env.appUrl}/settings/billing`,
  });
  return session.url!;
}

export async function createBillingPortal(customerId: string) {
  const s = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${env.appUrl}/settings/billing` });
  return s.url;
}

export async function applySubscription(sub: Stripe.Subscription) {
  const workspaceId = sub.metadata.workspace_id;
  if (!workspaceId) return;
  const active = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  await createAdminClient().from("workspaces").update({
    plan: active ? priceToPlan(sub.items.data[0]?.price.id) : "free",
    billing_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    billing_subscription_id: sub.id,
    billing_status: sub.status,
  }).eq("id", workspaceId);
}

export { features };
