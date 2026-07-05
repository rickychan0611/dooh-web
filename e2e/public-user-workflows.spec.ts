import { expect, test } from "@playwright/test";

test.describe("public user workflows", () => {
  test("marketing, pricing, and public account entry points render", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /Turn any TV into digital signage/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Start/i }).first()).toBeVisible();

    await page.goto("/pricing");
    await expect(
      page.getByRole("heading", { name: /One monthly plan/i }),
    ).toBeVisible();
    await expect(page.getByText("$9/month includes up to 3 screens")).toBeVisible();
    await expect(page.getByText("$3/month", { exact: false })).toBeVisible();

    await page.goto("/account/login?next=/screens/LOBBY/posts");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();

    await page.goto("/account/signup?next=/account/profile");
    await expect(
      page.getByRole("heading", { name: "Create account" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Already have/i })).toBeVisible();

    await page.goto("/account/forgot-password");
    await expect(
      page.getByRole("heading", { name: "Reset password" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send reset link" }),
    ).toBeVisible();
  });

  test("public screen directory stays reachable for mobile visitors", async ({
    page,
  }) => {
    await page.goto("/screens");
    await expect(
      page.getByRole("heading", { name: "Choose a community screen" }),
    ).toBeVisible();
    await expect(page.getByText(/Browse active community posts/i)).toBeVisible();
  });
});
