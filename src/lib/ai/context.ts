import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { rowToStep } from "@/lib/requests";
import { visibleFields } from "@/lib/flows/logic";
import { ACCESS_PLATFORM_GUIDES } from "@/lib/flows/access-platforms";
import type { AnswerValue } from "@/lib/flows/schema";
import { formatMoney } from "@/lib/utils";
import type { QA } from "./index";

/** Flatten a request's submissions into Q&A + status lines for AI prompts (RLS-scoped client). */
export async function buildRequestContext(supabase: SupabaseClient<Database>, requestId: string) {
  const [{ data: steps }, { data: docs }, { data: sigs }, { data: pays }] = await Promise.all([
    supabase.from("request_steps").select("*").eq("request_id", requestId).order("position"),
    supabase.from("documents").select("step_id, item_key, file_name, status, replaced_at").eq("request_id", requestId),
    supabase.from("signatures").select("step_id, signer_name, signed_at").eq("request_id", requestId),
    supabase.from("payments").select("step_id, status, amount_cents, currency").eq("request_id", requestId),
  ]);
  const qa: QA[] = [];
  const extras: string[] = [];
  const remaining: string[] = [];
  for (const row of steps ?? []) {
    const step = rowToStep(row);
    if (row.status !== "completed" && row.required) remaining.push(row.title);
    const data = (row.data ?? {}) as { answers?: Record<string, AnswerValue>; confirmations?: Record<string, { confirmed: boolean }> };
    if (step.type === "form") {
      const answers = data.answers ?? {};
      for (const f of visibleFields(step.config.fields, answers)) {
        if (f.type === "file") continue;
        const v = answers[f.id];
        const label = (x: string) => f.options?.find((o) => o.id === x)?.label ?? x;
        const answer = Array.isArray(v) ? v.map((x) => label(String(x))).join(", ") : v == null ? "" : label(String(v));
        qa.push({ step: step.title, question: f.label, answer: answer.slice(0, 2000) });
      }
    }
    if (step.type === "files") {
      for (const item of step.config.items) {
        const files = (docs ?? []).filter((d) => d.step_id === row.id && d.item_key === item.id && !d.replaced_at);
        extras.push(`Document "${item.label}": ${files.length ? files.map((f) => `${f.file_name} (${f.status})`).join(", ") : "not uploaded"}`);
      }
    }
    if (step.type === "access") {
      for (const item of step.config.items) extras.push(`Access ${item.label || ACCESS_PLATFORM_GUIDES[item.platform].name}: ${data.confirmations?.[item.id]?.confirmed ? "granted" : "pending"}`);
    }
    if (step.type === "agreement") {
      const s = (sigs ?? []).find((x) => x.step_id === row.id);
      extras.push(`Agreement "${step.config.agreementTitle}": ${s ? `signed by ${s.signer_name}` : "not signed"}`);
    }
    if (step.type === "payment") {
      const p = (pays ?? []).find((x) => x.step_id === row.id);
      extras.push(`Payment ${formatMoney(step.config.amountCents, step.config.currency)}: ${p?.status ?? "unpaid"}`);
    }
  }
  return { qa, extras, remaining };
}
