import { GET as healthz } from "@/app/healthz/route";

// Kept for existing monitors; same check as /healthz.
export const dynamic = "force-dynamic";
export const GET = healthz;
