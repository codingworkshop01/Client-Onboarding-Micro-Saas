import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window rate limiter backed by Postgres (works across serverless
 * instances without extra infrastructure). Returns true when allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return true; // fail open so an outage of the limiter doesn't lock users out
  }
  return data === true;
}
