import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The git commit this image was built from (set at build time). */
export function GET() {
  return NextResponse.json({ revision: process.env.APP_REVISION ?? "unknown" }, { headers: { "cache-control": "no-store" } });
}
