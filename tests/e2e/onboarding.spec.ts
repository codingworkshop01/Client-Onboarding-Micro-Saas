import path from "node:path";
import { test, expect } from "@playwright/test";
import { createAndSendRequest, signUpAgency } from "./helpers";

test("agency sends an onboarding; client completes form, upload, access and signature; agency reviews", async ({ page, browser }) => {
  await signUpAgency(page);
  const link = await createAndSendRequest(page);

  const client = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await client.goto(link);
  await expect(client.getByText("0 of 5 complete")).toBeVisible();

  // Form step with conditional logic
  await client.getByText("About your business & website").click();
  await client.locator('input[id^="q-"]').first().fill("Acme");
  await expect(client.locator("input[type=url]")).toHaveCount(0);
  await client.locator("label", { hasText: "Yes" }).click();
  await expect(client.locator("input[type=url]")).toHaveCount(1);
  await client.locator("input[type=url]").fill("acme.example");
  const areas = client.locator("textarea");
  for (let i = 0; i < (await areas.count()); i++) await areas.nth(i).fill("A detailed and specific answer.");
  await client.getByRole("button", { name: "Continue" }).click();

  // Files step
  await expect(client.getByRole("heading", { name: "Brand assets & content" })).toBeVisible();
  await client.locator("input[type=file]").first().setInputFiles(path.join(__dirname, "../fixtures/logo.png"));
  await expect(client.getByText("logo.png")).toBeVisible({ timeout: 15_000 });
  await client.getByRole("button", { name: "Continue" }).click();

  // Access step: confirm every platform
  await expect(client.getByText("Never share your password")).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const box = client.locator('button[role=checkbox][data-state="unchecked"]').first();
    if (!(await box.count())) break;
    await box.click();
    await client.waitForTimeout(600);
  }
  await client.getByRole("button", { name: "Continue" }).click();

  // Agreement
  await expect(client.getByText("Full legal name")).toBeVisible();
  await client.locator('button[role=checkbox]').click();
  await client.getByRole("button", { name: "Sign agreement" }).click();
  await expect(client.getByText("Online payment isn't available")).toBeVisible({ timeout: 15_000 });

  // Agency sees everything
  await page.getByRole("button", { name: "View onboarding" }).click();
  await page.waitForURL(/\/requests\/[0-9a-f-]{36}/);
  await page.reload();
  await expect(page.getByText("4 of 5 steps complete")).toBeVisible();
  await expect(page.getByText("logo.png")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("approved", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();

  // Offline payment completes the onboarding
  await page.getByRole("button", { name: "Record offline payment" }).click();
  await page.getByRole("button", { name: "Mark as paid" }).click();
  await expect(page.getByText("5 of 5 steps complete")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
});

test("template builder: add a step and save", async ({ page }) => {
  await signUpAgency(page);
  await page.goto("/templates");
  await page.getByRole("heading", { name: "Web Design Agency" }).click();
  await page.waitForURL(/\/templates\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByRole("menuitem", { name: /File uploads/ }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Steps (6)")).toBeVisible();
});
