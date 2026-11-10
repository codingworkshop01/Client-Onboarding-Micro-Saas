"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace, canAdmin } from "@/lib/auth";
import { audit } from "@/lib/activity";
import { createBillingCheckout, createBillingPortal, createConnectOnboardingLink, syncConnectAccount } from "@/lib/stripe";
import { features } from "@/lib/env";

type R = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

const wsSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "3–40 lowercase letters, numbers and dashes"),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #4f46e5"),
  supportEmail: z.string().trim().email("Enter a valid email").or(z.literal("")),
  website: z.string().trim().max(300).or(z.literal("")),
  welcomeMessage: z.string().trim().max(1000),
  reminderIntervalDays: z.number().int().min(1).max(30),
  maxReminders: z.number().int().min(0).max(20),
});

export async function updateWorkspace(input: z.input<typeof wsSchema>): Promise<R> {
  const v = wsSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]!.message, fieldErrors: v.error.flatten().fieldErrors };
  const { supabase, workspace, role, user } = await requireWorkspace();
  if (!canAdmin(role)) return { ok: false, error: "Only owners and admins can change workspace settings" };
  const { error } = await supabase.from("workspaces").update({
    name: v.data.name, slug: v.data.slug, brand_color: v.data.brandColor.toLowerCase(), support_email: v.data.supportEmail || null,
    website: v.data.website || null, welcome_message: v.data.welcomeMessage || null,
    reminder_interval_days: v.data.reminderIntervalDays, max_reminders: v.data.maxReminders,
  }).eq("id", workspace.id);
  if (error) return error.code === "23505" ? { ok: false, error: "That URL is taken", fieldErrors: { slug: ["That URL is taken"] } } : { ok: false, error: "Couldn't save" };
  await audit({ workspaceId: workspace.id, actorType: "member", actorId: user.id, action: "workspace.updated" });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setLogoUrl(url: string | null): Promise<R> {
  const { supabase, workspace, role } = await requireWorkspace();
  if (!canAdmin(role)) return { ok: false, error: "Only owners and admins can change the logo" };
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branding/${workspace.id}/`;
  if (url && !url.startsWith(base)) return { ok: false, error: "Invalid logo" };
  await supabase.from("workspaces").update({ logo_url: url }).eq("id", workspace.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProfileName(name: string): Promise<R> {
  const v = z.string().trim().min(1).max(80).safeParse(name);
  if (!v.success) return { ok: false, error: "Enter your name" };
  const { supabase, user } = await requireWorkspace();
  await supabase.from("profiles").update({ full_name: v.data }).eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function connectStripe() {
  const { workspace, role } = await requireWorkspace();
  if (!canAdmin(role) || !features.payments()) redirect("/settings/payments");
  const url = await createConnectOnboardingLink(workspace);
  redirect(url);
}

export async function refreshStripeStatus(): Promise<R> {
  const { workspace } = await requireWorkspace();
  if (!workspace.stripe_account_id) return { ok: false, error: "No Stripe account connected" };
  await syncConnectAccount(workspace.id, workspace.stripe_account_id);
  revalidatePath("/settings/payments");
  return { ok: true };
}

export async function startPlanCheckout(plan: "solo" | "agency" | "scale") {
  const { workspace, role, user } = await requireWorkspace();
  if (!canAdmin(role) || !features.billing()) redirect("/settings/billing");
  redirect(await createBillingCheckout(workspace, plan, user.email ?? ""));
}

export async function openBillingPortal() {
  const { workspace, role } = await requireWorkspace();
  if (!canAdmin(role) || !workspace.billing_customer_id) redirect("/settings/billing");
  redirect(await createBillingPortal(workspace.billing_customer_id));
}
