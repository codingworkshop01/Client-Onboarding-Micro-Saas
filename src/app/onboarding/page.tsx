import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/app/logo";
import { STARTER_TEMPLATES } from "@/lib/flows/starters";
import { WorkspaceForm } from "./workspace-form";

export const metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { count } = await supabase.from("workspace_members").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  const hasWorkspace = (count ?? 0) > 0;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="flex h-14 items-center justify-between px-5 sm:px-8">
        <Logo />
        <form action="/auth/signout" method="post"><button className="text-sm text-muted-foreground hover:text-foreground">Sign out</button></form>
      </header>
      <main className="mx-auto max-w-xl px-5 pt-8 pb-16 sm:pt-16">
        <p className="text-sm font-medium text-muted-foreground">Step 1 of 1</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set up your workspace</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">This is what your clients will see on their onboarding page. You can change it anytime.</p>
        <div className="mt-8 rounded-xl border bg-card p-5 shadow-card sm:p-6">
          <WorkspaceForm starters={STARTER_TEMPLATES.map((s) => ({ key: s.key, name: s.name }))} />
        </div>
        {hasWorkspace && <p className="mt-4 text-center text-sm"><a href="/dashboard" className="text-muted-foreground hover:text-foreground">Back to dashboard</a></p>}
      </main>
    </div>
  );
}
