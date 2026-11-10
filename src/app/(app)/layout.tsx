import { requireWorkspace, displayName } from "@/lib/auth";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { workspace, workspaces, profile, user, role, supabase } = await requireWorkspace();
  const { count: unread } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .eq("author_type", "client")
    .is("read_by_agency_at", null);

  return (
    <AppShell
      workspace={{ id: workspace.id, name: workspace.name, logoUrl: workspace.logo_url, brandColor: workspace.brand_color, plan: workspace.plan }}
      workspaces={workspaces.map((w) => ({ id: w.id, name: w.name, logoUrl: w.logo_url, brandColor: w.brand_color }))}
      user={{ name: displayName(profile), email: user.email ?? "" }}
      role={role}
      unreadComments={unread ?? 0}
    >
      {children}
    </AppShell>
  );
}
