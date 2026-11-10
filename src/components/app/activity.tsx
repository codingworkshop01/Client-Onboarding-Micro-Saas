import type { Database } from "@/lib/supabase/types";

type Event = Database["public"]["Tables"]["activity_events"]["Row"];

/** Human-readable sentence for an activity event. */
export function describeActivity(e: Pick<Event, "type" | "actor_name" | "payload" | "actor_type">) {
  const who = e.actor_name || (e.actor_type === "system" ? "System" : "Someone");
  const p = (e.payload ?? {}) as Record<string, string | number | undefined>;
  switch (e.type) {
    case "request.created": return `${who} created "${p.title}"`;
    case "request.sent": return `${who} sent "${p.title}" to ${p.client ?? "the client"}`;
    case "request.opened": return `${who} opened their onboarding link`;
    case "request.completed": return `"${p.title}" was completed`;
    case "request.cancelled": return `${who} cancelled "${p.title}"`;
    case "request.reopened": return `${who} reopened "${p.title}"`;
    case "step.submitted": return `${who} completed "${p.step}"`;
    case "step.skipped": return `${who} skipped "${p.step}"`;
    case "step.reopened": return `${who} reopened "${p.step}"`;
    case "document.uploaded": return `${who} uploaded ${p.file}`;
    case "document.approved": return `${who} approved ${p.file}`;
    case "document.rejected": return `${who} requested a re-upload of ${p.file}`;
    case "access.confirmed": return `${who} confirmed access to ${p.platform}`;
    case "agreement.signed": return `${who} signed "${p.agreement}"`;
    case "payment.paid": return `${who} paid ${p.amount}`;
    case "payment.recorded": return `${who} recorded an offline payment of ${p.amount}`;
    case "payment.failed": return `A payment by ${who} failed`;
    case "comment.created": return `${who} commented: “${String(p.preview ?? "").slice(0, 80)}”`;
    case "reminder.sent": return `Reminder sent to ${p.recipient}`;
    case "link.revoked": return `${who} revoked the client's links`;
    case "client.created": return `${who} added client ${p.name}`;
    default: return `${who}: ${e.type}`;
  }
}
