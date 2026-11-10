import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { resetSignupLimit, signUpAgency } from "./helpers";

test("owner invites a teammate who signs up, joins, gets promoted, then is removed", async ({ page, browser }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  test.skip(!serviceKey, "SUPABASE_SERVICE_ROLE_KEY not set");

  const workspaceName = `Team Studio ${Date.now().toString(36)}`;
  const owner = await signUpAgency(page, { workspace: workspaceName });

  // Free plan has one seat: the invite button is disabled.
  await page.goto("/settings/team");
  await expect(page.getByRole("button", { name: "Invite teammate" })).toBeDisabled();

  // Upgrade this test workspace to Agency (5 seats) directly in the local DB.
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: user } = await db.from("profiles").select("current_workspace_id").eq("email", owner.email).single();
  await db.from("workspaces").update({ plan: "agency" }).eq("id", user!.current_workspace_id!);

  const mateEmail = `mate-${Date.now()}@example.com`;
  await page.reload();
  await page.getByRole("button", { name: "Invite teammate" }).click();
  await page.fill("#inv-email", mateEmail);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Invitation created")).toBeVisible();
  const link = await page.locator("input[readonly]").inputValue();
  expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{40,}/);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pending invitations" })).toBeVisible();

  // Teammate opens the link, creates an account, and accepts.
  const mate = await (await browser.newContext()).newPage();
  await mate.goto(link);
  await expect(mate.getByRole("heading", { name: `Join ${workspaceName}` })).toBeVisible();
  await resetSignupLimit();
  await mate.getByRole("link", { name: "Create an account" }).click();
  await expect(mate.locator("#email")).toHaveValue(mateEmail);
  await mate.fill("#fullName", "Taylor Mate");
  await mate.fill("#password", "password123");
  await mate.click("button[type=submit]");
  await mate.waitForURL("**/invite/**");
  await mate.getByRole("button", { name: "Accept invitation" }).click();
  await mate.waitForURL("**/dashboard**");
  await expect(mate.getByText(workspaceName).first()).toBeVisible();

  // Members can't manage the team.
  await mate.goto("/settings/team");
  await expect(mate.getByRole("button", { name: "Invite teammate" })).toHaveCount(0);

  // The link can't be reused.
  await mate.goto(link);
  await expect(mate.getByText("already been accepted")).toBeVisible();

  // Owner promotes, then removes the teammate.
  await page.reload();
  await expect(page.getByText("Taylor Mate")).toBeVisible();
  await page.getByRole("combobox", { name: "Role for Taylor Mate" }).click();
  await page.getByRole("option", { name: "Admin" }).click();
  await expect(page.getByText("Role updated")).toBeVisible();
  await page.getByRole("button", { name: "More for Taylor Mate" }).click();
  await page.getByRole("menuitem", { name: "Remove from workspace" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByText("Member removed")).toBeVisible();

  // Removed teammate no longer reaches the workspace.
  await mate.goto("/dashboard");
  await mate.waitForURL("**/onboarding");
});

test("an invite only works for the invited email", async ({ page, browser }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  test.skip(!serviceKey, "SUPABASE_SERVICE_ROLE_KEY not set");
  const owner = await signUpAgency(page);
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: p } = await db.from("profiles").select("current_workspace_id").eq("email", owner.email).single();
  await db.from("workspaces").update({ plan: "agency" }).eq("id", p!.current_workspace_id!);

  await page.goto("/settings/team");
  await page.getByRole("button", { name: "Invite teammate" }).click();
  await page.fill("#inv-email", `invited-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Send invitation" }).click();
  const link = await page.locator("input[readonly]").inputValue();

  // Someone else, signed in with a different email, can't accept it.
  const other = await (await browser.newContext()).newPage();
  await signUpAgency(other);
  await other.goto(link);
  await other.getByRole("button", { name: "Accept invitation" }).click();
  await expect(other.getByText(/This invitation was sent to/)).toBeVisible();
});
