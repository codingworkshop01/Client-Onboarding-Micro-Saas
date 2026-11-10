import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/types";

type RequestStatus = Database["public"]["Enums"]["request_status"];

const REQUEST: Record<RequestStatus, { label: string; variant: "default" | "outline" | "success" | "warning" | "info" | "danger" }> = {
  draft: { label: "Draft", variant: "outline" },
  sent: { label: "Sent", variant: "info" },
  in_progress: { label: "In progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "default" },
};

export function RequestStatusBadge({ status, overdue }: { status: RequestStatus; overdue?: boolean }) {
  if (overdue) return <Badge variant="danger"><Dot />Overdue</Badge>;
  const s = REQUEST[status];
  return <Badge variant={s.variant}><Dot />{s.label}</Badge>;
}

function Dot() {
  return <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />;
}

export const REQUEST_STATUS_LABEL = Object.fromEntries(Object.entries(REQUEST).map(([k, v]) => [k, v.label])) as Record<RequestStatus, string>;
