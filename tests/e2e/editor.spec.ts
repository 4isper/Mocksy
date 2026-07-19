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

test("uploading media reveals a Clear button that resets it", async ({ page }) => {
  await page.goto("/");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
  const clear = page.getByRole("button", { name: "Clear media" });
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(0);
  await expect(page.getByText("Drop image or video to start")).toBeVisible();
});

test("exporting an image scene triggers a PNG download", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/mocksy-export\.png$/);
});

test("autosaves the scene and restores it after reload", async ({ page }) => {
  await page.goto("/");
  await page.locator("select").first().selectOption("tablet");
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.locator("select").first()).toHaveValue("tablet");
});

test("watch frame renders as a circle", async ({ page }) => {
  await page.goto("/");
  const frameSelect = page.locator("select").first();
  await expect(frameSelect.locator("option", { hasText: "watch" })).toHaveCount(1);
  await frameSelect.selectOption("watch");
  const radius = await page.locator("[data-mockup-frame]").evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).toContain("50%");
});

test("opens with demo media when nothing is saved", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
});




