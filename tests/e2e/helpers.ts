import { expect, type Page } from "@playwright/test";

export async function signUpAgency(page: Page, opts: { name?: string; workspace?: string } = {}) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto("/signup");
  await page.fill("#fullName", opts.name ?? "Test Owner");
  await page.fill("#email", email);
  await page.fill("#password", "password123");
  await page.click("button[type=submit]");
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
