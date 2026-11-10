import { createClient } from "@supabase/supabase-js";

/** Local test runs sign up many accounts from one IP; reset the rate-limit counters first. */
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/127\.0\.0\.1|localhost|\.test(\/|:|$)/.test(url)) return;
  const db = createClient(url, key, { auth: { persistSession: false } });
  await db.from("rate_limits").delete().neq("key", "");
}
