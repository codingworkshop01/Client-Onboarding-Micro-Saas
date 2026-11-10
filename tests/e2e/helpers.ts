import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/** The suite creates many accounts from one IP; clear the local sign-up rate-limit counter first. */
export async function resetSignupLimit() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/127\.0\.0\.1|localhost|\.test(\/|:|$)/.test(url)) return;
  await createClient(url, key, { auth: { persistSession: false } }).from("rate_limits").delete().like("key", "signup:%");
}

export async function signUpAgency(page: Page, opts: { name?: string; workspace?: string } = {}) {
  await resetSignupLimit();
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto("/signup");
  await page.fill("#fullName", opts.name ?? "Test Owner");
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click("button[type=submit]");
  await confirmEmailIfRequired(page, email);
  await page.waitForURL("**/onboarding");
  await page.fill("#name", opts.workspace ?? `Studio ${Date.now().toString(36)}`);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard**");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
  return { email, password: "password123" };
}

export async function createAndSendRequest(page: Page, client = { name: "Jordan Lee", email: `jordan-${Date.now()}@acme.example`, company: "Acme" }) {
  await page.goto("/requests/new");
  const newClient = page.getByRole("button", { name: "New client" });
  if (await newClient.count()) await newClient.click();
  await page.fill("#newName", client.name);
  await page.fill("#newEmail", client.email);
  await page.fill("#newCompany", client.company);
  await page.getByRole("button", { name: "Create & send" }).click();
  await expect(page.getByText("Onboarding is live")).toBeVisible({ timeout: 20_000 });
  const link = await page.locator("input[readonly]").inputValue();
  expect(link).toMatch(/\/p\/[A-Za-z0-9_-]{40,}/);
  return link;
}

/**
 * When the server requires email confirmation (production settings), open the
 * confirmation link from the test inbox (Mailpit API at E2E_MAILPIT_URL).
 */
export async function confirmEmailIfRequired(page: Page, email: string) {
  const inbox = page.getByText("Check your inbox");
  const needsConfirm = await Promise.race([
    page.waitForURL("**/onboarding", { timeout: 15_000 }).then(() => false),
    inbox.waitFor({ timeout: 15_000 }).then(() => true),
  ]).catch(() => false);
  if (!needsConfirm) return;
  const mailpit = process.env.E2E_MAILPIT_URL;
  if (!mailpit) throw new Error("Server requires email confirmation; set E2E_MAILPIT_URL to read the test inbox");
  let link: string | undefined;
  for (let i = 0; i < 30 && !link; i++) {
    const list = await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${mailpit}/api/v1/message/${list.messages[0].ID}`)).json();
      link = (msg.HTML as string).match(/href="([^"]+\/verify[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
    }
    if (!link) await new Promise((r) => setTimeout(r, 500));
  }
  if (!link) throw new Error(`No confirmation email for ${email}`);
  await page.goto(link);
}
