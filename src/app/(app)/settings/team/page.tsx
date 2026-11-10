import { format } from "date-fns";
import { requireWorkspace } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { supabase, workspace } = await requireWorkspace();
  const { data: members } = await supabase.from("workspace_members").select("role, created_at, profile:profiles(full_name, email)").eq("workspace_id", workspace.id).order("created_at");
  const limit = PLANS[workspace.plan].members;
  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div><h2 className="text-[15px] font-semibold">Members</h2><p className="text-[13px] text-muted-foreground">{members?.length ?? 0} of {limit} seats on the {PLANS[workspace.plan].name} plan</p></div>
      </div>
      <Card className="divide-y">
        {(members ?? []).map((m, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.profile?.full_name || m.profile?.email} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{m.profile?.full_name || m.profile?.email}</div><div className="truncate text-[13px] text-muted-foreground">{m.profile?.email} · joined {format(new Date(m.created_at), "MMM yyyy")}</div></div>
            <Badge variant={m.role === "owner" ? "info" : "outline"} className="capitalize">{m.role}</Badge>
          </div>
        ))}
      </Card>
      <p className="mt-4 text-[13px] text-muted-foreground">Team invitations, roles and assignments are coming next. Roles are already enforced: owners and admins manage settings, billing and deletions; members run onboardings.</p>
    </div>
  );
}
