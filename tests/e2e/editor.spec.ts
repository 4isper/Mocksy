import { expect, test } from "@playwright/test";

test("shows editor shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Templates")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
});
