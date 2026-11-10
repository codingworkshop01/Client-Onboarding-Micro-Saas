import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

/**
 * OAuth/PKCE code exchange for email confirmation and password reset links.
 * Redirects are built from the public app URL, not request.url: behind a
 * reverse proxy request.url is the container's internal address.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${env.appUrl}${next}`);
  }
  return NextResponse.redirect(`${env.appUrl}/login?error=link_expired`);
}
