import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { rowToStep } from "@/lib/requests";
import { visibleFields } from "@/lib/flows/logic";
import type { AnswerValue } from "@/lib/flows/schema";

const safe = (s: string) => s.replace(/[^\w\-. ]+/g, "_").trim().slice(0, 80) || "file";
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`.replace(/^"([=+\-@])/, `"'$1`); // block CSV formula injection

/** Export a request: ?format=csv (answers) or ?format=zip (answers + all files + signed PDFs). RLS-scoped. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "zip";
  const supabase = await createClient();
  const { data: r } = await supabase.from("onboarding_requests").select("title, client:clients(name, company)").eq("id", id).maybeSingle();
  if (!r) return new NextResponse("Not found", { status: 404 });
  const [{ data: steps }, { data: docs }, { data: sigs }] = await Promise.all([
    supabase.from("request_steps").select("*").eq("request_id", id).order("position"),
    supabase.from("documents").select("*").eq("request_id", id).is("replaced_at", null),
    supabase.from("signatures").select("*").eq("request_id", id),
  ]);

  const rows: string[][] = [["Step", "Question", "Answer"]];
  for (const row of steps ?? []) {
    const step = rowToStep(row);
    if (step.type !== "form") continue;
    const answers = ((row.data as { answers?: Record<string, AnswerValue> })?.answers ?? {});
    for (const f of visibleFields(step.config.fields, answers)) {
      if (f.type === "file") continue;
      const v = answers[f.id];
      const label = (x: string) => f.options?.find((o) => o.id === x)?.label ?? x;
      rows.push([row.title, f.label, Array.isArray(v) ? v.map((x) => label(String(x))).join("; ") : v == null ? "" : label(String(v))]);
    }
  }
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const base = safe(`${r.client?.company || r.client?.name || "client"} - ${r.title}`);

  if (format === "csv") {
    return new NextResponse(`﻿${csv}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}.csv"` } });
  }

  const zip = new JSZip();
  zip.file("answers.csv", `﻿${csv}`);
  const stepTitle = new Map((steps ?? []).map((s) => [s.id, `${String(s.position + 1).padStart(2, "0")} ${safe(s.title)}`]));
  for (const d of docs ?? []) {
    const { data: blob } = await supabase.storage.from("client-files").download(d.storage_path);
    if (blob) zip.file(`${stepTitle.get(d.step_id) ?? "files"}/${d.status === "rejected" ? "rejected - " : ""}${safe(d.file_name)}`, await blob.arrayBuffer());
  }
  for (const s of sigs ?? []) {
    if (!s.pdf_path) continue;
    const { data: blob } = await supabase.storage.from("client-files").download(s.pdf_path);
    if (blob) zip.file(`signed/${safe(s.agreement_title)} (signed).pdf`, await blob.arrayBuffer());
  }
  const buf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return new NextResponse(Buffer.from(buf), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${base}.zip"` } });
}
