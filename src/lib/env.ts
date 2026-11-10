import "server-only";

/**
 * Server-side configuration. Optional integrations report whether they are
 * configured so the UI can show an honest "not set up" state instead of
 * pretending an external action happened.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Onboardly",
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "Onboardly <onboarding@example.com>",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  aiProvider: process.env.AI_PROVIDER || "anthropic",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  aiModel: process.env.AI_MODEL || "claude-sonnet-5-5",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripePrices: {
    solo: process.env.STRIPE_PRICE_SOLO || "",
    agency: process.env.STRIPE_PRICE_AGENCY || "",
    scale: process.env.STRIPE_PRICE_SCALE || "",
  },
  cronSecret: process.env.CRON_SECRET || "",
};

export const features = {
  email: () => (env.resendApiKey ? "resend" : env.smtpHost ? "smtp" : null) as "resend" | "smtp" | null,
  ai: () => (env.aiProvider === "anthropic" && env.anthropicApiKey ? true : false),
  payments: () => Boolean(env.stripeSecretKey && env.stripeWebhookSecret),
  billing: () => Boolean(env.stripeSecretKey && env.stripeWebhookSecret && env.stripePrices.solo),
};
