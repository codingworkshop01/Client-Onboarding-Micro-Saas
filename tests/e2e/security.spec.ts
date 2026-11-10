import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createAndSendRequest, signUpAgency } from "./helpers";

test("protected pages redirect to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test("invalid and revoked portal links are rejected", async ({ page }) => {
  await page.goto("/p/not-a-real-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  await expect(page.getByText("This link isn't valid")).toBeVisible();

  await signUpAgency(page);
  const link = await createAndSendRequest(page);
  await page.getByRole("button", { name: "View onboarding" }).click();
  await page.waitForURL(/\/requests\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Revoke all client links" }).click();
  await page.getByRole("button", { name: "Revoke links" }).click();
  await page.waitForTimeout(1000);
  await page.goto(link);
  await expect(page.getByText("This link is no longer active")).toBeVisible();
});

test("row level security isolates workspaces", async ({ browser }) => {
  const a = await browser.newPage();
  const ownerA = await signUpAgency(a);
  await createAndSendRequest(a);
  const b = await browser.newPage();
  const ownerB = await signUpAgency(b);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  test.skip(!anon, "NEXT_PUBLIC_SUPABASE_ANON_KEY not set");

  const asA = createClient(url, anon, { auth: { persistSession: false } });
  await asA.auth.signInWithPassword(ownerA);
  const { data: aRequests } = await asA.from("onboarding_requests").select("id");
  expect(aRequests?.length).toBe(1);

  const asB = createClient(url, anon, { auth: { persistSession: false } });
  await asB.auth.signInWithPassword(ownerB);
  const { data: bRequests } = await asB.from("onboarding_requests").select("id");
  expect(bRequests).toEqual([]);
  const { data: bClients } = await asB.from("clients").select("id");
  expect(bClients).toEqual([]);
  // B cannot read A's request even by id, nor forge a signature or payment
  const { data: direct } = await asB.from("onboarding_requests").select("id").eq("id", aRequests![0]!.id);
  expect(direct).toEqual([]);
  const { error: sigErr } = await asB.from("signatures").insert({ workspace_id: "00000000-0000-0000-0000-000000000000" } as never);
  expect(sigErr).not.toBeNull();
  // Anonymous users can't read anything
  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: anonRows } = await anonClient.from("clients").select("id");
  expect(anonRows ?? []).toEqual([]);
});
