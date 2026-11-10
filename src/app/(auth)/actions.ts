"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type AuthState = { error?: string; message?: string; fieldErrors?: Record<string, string[] | undefined> } | undefined;

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

/** After sign-up: an invite link if one was passed, otherwise workspace setup. */
function nextAfterSignup(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return /^\/invite\/[A-Za-z0-9_-]{40,60}$/.test(n) ? n : "/onboarding";
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password") }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 10, 300))) return { error: "Too many attempts. Please wait a few minutes and try again." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message === "Email not confirmed" ? "Please confirm your email first. Check your inbox." : "Incorrect email or password." };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({
    fullName: z.string().trim().min(1, "Enter your name").max(80),
    email,
    password,
  }).safeParse({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, 5, 3600))) return { error: "Too many sign-ups from this network. Try again later." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent(nextAfterSignup(form.get("next")))}` },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: "Check your inbox to confirm your email, then sign in." };
  redirect(nextAfterSignup(form.get("next")));
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { fieldErrors: { email: [parsed.error.issues[0]!.message] } };
  const ip = await clientIp();
  if (!(await rateLimit(`reset:${ip}`, 5, 900))) return { error: "Too many requests. Please try again later." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${env.appUrl}/auth/callback?next=/reset-password` });
  // Same response whether or not the account exists (no account enumeration).
  return { message: "If an account exists for that email, we've sent a reset link." };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
    .safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  redirect("/dashboard?passwordUpdated=1");
}
