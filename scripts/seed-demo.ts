/**
 * DEMO DATA ONLY. Creates a demo account with sample clients and onboardings
 * so you can explore the product locally. Never run against production.
 *
 *   pnpm seed:demo
 *
 * Login: demo@example.com / demo-password-123
 */
import { createClient } from "@supabase/supabase-js";
import { STARTER_TEMPLATES } from "../src/lib/flows/starters";
import { cloneStep } from "../src/lib/flows/logic";
import type { Database } from "../src/lib/supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url) && process.env.ALLOW_DEMO_SEED !== "1") {
  console.error("Refusing to seed demo data into a non-local database. Set ALLOW_DEMO_SEED=1 to override.");
  process.exit(1);
}
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const EMAIL = "demo@example.com";
const PASSWORD = "demo-password-123";

async function main() {
  const { data: list } = await db.auth.admin.listUsers();
  const old = list.users.find((u) => u.email === EMAIL);
  if (old) {
    const { data: ws } = await db.from("workspace_members").select("workspace_id").eq("user_id", old.id);
    for (const w of ws ?? []) await db.from("workspaces").delete().eq("id", w.workspace_id);
    await db.auth.admin.deleteUser(old.id);
  }
  const { data: created, error } = await db.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Demo Owner" } });
  if (error) throw error;
  const userId = created.user.id;

  const { data: ws, error: wsErr } = await db.from("workspaces").insert({
    name: "Demo Studio", slug: `demo-studio-${Date.now().toString(36)}`, brand_color: "#0f766e", created_by: userId,
    welcome_message: "This is demo data. Explore freely.", support_email: "hello@demo-studio.example",
  }).select("id").single();
  if (wsErr) throw wsErr;
  await db.from("workspace_members").insert({ workspace_id: ws.id, user_id: userId, role: "owner" });
  await db.from("profiles").update({ current_workspace_id: ws.id }).eq("id", userId);

  const templates: Record<string, string> = {};
  for (const key of ["web-design", "seo", "social-media", "general"]) {
    const s = STARTER_TEMPLATES.find((t) => t.key === key)!;
    const { data } = await db.from("flow_templates").insert({ workspace_id: ws.id, name: s.name, description: s.description, category: s.category, source: "starter", steps: s.steps.map(cloneStep) as never, created_by: userId }).select("id, steps").single();
    templates[key] = data!.id;
  }
  const agreement = STARTER_TEMPLATES[0]!.steps.find((s) => s.type === "agreement");
  if (agreement?.type === "agreement") await db.from("agreement_templates").insert({ workspace_id: ws.id, name: "Standard Website Agreement", body: agreement.config.body, created_by: userId });

  const people = [
    { name: "Maya Patel", email: "maya@bloombakery.example", company: "Bloom Bakery", tpl: "web-design", status: "in_progress", progress: 2, dueIn: 5 },
    { name: "Tom Becker", email: "tom@northpeak.example", company: "Northpeak Outdoors", tpl: "seo", status: "completed", progress: 99, dueIn: -3 },
    { name: "Lena Ortiz", email: "lena@ortizlaw.example", company: "Ortiz Law", tpl: "social-media", status: "sent", progress: 0, dueIn: -2 },
    { name: "Sam Okafor", email: "sam@kiln.example", company: "Kiln Coffee", tpl: "general", status: "draft", progress: 0, dueIn: 10 },
  ] as const;

  for (const p of people) {
    const { data: client } = await db.from("clients").insert({ workspace_id: ws.id, name: p.name, email: p.email, company: p.company, created_by: userId }).select("id").single();
    const { data: tpl } = await db.from("flow_templates").select("name, steps").eq("id", templates[p.tpl]!).single();
    const steps = tpl!.steps as unknown as { id: string; type: "form" | "files" | "access" | "agreement" | "payment"; title: string; description?: string; required: boolean; config: unknown }[];
    const sentAt = new Date(Date.now() - 6 * 86_400_000).toISOString();
    const due = new Date(Date.now() + p.dueIn * 86_400_000).toISOString().slice(0, 10);
    const { data: req } = await db.from("onboarding_requests").insert({
      workspace_id: ws.id, client_id: client!.id, template_id: templates[p.tpl], title: `${p.company} onboarding`,
      status: p.status, sent_at: p.status === "draft" ? null : sentAt, due_date: due, created_by: userId,
      completed_at: p.status === "completed" ? new Date().toISOString() : null,
    }).select("id").single();
    await db.from("request_steps").insert(steps.map((s, i) => {
      const done = i < p.progress && s.type !== "payment" && s.type !== "agreement" && s.type !== "files";
      return {
        workspace_id: ws.id, request_id: req!.id, position: i, type: s.type, title: s.title, description: s.description ?? null,
        // Completed demo requests have every step marked complete; partial ones only forms/access.
        required: p.status === "completed" ? false : s.required, config: s.config as never,
        status: (p.status === "completed" || done ? "completed" : "not_started") as "completed" | "not_started",
        data: { submitted_at: done || p.status === "completed" ? sentAt : undefined, skipped: p.status === "completed" && (s.type === "payment" || s.type === "agreement" || s.type === "files") ? true : undefined } as never,
      };
    }));
    await db.from("activity_events").insert({ workspace_id: ws.id, request_id: req!.id, client_id: client!.id, actor_type: "member", actor_id: userId, actor_name: "Demo Owner", type: p.status === "draft" ? "request.created" : "request.sent", payload: { title: `${p.company} onboarding`, client: p.name } });
  }
  console.log(`Demo data ready. Sign in at /login with ${EMAIL} / ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
