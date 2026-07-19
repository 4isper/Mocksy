import { expect, test } from "@playwright/test";

test("shows editor shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Templates")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
});

test("selecting iphone16pro renders the device overlay", async ({ page }) => {
  await page.goto("/");
  const frameSelect = page.locator("select").first();
  await frameSelect.selectOption("iphone16pro");
  await expect(page.locator('img[src*="iphone16pro.svg"]')).toBeVisible();
});

test("templates include the 16 Pro Glass preset", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "16 Pro Glass" })).toBeVisible();
});

