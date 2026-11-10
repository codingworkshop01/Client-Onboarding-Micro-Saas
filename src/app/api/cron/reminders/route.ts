import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/tokens";
import { sendReminder } from "@/lib/email/send";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * Sends due automatic reminders. Call hourly (vercel.json cron, Supabase
 * pg_cron + pg_net, or any scheduler) with `Authorization: Bearer $CRON_SECRET`.
 * Reminders stop when the request completes, is cancelled, or hits max.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: due } = await admin
    .from("onboarding_requests")
    .select("id, workspace_id, client_id, reminders_sent, max_reminders, reminder_interval_days, client:clients(email)")
    .eq("reminders_enabled", true)
    .in("status", ["sent", "in_progress"])
    .lte("next_reminder_at", new Date().toISOString())
    .limit(100);

  const results = { checked: due?.length ?? 0, sent: 0, skipped: 0, failed: 0 };
  for (const r of due ?? []) {
    if (r.reminders_sent >= r.max_reminders) {
      await admin.from("onboarding_requests").update({ next_reminder_at: null }).eq("id", r.id);
      continue;
    }
    // Claim the slot first so overlapping runs don't double-send.
    const next = r.reminders_sent + 1 < r.max_reminders ? new Date(Date.now() + r.reminder_interval_days * 86_400_000).toISOString() : null;
    const { data: claimed } = await admin.from("onboarding_requests")
      .update({ reminders_sent: r.reminders_sent + 1, next_reminder_at: next })
      .eq("id", r.id).eq("reminders_sent", r.reminders_sent).select("id");
    if (!claimed?.length) continue;
    const res = await sendReminder(r.id, { manual: false });
    results[res.status === "sent" ? "sent" : res.status === "skipped" ? "skipped" : "failed"]++;
    if (res.status === "sent") await logActivity({ workspaceId: r.workspace_id, requestId: r.id, clientId: r.client_id, actorType: "system", type: "reminder.sent", payload: { recipient: r.client?.email } });
  }
  return NextResponse.json(results);
}
