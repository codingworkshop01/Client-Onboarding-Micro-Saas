import { CheckCircle2, CircleDashed } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { features, env } from "@/lib/env";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const { workspace } = await requireWorkspace();
  const email = features.email();
  const items = [
    { name: "Email", ok: !!email, detail: email === "resend" ? "Sending with Resend" : email === "smtp" ? `Sending via SMTP (${env.smtpHost}). In local development, open the Mailpit inbox to see emails.` : "Not configured: invitations and reminders are logged as skipped." },
    { name: "AI (Anthropic Claude)", ok: features.ai(), detail: features.ai() ? `Using ${env.aiModel}` : "Add ANTHROPIC_API_KEY to enable the AI Request Builder and assistant." },
    { name: "Stripe payments", ok: features.payments() && workspace.stripe_charges_enabled, detail: !features.payments() ? "Server keys not configured." : workspace.stripe_charges_enabled ? "Connected" : "Connect your account in Settings → Payments." },
    { name: "Google Drive export", ok: false, detail: "Coming soon. Use ZIP export from any onboarding in the meantime." },
    { name: "Zapier, Make & webhooks", ok: false, detail: "Coming soon." },
    { name: "One-click Meta & Google access (OAuth)", ok: false, detail: "Coming soon. Guided access instructions are available today." },
  ];
  return (
    <Card className="max-w-3xl divide-y">
      {items.map((i) => (
        <div key={i.name} className="flex items-start gap-3 px-5 py-4">
          {i.ok ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <CircleDashed className="mt-0.5 size-4 text-muted-foreground" />}
          <div className="flex-1"><div className="text-sm font-medium">{i.name}</div><div className="text-[13px] text-muted-foreground">{i.detail}</div></div>
          <Badge variant={i.ok ? "success" : "outline"}>{i.ok ? "Active" : "Off"}</Badge>
        </div>
      ))}
    </Card>
  );
}
