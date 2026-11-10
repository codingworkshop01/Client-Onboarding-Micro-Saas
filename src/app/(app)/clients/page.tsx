import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { Users } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { ListFilters } from "@/components/app/list-filters";
import { ClientDialog } from "./client-form";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const { supabase, workspace } = await requireWorkspace();
  let q = supabase.from("clients").select("id, name, email, company, created_at, archived_at, requests:onboarding_requests(status, updated_at)").eq("workspace_id", workspace.id).order("name").limit(500);
  q = sp.status === "archived" ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (sp.q?.trim()) {
    const like = `%${sp.q.trim().replace(/[%_\\,()*]/g, "")}%`;
    q = q.or(`name.ilike.${like},email.ilike.${like},company.ilike.${like}`);
  }
  const { data: clients } = await q;

  return (
    <>
      <PageHeader title="Clients" description="Everyone you've onboarded, with their answers, files, agreements and payments." actions={<ClientDialog />} />
      <ListFilters placeholder="Search clients…" filters={[{ value: "all", label: "Active" }, { value: "archived", label: "Archived" }]} />
      {!clients?.length ? (
        <EmptyState icon={Users} title={sp.q ? "No matching clients" : "No clients yet"} description={sp.q ? "Try another search." : "Clients are added automatically when you send an onboarding, or you can add them here."} />
      ) : (
        <Card className="divide-y overflow-hidden">
          {clients.map((c) => {
            const reqs = c.requests ?? [];
            const active = reqs.filter((r) => r.status === "sent" || r.status === "in_progress").length;
            const done = reqs.filter((r) => r.status === "completed").length;
            const last = reqs.map((r) => r.updated_at).sort().pop() ?? c.created_at;
            return (
              <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40">
                <Avatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.name}{c.company && <span className="font-normal text-muted-foreground"> · {c.company}</span>}</div>
                  <div className="truncate text-[13px] text-muted-foreground">{c.email}</div>
                </div>
                <div className="hidden gap-1.5 sm:flex">
                  {active > 0 && <Badge variant="warning">{active} active</Badge>}
                  {done > 0 && <Badge variant="success">{done} completed</Badge>}
                </div>
                <span className="hidden w-28 text-right text-[13px] text-muted-foreground md:block">{formatDistanceToNowStrict(new Date(last), { addSuffix: true })}</span>
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
