import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: sig } = await supabase.from("signatures").select("pdf_path, agreement_title, signer_name").eq("id", id).maybeSingle();
  if (!sig?.pdf_path) return new NextResponse("Not found", { status: 404 });
  const name = `${sig.agreement_title} - ${sig.signer_name} (signed).pdf`.replace(/[^\w\-(). ]+/g, "");
  const { data } = await supabase.storage.from("client-files").createSignedUrl(sig.pdf_path, 60, { download: name });
  if (!data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
