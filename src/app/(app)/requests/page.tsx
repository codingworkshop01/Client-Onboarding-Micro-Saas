import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import { FileCheck2, MessageSquare, Plus, Send } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { isOverdue, progressOf } from "@/lib/requests";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { RequestStatusBadge } from "@/components/app/status";
import { ListFilters } from "@/components/app/list-filters";

export const metadata = { title: "Onboardings" };

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "draft", label: "Drafts" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; review?: string }> }) {
  const sp = await searchParams;
  const { supabase, workspace } = await requireWorkspace();
  const status = sp.status ?? "all";

  let query = supabase
    .from("onboarding_requests")
    .select("id, title, status, due_date, created_at, updated_at, last_client_activity_at, client:clients(id, name, email, company), steps:request_steps(status, required), documents(status, replaced_at), comments(author_type, read_by_agency_at)")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (status === "active" || status === "overdue") query = query.in("status", ["sent", "in_progress"]);
  else if (["completed", "draft", "cancelled"].includes(status)) query = query.eq("status", status as "completed");
  if (sp.q?.trim()) {
    const like = `%${sp.q.trim().replace(/[%_\\,()*]/g, "")}%`;
    const { data: matchingClients } = await supabase.from("clients").select("id").eq("workspace_id", workspace.id).or(`name.ilike.${like},email.ilike.${like},company.ilike.${like}`).limit(100);
    const ids = (matchingClients ?? []).map((c) => c.id);
    query = query.or(ids.length ? `title.ilike.${like},client_id.in.(${ids.join(",")})` : `title.ilike.${like}`);
  }
  const { data } = await query;
  let rows = (data ?? []).map((r) => ({
    ...r,
    overdue: isOverdue(r),
    progress: progressOf(r.steps ?? []),
    pendingDocs: (r.documents ?? []).filter((d) => d.status === "pending" && !d.replaced_at).length,
    unread: (r.comments ?? []).filter((c) => c.author_type === "client" && !c.read_by_agency_at).length,
  }));
  if (status === "overdue") rows = rows.filter((r) => r.overdue);
  if (sp.review === "documents") rows = rows.filter((r) => r.pendingDocs > 0);

  return (
    <>
      <PageHeader
        title="Onboardings"
        description="Every onboarding link you've sent, and exactly where each client is."
        actions={<Button asChild><Link href="/requests/new"><Plus />New onboarding</Link></Button>}
      />
      <ListFilters filters={STATUS_FILTERS} placeholder="Search by client or company…" extra={sp.review === "documents" ? { label: "Files to review", clearKey: "review" } : undefined} />
      {rows.length === 0 ? (
        <EmptyState icon={Send} title={sp.q || status !== "all" ? "No matching onboardings" : "No onboardings yet"} description={sp.q || status !== "all" ? "Try a different search or filter." : "Create one from a template and send your client a single secure link."}
          action={!sp.q && status === "all" ? <Button asChild size="sm"><Link href="/requests/new"><Plus />New onboarding</Link></Button> : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,2fr)_120px_160px_110px_110px] gap-4 border-b bg-surface px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>Client</span><span>Status</span><span>Progress</span><span>Due</span><span className="text-right">Updated</span>
          </div>
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="grid gap-2 px-4 py-3 transition-colors hover:bg-accent/40 md:grid-cols-[minmax(0,2fr)_120px_160px_110px_110px] md:items-center md:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.client?.name} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{r.client?.name}</span>
                        {r.client?.company && <span className="hidden truncate text-[13px] text-muted-foreground sm:inline">· {r.client.company}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <span className="truncate">{r.title}</span>
                        {r.pendingDocs > 0 && <span className="flex shrink-0 items-center gap-0.5 text-warning"><FileCheck2 className="size-3.5" />{r.pendingDocs}</span>}
                        {r.unread > 0 && <span className="flex shrink-0 items-center gap-0.5 text-info"><MessageSquare className="size-3.5" />{r.unread}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:block"><RequestStatusBadge status={r.status} overdue={r.overdue} /></div>
                  <div className="flex items-center gap-2">
                    <Progress value={r.progress.percent} className="flex-1" indicatorClassName={r.status === "completed" ? "bg-success" : undefined} />
                    <span className="w-10 text-right text-xs text-muted-foreground tabular">{r.progress.done}/{r.progress.total}</span>
                  </div>
                  <span className={`text-[13px] ${r.overdue ? "text-destructive" : "text-muted-foreground"}`}>{r.due_date ? format(new Date(`${r.due_date}T12:00:00`), "MMM d") : "—"}</span>
                  <span className="hidden text-right text-[13px] text-muted-foreground md:block">{formatDistanceToNowStrict(new Date(r.updated_at), { addSuffix: true })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
