import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Agency file access: RLS on documents + storage decides; short-lived signed URL. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const download = request.nextUrl.searchParams.has("download") ? doc.file_name : undefined;
  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(doc.storage_path, 60, download ? { download } : undefined);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
