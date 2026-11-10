import { NextResponse } from "next/server";
import { resolveToken } from "@/lib/portal";
import { createAdminClient } from "@/lib/supabase/admin";

/** Client downloads their own signed agreement (token-scoped). */
export async function GET(_: Request, { params }: { params: Promise<{ token: string; stepId: string }> }) {
  const { token, stepId } = await params;
  const access = await resolveToken(token);
  if (!access.ok) return new NextResponse("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data: sig } = await admin.from("signatures").select("pdf_path, agreement_title").eq("step_id", stepId).eq("request_id", access.requestId).maybeSingle();
  if (!sig?.pdf_path) return new NextResponse("Not found", { status: 404 });
  const { data } = await admin.storage.from("client-files").createSignedUrl(sig.pdf_path, 60, { download: `${sig.agreement_title.replace(/[^\w\- ]+/g, "")} (signed).pdf` });
  if (!data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
