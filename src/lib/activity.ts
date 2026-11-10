import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toJson } from "@/lib/supabase/json";

type Actor = Database["public"]["Enums"]["actor_type"];

export async function logActivity(input: {
  workspaceId: string;
  requestId?: string | null;
  clientId?: string | null;
  actorType: Actor;
  actorId?: string | null;
  actorName?: string | null;
  type: string;
  payload?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("activity_events").insert({
    workspace_id: input.workspaceId,
    request_id: input.requestId ?? null,
    client_id: input.clientId ?? null,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    type: input.type,
    payload: toJson(input.payload ?? {}),
  });
  if (error) console.error("activity log failed", error.message);
}

/** Audit trail for sensitive actions (signing, approvals, link revocation...). */
export async function audit(input: {
  workspaceId: string | null;
  actorType: Actor;
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    workspace_id: input.workspaceId,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    ip_address: input.ip ?? null,
    metadata: toJson(input.metadata ?? {}),
  });
  if (error) console.error("audit log failed", error.message);
}
