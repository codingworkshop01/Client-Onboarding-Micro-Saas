import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Client IP for rate limiting. Prefer X-Real-IP, which the reverse proxy
 * (Traefik / Nginx Proxy Manager / Vercel) sets itself. The first
 * X-Forwarded-For entry can be supplied by the client, so it's only a
 * fallback; we take the entry nearest the proxy (the last one) instead.
 */
export async function clientIp() {
  const h = await headers();
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) || "unknown";
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
