import Link from "next/link";
import { formatDistanceToNowStrict, startOfMonth } from "date-fns";
import { ArrowRight, CheckCircle2, Circle, Clock, FileCheck2, MessageSquare, Plus, Send, Sparkles, AlertTriangle, Users } from "lucide-react";
import { requireWorkspace, displayName } from "@/lib/auth";
import { isOverdue, progressOf } from "@/lib/requests";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { RequestStatusBadge } from "@/components/app/status";
import { EmptyState } from "@/components/app/page-header";
import { describeActivity } from "@/components/app/activity";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, workspace, profile } = await requireWorkspace();
  const ws = workspace.id;

  const [clients, requests, pendingDocs, unread, activity, templates] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("workspace_id", ws).is("archived_at", null),
    supabase.from("onboarding_requests").select("id, title, status, due_date, created_at, completed_at, sent_at, last_client_activity_at, client:clients(id, name, company), steps:request_steps(status, required)").eq("workspace_id", ws).order("updated_at", { ascending: false }),
    supabase.from("documents").select("id, request_id", { count: "exact" }).eq("workspace_id", ws).eq("status", "pending").is("replaced_at", null),
    supabase.from("comments").select("id, request_id", { count: "exact" }).eq("workspace_id", ws).eq("author_type", "client").is("read_by_agency_at", null),
    supabase.from("activity_events").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(12),
    supabase.from("flow_templates").select("id", { count: "exact", head: true }).eq("workspace_id", ws).is("archived_at", null),
  ]);

  const all = requests.data ?? [];
  const active = all.filter((r) => r.status === "sent" || r.status === "in_progress");
  const overdue = all.filter((r) => isOverdue(r));
  const launched = all.filter((r) => r.status !== "draft" && r.status !== "cancelled");
  const completed = all.filter((r) => r.status === "completed");
  const completedThisMonth = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= startOfMonth(new Date()));
  const completionRate = launched.length ? Math.round((completed.length / launched.length) * 100) : 0;
  const avgDays = (() => {
    const done = completed.filter((r) => r.sent_at && r.completed_at);
    if (!done.length) return null;
    const ms = done.reduce((a, r) => a + (new Date(r.completed_at!).getTime() - new Date(r.sent_at!).getTime()), 0) / done.length;
    return Math.max(0.1, ms / 86_400_000);
  })();

  const firstName = displayName(profile).split(" ")[0];
  const isNew = all.length === 0;

  const stats = [
    { label: "Active onboardings", value: active.length, sub: `${all.filter((r) => r.status === "draft").length} drafts`, icon: Send },
    { label: "Completion rate", value: `${completionRate}%`, sub: `${completed.length} of ${launched.length} completed`, icon: CheckCircle2 },
    { label: "Completed this month", value: completedThisMonth.length, sub: avgDays ? `Avg. ${avgDays < 1 ? "<1" : avgDays.toFixed(1)} days to complete` : "No completions yet", icon: FileCheck2 },
    { label: "Total clients", value: clients.count ?? 0, sub: overdue.length ? `${overdue.length} overdue` : "Nothing overdue", icon: Users, warn: overdue.length > 0 },
  ];

  const attention = [
    ...overdue.map((r) => ({ id: `o-${r.id}`, href: `/requests/${r.id}`, icon: AlertTriangle, tone: "text-destructive", title: `${r.client?.name ?? "Client"} is overdue`, sub: r.title })),
    ...((pendingDocs.count ?? 0) > 0 ? [{ id: "docs", href: "/requests?review=documents", icon: FileCheck2, tone: "text-warning", title: `${pendingDocs.count} ${pendingDocs.count === 1 ? "file needs" : "files need"} review`, sub: "Approve or request a re-upload" }] : []),
    ...((unread.count ?? 0) > 0 ? [{ id: "comments", href: `/requests/${unread.data?.[0]?.request_id}?tab=comments`, icon: MessageSquare, tone: "text-info", title: `${unread.count} unread client ${unread.count === 1 ? "message" : "messages"}`, sub: "Reply from the onboarding page" }] : []),
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Good {greeting()}, {firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s where your client onboarding stands.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/templates/ai"><Sparkles className="text-[#7c3aed]" />Build with AI</Link></Button>
          <Button asChild><Link href="/requests/new"><Plus />New onboarding</Link></Button>
        </div>
      </div>

      {isNew && <GettingStarted hasTemplate={(templates.count ?? 0) > 0} hasBrand={!!workspace.logo_url} hasClient={(clients.count ?? 0) > 0} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between text-[13px] text-muted-foreground">
              {s.label}<s.icon className="size-4" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular">{s.value}</div>
            <div className={s.warn ? "mt-0.5 text-xs text-destructive" : "mt-0.5 text-xs text-muted-foreground"}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Active onboardings</h2>
            <Link href="/requests" className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">View all<ArrowRight className="size-3.5" /></Link>
          </div>
          {active.length === 0 ? (
            <EmptyState icon={Send} title="No active onboardings" description="Send your first onboarding link and track every step here." action={<Button asChild size="sm"><Link href="/requests/new"><Plus />New onboarding</Link></Button>} />
          ) : (
            <Card className="divide-y overflow-hidden">
              {active.slice(0, 7).map((r) => {
                const p = progressOf(r.steps ?? []);
                return (
                  <Link key={r.id} href={`/requests/${r.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50">
                    <Avatar name={r.client?.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{r.client?.name}</span>
                        <RequestStatusBadge status={r.status} overdue={isOverdue(r)} />
                      </div>
                      <div className="truncate text-[13px] text-muted-foreground">{r.title}</div>
                    </div>
                    <div className="hidden w-36 sm:block">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground tabular"><span>{p.done}/{p.total} steps</span><span>{p.percent}%</span></div>
                      <Progress value={p.percent} />
                    </div>
                  </Link>
                );
              })}
            </Card>
          )}
        </section>

        <aside className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold">Needs attention</h2>
            {attention.length === 0 ? (
              <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" />You&apos;re all caught up.</Card>
            ) : (
              <Card className="divide-y">
                {attention.slice(0, 6).map((a) => (
                  <Link key={a.id} href={a.href} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50">
                    <a.icon className={`mt-0.5 size-4 shrink-0 ${a.tone}`} />
                    <div className="min-w-0"><div className="text-sm font-medium">{a.title}</div><div className="truncate text-xs text-muted-foreground">{a.sub}</div></div>
                  </Link>
                ))}
              </Card>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
            {(activity.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Activity from your clients will show up here.</p>
            ) : (
              <ol className="relative space-y-4 border-l pl-4">
                {(activity.data ?? []).map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute top-1.5 -left-[20.5px] size-2 rounded-full border-2 border-background bg-muted-foreground/50" />
                    <Link href={e.request_id ? `/requests/${e.request_id}` : "#"} className="block text-[13px] leading-snug hover:underline">{describeActivity(e)}</Link>
                    <time className="text-xs text-muted-foreground"><Clock className="mr-1 inline size-3" />{formatDistanceToNowStrict(new Date(e.created_at), { addSuffix: true })}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function GettingStarted({ hasTemplate, hasBrand, hasClient }: { hasTemplate: boolean; hasBrand: boolean; hasClient: boolean }) {
  const items = [
    { done: true, label: "Create your workspace", href: "/settings" },
    { done: hasBrand, label: "Add your logo and brand color", href: "/settings" },
    { done: hasTemplate, label: "Review an onboarding template", href: "/templates" },
    { done: hasClient, label: "Send your first onboarding link", href: "/requests/new" },
  ];
  const done = items.filter((i) => i.done).length;
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">Get set up</h2>
          <p className="text-sm text-muted-foreground">A few minutes now saves hours of client back-and-forth.</p>
        </div>
        <span className="text-sm text-muted-foreground tabular">{done} of {items.length}</span>
      </div>
      <Progress value={(done / items.length) * 100} className="my-4" />
      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
              {i.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
              <span className={i.done ? "text-muted-foreground line-through" : ""}>{i.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
