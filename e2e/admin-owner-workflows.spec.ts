import { expect, test } from "@playwright/test";

test.describe("organization admin workflows with development auth bypass", () => {
  test("dashboard onboarding and screen management entry points render", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Launch your first screen")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create screen" }).first(),
    ).toBeVisible();

    await page.goto("/dashboard/screens");
    await expect(
      page.getByRole("heading", { name: "Screens", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator("header").getByRole("button", { name: "Create screen" }),
    ).toBeVisible();
    await expect(page.getByLabel("Screen ID")).toBeVisible();
  });

  test("billing workflow surfaces monthly plan and refund status", async ({
    page,
  }) => {
    await page.goto("/dashboard/billing");
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Screen subscription" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    await expect(
      page.getByText("No refundable license additions yet."),
    ).toBeVisible();
  });

  test("core admin sections remain routable", async ({ page }) => {
    const sections = [
      ["/dashboard/media", "Media library"],
      ["/dashboard/team", "Team"],
      ["/dashboard/settings", "Settings"],
    ] as const;

    for (const [url, heading] of sections) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });
});

test.describe("platform owner workflows", () => {
  test("owner console is separate from the customer dashboard", async ({
    page,
  }) => {
    await page.goto("/owner");
    await expect(
      page.getByRole("link", { name: "DOOH Owner Console" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Organizations" }),
    ).toBeVisible();
    await expect(page.getByText("Estimated MRR")).toBeVisible();
    await expect(page.getByRole("link", { name: "Customer dashboard" })).toBeVisible();
  });
});
