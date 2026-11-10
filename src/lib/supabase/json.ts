import type { Json } from "./types";

/** Cast a structured value for a JSONB column. Validate with Zod before calling. */
export const toJson = (value: unknown) => value as NonNullable<Json>;
