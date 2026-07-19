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

test("Reset restores default settings and demo media", async ({ page }) => {
  await page.goto("/");
  await page.locator("select").first().selectOption("tablet");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator("select").first()).toHaveValue("iphone");
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
});

test("undo and redo restore a previous frame choice", async ({ page }) => {
  await page.goto("/");
  const frameSelect = page.locator("select").first();
  await frameSelect.selectOption("desktop");
  await expect(frameSelect).toHaveValue("desktop");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(frameSelect).toHaveValue("iphone");

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(frameSelect).toHaveValue("desktop");
});

test("keyboard undo reverts the last change", async ({ page }) => {
  await page.goto("/");
  const frameSelect = page.locator("select").first();
  await frameSelect.selectOption("tablet");
  await expect(frameSelect).toHaveValue("tablet");

  await page.keyboard.press("Control+z");
  await expect(frameSelect).toHaveValue("iphone");
});

test("background swatches apply a preset", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Zinc", exact: true }).click();
  await expect(page.getByRole("button", { name: "Zinc", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Blue → Violet", exact: true }).click();
  await expect(page.getByRole("button", { name: "Blue → Violet", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Transparent", exact: true }).click();
  await expect(page.getByRole("button", { name: "Transparent", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("Export PNG via keyboard shortcut triggers a download", async ({ page }) => {
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
  await page.keyboard.press("Control+e");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/mocksy-export\.png$/);
});

test("panels stack and stay within the viewport on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await expect(page.getByText("Templates")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
  // No horizontal overflow on mobile.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(overflow).toBe(true);
});

test("video scene shows a dual-range trim control", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles("public/sample-video.mp4");
  await expect(page.getByText("Trim")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Trim start" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Trim end" })).toBeVisible();
  // Dragging trim end updates the displayed window label.
  const trimLabel = page.locator("div", { hasText: /s – .*s/ }).filter({ has: page.getByText("Trim") }).first();
  await expect(trimLabel).toBeVisible();
});

test("rejects unsupported file types with an inline error", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fake")
  });
  await expect(page.getByText(/is not a supported image or video/)).toBeVisible();
  // The default demo media stays put; the rejected PDF is not loaded.
  const media = page.locator('img[alt="Uploaded media"]');
  await expect(media).toHaveCount(1);
  await expect(media).toHaveAttribute("src", /data:image\/svg/);
  await expect(page.getByText("Drop image or video to start")).toHaveCount(0);
});




