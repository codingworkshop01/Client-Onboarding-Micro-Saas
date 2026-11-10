import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Building2, FileSignature, FileIcon, Globe, Mail, Phone, Plus, CreditCard } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { isOverdue, progressOf } from "@/lib/requests";
import { formatBytes, formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RequestStatusBadge } from "@/components/app/status";
import { describeActivity } from "@/components/app/activity";
import { ClientDialog } from "../client-form";
import { ClientNotes, ClientMenu } from "./client-extras";

export const metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, workspace } = await requireWorkspace();
  const { data: c } = await supabase.from("clients").select("*").eq("id", id).eq("workspace_id", workspace.id).maybeSingle();
  if (!c) notFound();
  const [reqs, notes, docs, sigs, pays, activity] = await Promise.all([
    supabase.from("onboarding_requests").select("id, title, status, due_date, created_at, steps:request_steps(status, required)").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("client_notes").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("documents").select("id, file_name, size_bytes, status, uploaded_at, request_id").eq("client_id", id).is("replaced_at", null).order("uploaded_at", { ascending: false }),
    supabase.from("signatures").select("id, agreement_title, signed_at, signer_name, pdf_path, request:onboarding_requests!inner(client_id)").eq("request.client_id", id),
    supabase.from("payments").select("id, amount_cents, currency, status, paid_at, description, request:onboarding_requests!inner(client_id)").eq("request.client_id", id),
    supabase.from("activity_events").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(30),
  ]);

  return (
    <div>
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Clients</Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={c.name} className="size-11 text-sm" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{c.name}{c.archived_at && <Badge variant="outline" className="ml-2 align-middle">Archived</Badge>}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-foreground"><Mail className="size-3.5" />{c.email}</a>
              {c.company && <span className="flex items-center gap-1.5"><Building2 className="size-3.5" />{c.company}</span>}
              {c.phone && <span className="flex items-center gap-1.5"><Phone className="size-3.5" />{c.phone}</span>}
              {c.website && <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground"><Globe className="size-3.5" />{c.website}</a>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <ClientDialog client={{ id: c.id, name: c.name, email: c.email, company: c.company ?? "", phone: c.phone ?? "", website: c.website ?? "" }} />
          <Button asChild><Link href={`/requests/new?client=${c.id}`}><Plus />New onboarding</Link></Button>
          <ClientMenu id={c.id} archived={!!c.archived_at} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold">Onboarding history</h2>
            {!reqs.data?.length ? <p className="text-sm text-muted-foreground">No onboardings yet.</p> : (
              <Card className="divide-y">
                {reqs.data.map((r) => {
                  const p = progressOf(r.steps ?? []);
                  return (
                    <Link key={r.id} href={`/requests/${r.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40">
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{r.title}</div><div className="text-xs text-muted-foreground">Created {format(new Date(r.created_at), "MMM d, yyyy")}</div></div>
                      <div className="hidden w-32 sm:block"><Progress value={p.percent} /></div>
                      <RequestStatusBadge status={r.status} overdue={isOverdue(r)} />
                    </Link>
                  );
                })}
              </Card>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold">Documents ({docs.data?.length ?? 0})</h2>
            {!docs.data?.length ? <p className="text-sm text-muted-foreground">No files yet.</p> : (
              <Card className="divide-y">
                {docs.data.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <FileIcon className="size-4 text-muted-foreground" />
                    <a href={`/api/documents/${d.id}/download?download=1`} className="min-w-0 flex-1 truncate hover:underline">{d.file_name}</a>
                    <span className="text-xs text-muted-foreground">{formatBytes(d.size_bytes)}</span>
                    <Badge variant={d.status === "approved" ? "success" : d.status === "rejected" ? "danger" : "warning"} className="capitalize">{d.status}</Badge>
                  </div>
                ))}
              </Card>
            )}
          </section>
          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h2 className="mb-3 text-sm font-semibold">Signed agreements</h2>
              {!sigs.data?.length ? <p className="text-sm text-muted-foreground">None yet.</p> : (
                <Card className="divide-y">
                  {sigs.data.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <FileSignature className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1"><div className="truncate">{s.agreement_title}</div><div className="text-xs text-muted-foreground">{format(new Date(s.signed_at), "MMM d, yyyy")}</div></div>
                      {s.pdf_path && <a href={`/api/signatures/${s.id}/pdf`} className="text-[13px] text-info hover:underline">PDF</a>}
                    </div>
                  ))}
                </Card>
              )}
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold">Payments</h2>
              {!pays.data?.length ? <p className="text-sm text-muted-foreground">None yet.</p> : (
                <Card className="divide-y">
                  {pays.data.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <CreditCard className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1"><div className="tabular">{formatMoney(p.amount_cents, p.currency)}</div><div className="truncate text-xs text-muted-foreground">{p.description}</div></div>
                      <Badge variant={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "outline"} className="capitalize">{p.status}</Badge>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          </div>
        </div>
        <aside className="grid content-start gap-6">
          <ClientNotes clientId={c.id} notes={(notes.data ?? []).map((n) => ({ id: n.id, body: n.body, author: n.author_name ?? "Team", createdAt: n.created_at }))} />
          <section>
            <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
            {!activity.data?.length ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
              <ol className="relative ml-1 space-y-3 border-l pl-4">
                {activity.data.map((e) => (
                  <li key={e.id} className="relative text-[13px]">
                    <span className="absolute top-1.5 -left-[20.5px] size-2 rounded-full border-2 border-background bg-muted-foreground/50" />
                    {describeActivity(e)}
                    <div className="text-xs text-muted-foreground">{format(new Date(e.created_at), "MMM d, h:mm a")}</div>
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
