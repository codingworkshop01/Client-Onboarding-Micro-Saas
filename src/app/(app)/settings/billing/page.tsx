import { Check } from "lucide-react";
import { requireWorkspace, canAdmin } from "@/lib/auth";
import { features } from "@/lib/env";
import { PLANS, type PlanTier } from "@/lib/plans";
import { aiUsageThisMonth } from "@/lib/ai/quota";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { openBillingPortal, startPlanCheckout } from "../actions";

export const metadata = { title: "Plan & billing" };

export default async function BillingPage() {
  const { supabase, workspace, role } = await requireWorkspace();
  const [{ count: active }, ai, { count: members }] = await Promise.all([
    supabase.from("onboarding_requests").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id).in("status", ["sent", "in_progress"]),
    aiUsageThisMonth(supabase, workspace.id),
    supabase.from("workspace_members").select("*", { count: "exact", head: true }).eq("workspace_id", workspace.id),
  ]);
  const plan = PLANS[workspace.plan];
  const usage = [
    { label: "Active onboardings", used: active ?? 0, limit: plan.activeRequests },
    { label: "AI generations this month", used: ai, limit: plan.aiGenerationsPerMonth },
    { label: "Team members", used: members ?? 0, limit: plan.members },
  ];
  const billing = features.billing();
  const admin = canAdmin(role);

  return (
    <div className="grid gap-6">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-[13px] text-muted-foreground">Current plan</div><div className="text-lg font-semibold">{plan.name} {workspace.billing_status && <Badge variant="outline" className="ml-1 capitalize">{workspace.billing_status.replace("_", " ")}</Badge>}</div></div>
          {workspace.billing_customer_id && admin && billing && <form action={openBillingPortal}><Button variant="outline" type="submit">Manage billing</Button></form>}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {usage.map((u) => (
            <div key={u.label}>
              <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-muted-foreground">{u.label}</span><span className="tabular">{u.used}{Number.isFinite(u.limit) ? ` / ${u.limit}` : ""}</span></div>
              <Progress value={Number.isFinite(u.limit) ? (u.used / u.limit) * 100 : 4} indicatorClassName={Number.isFinite(u.limit) && u.used >= u.limit ? "bg-destructive" : undefined} />
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(PLANS) as PlanTier[]).map((key) => {
          const p = PLANS[key];
          const current = key === workspace.plan;
          return (
            <Card key={key} className={cn("flex flex-col p-5", current && "ring-2 ring-foreground/80")}>
              <div className="flex items-center justify-between"><h3 className="font-semibold">{p.name}</h3>{current && <Badge>Current</Badge>}</div>
              <p className="text-[13px] text-muted-foreground">{p.tagline}</p>
              <div className="mt-3 text-2xl font-semibold tabular">${p.priceMonthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
              <ul className="mt-4 grid flex-1 gap-1.5 text-[13px]">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-success" />{f}</li>)}</ul>
              {key !== "free" && !current && admin && (
                billing ? <form action={startPlanCheckout.bind(null, key)} className="mt-5"><Button type="submit" className="w-full" variant={key === "agency" ? "default" : "outline"}>Upgrade to {p.name}</Button></form>
                  : <Button className="mt-5 w-full" variant="outline" disabled title="Billing isn't configured on this server yet">Upgrade to {p.name}</Button>
              )}
            </Card>
          );
        })}
      </div>
      {!billing && <p className="text-[13px] text-muted-foreground">Subscription billing isn&apos;t enabled on this server yet (needs Stripe keys and price IDs). Plan limits are enforced.</p>}
    </div>
  );
}
