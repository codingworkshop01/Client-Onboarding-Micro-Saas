import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft, Building2, Calendar, CheckCircle2, CircleDashed, Clock, ExternalLink, Mail, Phone, ShieldCheck, Loader } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { features } from "@/lib/env";
import { isOverdue, progressOf, rowToStep } from "@/lib/requests";
import { visibleFields } from "@/lib/flows/logic";
import { ACCESS_PLATFORM_GUIDES } from "@/lib/flows/access-platforms";
import type { AnswerValue, Step } from "@/lib/flows/schema";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestStatusBadge } from "@/components/app/status";
import { StepTypeIcon } from "@/components/builder/step-icon";
import { describeActivity } from "@/components/app/activity";
import { RequestActions, ReopenStepButton } from "./request-actions";
import { DocumentRow } from "./document-review";
import { CommentsThread } from "./comments-thread";
import { ReminderSettings } from "./reminder-settings";
import { AiPanel } from "./ai-panel";

export const metadata = { title: "Onboarding" };

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, workspace } = await requireWorkspace();

  const { data: r } = await supabase.from("onboarding_requests").select("*, client:clients(*)").eq("id", id).eq("workspace_id", workspace.id).maybeSingle();
  if (!r || !r.client) notFound();

  const [steps, docs, sigs, pays, comments, activity, emails, links] = await Promise.all([
    supabase.from("request_steps").select("*").eq("request_id", id).order("position"),
    supabase.from("documents").select("*").eq("request_id", id).order("uploaded_at"),
    supabase.from("signatures").select("*").eq("request_id", id),
    supabase.from("payments").select("*").eq("request_id", id).order("created_at", { ascending: false }),
    supabase.from("comments").select("*").eq("request_id", id).order("created_at"),
    supabase.from("activity_events").select("*").eq("request_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("notifications_log").select("*").eq("request_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("magic_links").select("id, expires_at, revoked_at, last_used_at, created_at").eq("request_id", id).order("created_at", { ascending: false }),
  ]);

  const stepRows = steps.data ?? [];
  const progress = progressOf(stepRows);
  const overdue = isOverdue(r);
  const unread = (comments.data ?? []).filter((c) => c.author_type === "client" && !c.read_by_agency_at).length;
  const activeLinks = (links.data ?? []).filter((l) => !l.revoked_at && new Date(l.expires_at) > new Date()).length;
  const lastOpened = (links.data ?? []).map((l) => l.last_used_at).filter(Boolean).sort().pop();

  return (
    <div>
      <Link href="/requests" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Onboardings</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={r.client.name} className="size-10 text-sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{r.client.name}</h1>
              <RequestStatusBadge status={r.status} overdue={overdue} />
            </div>
            <p className="truncate text-sm text-muted-foreground">{r.title}</p>
          </div>
        </div>
        <RequestActions id={r.id} status={r.status} clientEmail={r.client.email} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Card className="mb-6 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">{progress.done} of {progress.total} steps complete</span>
              <span className="text-muted-foreground tabular">{progress.percent}%</span>
            </div>
            <Progress value={progress.percent} indicatorClassName={r.status === "completed" ? "bg-success" : undefined} />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
              {r.sent_at && <span className="flex items-center gap-1.5"><Mail className="size-3.5" />Sent {formatDistanceToNowStrict(new Date(r.sent_at), { addSuffix: true })}</span>}
              {lastOpened ? <span className="flex items-center gap-1.5"><ExternalLink className="size-3.5" />Last opened {formatDistanceToNowStrict(new Date(lastOpened), { addSuffix: true })}</span> : r.sent_at ? <span className="flex items-center gap-1.5"><ExternalLink className="size-3.5" />Not opened yet</span> : null}
              {r.completed_at && <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="size-3.5" />Completed {format(new Date(r.completed_at), "MMM d, yyyy")}</span>}
            </div>
          </Card>

          <Tabs defaultValue={tab === "comments" ? "comments" : "submissions"}>
            <TabsList className="mb-5">
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
              <TabsTrigger value="comments">Comments{(comments.data?.length ?? 0) > 0 && <Badge variant={unread ? "info" : "default"} className="ml-0.5 px-1">{comments.data?.length}</Badge>}</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
            </TabsList>

            <TabsContent value="submissions" className="grid gap-4">
              {stepRows.map((row, i) => {
                let step: Step | null = null;
                try { step = rowToStep(row); } catch { step = null; }
                if (!step) return null;
                const data = (row.data ?? {}) as { answers?: Record<string, AnswerValue>; confirmations?: Record<string, { confirmed: boolean; at: string }>; skipped?: boolean };
                const stepDocs = (docs.data ?? []).filter((d) => d.step_id === row.id);
                return (
                  <Card key={row.id} className="overflow-hidden">
                    <div className="flex items-center gap-3 border-b px-4 py-3">
                      <StepTypeIcon type={step.type} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{i + 1}. {row.title}</div>
                        {!row.required && <div className="text-xs text-muted-foreground">Optional</div>}
                      </div>
                      {row.status === "completed" ? <Badge variant="success"><CheckCircle2 />{data.skipped ? "Skipped" : "Complete"}</Badge>
                        : row.status === "in_progress" ? <Badge variant="warning"><Loader />In progress</Badge>
                        : <Badge variant="outline"><CircleDashed />Not started</Badge>}
                      {row.status === "completed" && (step.type === "form" || step.type === "files" || step.type === "access") && <ReopenStepButton stepId={row.id} />}
                    </div>
                    <div className="px-4 py-4">
                      {step.type === "form" && (() => {
                        const answers = data.answers ?? {};
                        const shown = visibleFields(step.config.fields, answers);
                        if (!Object.keys(answers).length && !stepDocs.length) return <Empty />;
                        return (
                          <dl className="grid gap-4">
                            {shown.map((f) => (
                              <div key={f.id}>
                                <dt className="text-[13px] text-muted-foreground">{f.label}</dt>
                                <dd className="mt-0.5 text-sm whitespace-pre-wrap">
                                  {f.type === "file"
                                    ? stepDocs.filter((d) => d.item_key === f.id).map((d) => <DocumentRow key={d.id} doc={d} />)
                                    : formatAnswer(answers[f.id], f.options)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        );
                      })()}
                      {step.type === "files" && (
                        <div className="grid gap-4">
                          {step.config.items.map((item) => {
                            const itemDocs = stepDocs.filter((d) => d.item_key === item.id);
                            return (
                              <div key={item.id}>
                                <div className="mb-1.5 text-[13px] text-muted-foreground">{item.label}{item.required && " *"}</div>
                                {itemDocs.length ? <div className="grid gap-1.5">{itemDocs.map((d) => <DocumentRow key={d.id} doc={d} />)}</div> : <p className="text-sm text-muted-foreground">Nothing uploaded yet</p>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {step.type === "access" && (
                        <ul className="grid gap-2">
                          {step.config.items.map((item) => {
                            const c = data.confirmations?.[item.id];
                            return (
                              <li key={item.id} className="flex items-center gap-2.5 text-sm">
                                {c?.confirmed ? <CheckCircle2 className="size-4 text-success" /> : <CircleDashed className="size-4 text-muted-foreground" />}
                                <span className="flex-1">{item.label || ACCESS_PLATFORM_GUIDES[item.platform].name}</span>
                                <span className="text-xs text-muted-foreground">{c?.confirmed ? `Confirmed ${format(new Date(c.at), "MMM d, h:mm a")}` : "Waiting"}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {step.type === "agreement" && (() => {
                        const sig = (sigs.data ?? []).find((s) => s.step_id === row.id);
                        if (!sig) return <p className="text-sm text-muted-foreground">Not signed yet: “{step.config.agreementTitle}”</p>;
                        return (
                          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                            <div className="grid gap-1 text-sm">
                              <div className="font-medium">{sig.agreement_title}</div>
                              <div className="text-muted-foreground">Signed by {sig.signer_name} ({sig.signer_email}) · {format(new Date(sig.signed_at), "MMM d, yyyy 'at' h:mm a")}</div>
                              <details className="mt-1 text-xs text-muted-foreground">
                                <summary className="flex cursor-pointer items-center gap-1"><ShieldCheck className="size-3.5" />Audit trail</summary>
                                <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
                                  <dt>Method</dt><dd className="capitalize">{sig.signature_type} signature</dd>
                                  <dt>IP address</dt><dd>{sig.ip_address ?? "Unknown"}</dd>
                                  <dt>Device</dt><dd className="truncate">{sig.user_agent ?? "Unknown"}</dd>
                                  <dt>Document hash</dt><dd className="font-mono break-all">{sig.document_hash}</dd>
                                </dl>
                              </details>
                            </div>
                            {sig.pdf_path && <a href={`/api/signatures/${sig.id}/pdf`} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium hover:bg-accent">Download PDF</a>}
                          </div>
                        );
                      })()}
                      {step.type === "payment" && (() => {
                        const pay = (pays.data ?? []).find((p) => p.step_id === row.id);
                        return (
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium tabular">{formatMoney(step.config.amountCents, step.config.currency)}</div>
                              <div className="text-muted-foreground">{step.config.description ?? "Payment"}</div>
                            </div>
                            <div className="text-right">
                              <Badge variant={pay?.status === "paid" ? "success" : pay?.status === "failed" ? "danger" : pay?.status === "pending" ? "warning" : "outline"} className="capitalize">{pay?.status ?? "unpaid"}</Badge>
                              {pay?.paid_at && <div className="mt-1 text-xs text-muted-foreground">{format(new Date(pay.paid_at), "MMM d, yyyy")}</div>}
                              {pay?.receipt_url && <a href={pay.receipt_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-info hover:underline">Receipt</a>}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="comments">
              <CommentsThread requestId={r.id} unread={unread} comments={(comments.data ?? []).map((c) => ({ id: c.id, authorType: c.author_type, authorName: c.author_name, body: c.body, createdAt: c.created_at }))} />
            </TabsContent>

            <TabsContent value="activity">
              {(activity.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
                <ol className="relative ml-1 space-y-4 border-l pl-5">
                  {(activity.data ?? []).map((e) => (
                    <li key={e.id} className="relative">
                      <span className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background ${e.actor_type === "client" ? "bg-info" : e.actor_type === "system" ? "bg-success" : "bg-muted-foreground/60"}`} />
                      <div className="text-sm">{describeActivity(e)}</div>
                      <time className="text-xs text-muted-foreground">{format(new Date(e.created_at), "MMM d, yyyy 'at' h:mm a")}</time>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            <TabsContent value="emails">
              {(emails.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No emails sent yet.</p> : (
                <Card className="divide-y">
                  {(emails.data ?? []).map((n) => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                      <Mail className="mt-0.5 size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{n.subject}</div>
                        <div className="text-xs text-muted-foreground">To {n.recipient} · <span className="capitalize">{n.kind.replace("_", " ")}</span> · {format(new Date(n.created_at), "MMM d, h:mm a")}</div>
                        {n.error && <div className="mt-0.5 text-xs text-destructive">{n.error}</div>}
                      </div>
                      <Badge variant={n.status === "sent" ? "success" : n.status === "failed" ? "danger" : "outline"} className="capitalize">{n.status}</Badge>
                    </div>
                  ))}
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="grid content-start gap-4">
          <Card className="p-4">
            <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Client</h3>
            <Link href={`/clients/${r.client.id}`} className="block text-sm font-medium hover:underline">{r.client.name}</Link>
            <div className="mt-2 grid gap-1.5 text-[13px] text-muted-foreground">
              <a href={`mailto:${r.client.email}`} className="flex items-center gap-2 hover:text-foreground"><Mail className="size-3.5" />{r.client.email}</a>
              {r.client.company && <span className="flex items-center gap-2"><Building2 className="size-3.5" />{r.client.company}</span>}
              {r.client.phone && <span className="flex items-center gap-2"><Phone className="size-3.5" />{r.client.phone}</span>}
            </div>
            <div className="mt-3 grid gap-1.5 border-t pt-3 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-2"><Calendar className="size-3.5" />Created {format(new Date(r.created_at), "MMM d, yyyy")}</span>
              {r.due_date && <span className={`flex items-center gap-2 ${overdue ? "text-destructive" : ""}`}><Clock className="size-3.5" />Due {format(new Date(`${r.due_date}T12:00:00`), "MMM d, yyyy")}</span>}
              <span className="flex items-center gap-2"><ShieldCheck className="size-3.5" />{activeLinks} active {activeLinks === 1 ? "link" : "links"}</span>
            </div>
          </Card>
          <ReminderSettings
            id={r.id}
            active={r.status === "sent" || r.status === "in_progress"}
            enabled={r.reminders_enabled}
            intervalDays={r.reminder_interval_days}
            maxReminders={r.max_reminders}
            sent={r.reminders_sent}
            nextAt={r.next_reminder_at}
            dueDate={r.due_date}
          />
          <AiPanel
            id={r.id}
            enabled={features.ai()}
            status={r.status}
            summary={r.ai_summary}
            summaryAt={r.ai_summary_at}
            brief={r.ai_brief}
            briefAt={r.ai_brief_at}
          />
        </aside>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">No answers yet.</p>;
}

function formatAnswer(value: AnswerValue | undefined, options?: { id: string; label: string }[]) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return <span className="text-muted-foreground">—</span>;
  const label = (v: string) => options?.find((o) => o.id === v)?.label ?? v;
  if (Array.isArray(value)) return value.map((v) => label(String(v))).join(", ");
  const s = label(String(value));
  if (/^https?:\/\//i.test(s)) return <a href={s} target="_blank" rel="noreferrer noopener" className="text-info hover:underline">{s}</a>;
  return s;
}
