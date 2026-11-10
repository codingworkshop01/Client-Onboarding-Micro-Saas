import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes, URL-safe. Only the SHA-256 hash is ever stored. */
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sha256(input: string | Uint8Array) {
  return createHash("sha256").update(input).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const MAGIC_LINK_TTL_DAYS = 60;
