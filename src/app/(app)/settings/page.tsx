import { requireWorkspace, canAdmin, displayName } from "@/lib/auth";
import { WorkspaceSettingsForm } from "./workspace-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { workspace, role, profile } = await requireWorkspace();
  return (
    <WorkspaceSettingsForm
      canEdit={canAdmin(role)}
      workspaceId={workspace.id}
      profileName={displayName(profile)}
      initial={{
        name: workspace.name, slug: workspace.slug, brandColor: workspace.brand_color, supportEmail: workspace.support_email ?? "",
        website: workspace.website ?? "", welcomeMessage: workspace.welcome_message ?? "", reminderIntervalDays: workspace.reminder_interval_days, maxReminders: workspace.max_reminders,
      }}
      logoUrl={workspace.logo_url}
    />
  );
}
