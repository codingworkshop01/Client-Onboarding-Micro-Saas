import Link from "next/link";
import { format } from "date-fns";
import { requireWorkspace, canAdmin } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InviteDialog, InviteRowActions, MemberRowActions } from "./team-controls";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const { supabase, workspace, role, user } = await requireWorkspace();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("workspace_members").select("user_id, role, created_at, profile:profiles(full_name, email)").eq("workspace_id", workspace.id).order("created_at"),
    supabase.from("workspace_invitations").select("id, email, role, expires_at, created_at").eq("workspace_id", workspace.id)
      .is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  const limit = PLANS[workspace.plan].members;
  const openInvites = (invites ?? []).filter((i) => new Date(i.expires_at) > new Date());
  const used = (members?.length ?? 0) + openInvites.length;
  const admin = canAdmin(role);

  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">Members</h2>
          <p className="text-[13px] text-muted-foreground">{used} of {limit} {limit === 1 ? "seat" : "seats"} used on the {PLANS[workspace.plan].name} plan (pending invitations count)</p>
          {admin && used >= limit && <p className="mt-1 text-[13px]">All seats are in use. <Link href="/settings/billing" className="font-medium underline-offset-4 hover:underline">Upgrade your plan</Link> to invite teammates.</p>}
        </div>
        {admin && <InviteDialog seatsFull={used >= limit} planName={PLANS[workspace.plan].name} />}
      </div>

      <Card className="divide-y">
        {(members ?? []).map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={m.profile?.full_name || m.profile?.email} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.profile?.full_name || m.profile?.email}{m.user_id === user.id && <span className="font-normal text-muted-foreground"> (you)</span>}</div>
              <div className="truncate text-[13px] text-muted-foreground">{m.profile?.email} · joined {format(new Date(m.created_at), "MMM yyyy")}</div>
            </div>
            {admin && m.role !== "owner" && m.user_id !== user.id
              ? <MemberRowActions userId={m.user_id} role={m.role} name={m.profile?.full_name || m.profile?.email || "this member"} />
              : <Badge variant={m.role === "owner" ? "info" : "outline"} className="capitalize">{m.role}</Badge>}
          </div>
        ))}
      </Card>

      {openInvites.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold">Pending invitations</h2>
          <Card className="divide-y">
            {openInvites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={i.email} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{i.email}</div>
                  <div className="text-[13px] text-muted-foreground"><span className="capitalize">{i.role}</span> · expires {format(new Date(i.expires_at), "MMM d")}</div>
                </div>
                {admin ? <InviteRowActions id={i.id} /> : <Badge variant="outline">Pending</Badge>}
              </div>
            ))}
          </Card>
        </section>
      )}

      <p className="text-[13px] text-muted-foreground">Owners and admins manage settings, billing, the team and deletions. Members create and run onboardings.</p>
    </div>
  );
}
