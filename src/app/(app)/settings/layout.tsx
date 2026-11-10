import { PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Your workspace, brand, team, payments and plan." />
      <SettingsNav />
      <div className="mt-6">{children}</div>
    </>
  );
}
