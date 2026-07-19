import { expect, test } from "@playwright/test";

// Frame/Style/Animation/Aspect are now segmented button groups, not <select>.
// Pick the option by its visible label inside the matching group.
async function selectFrame(page: import("@playwright/test").Page, label: string) {
  await page
    .locator('.segmented[aria-label="Frame"] button', { hasText: label })
    .first()
    .click();
}

async function frameIsActive(page: import("@playwright/test").Page, label: string) {
  return page
    .locator('.segmented[aria-label="Frame"] button', { hasText: label })
    .first()
    .getAttribute("aria-pressed");
}

test("shows editor shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Templates")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
});

test("selecting iphone16pro renders the device overlay", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "16 Pro");
  await expect(page.locator('img[src*="iphone16pro.svg"]')).toBeVisible();
  // The overlay frame adopts its native (portrait) aspect ratio instead of
  // stretching the skin to the scene's default 16/9.
  const ratio = await page.locator("[data-mockup-frame]").evaluate((el) => getComputedStyle(el).aspectRatio);
  expect(ratio).toContain("390 / 844");
});

test("iphone16pro media stays inside the device cutout, not under the bezel", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "16 Pro");
  await page.locator('input[type="file"]').setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  // The media must be inset within the overlay's transparent screen cutout so
  // it never spills across the opaque bezel ("on top of everything").
  const inside = await page.evaluate(() => {
    const overlay = document.querySelector('img[aria-hidden="true"]') as HTMLElement;
    const media = document.querySelector('img[alt="Uploaded media"]') as HTMLElement;
    const o = overlay.getBoundingClientRect();
    const m = media.getBoundingClientRect();
    return (
      m.width > 0 &&
      m.left >= o.left &&
      m.top >= o.top &&
      m.right <= o.right + 1 &&
      m.bottom <= o.bottom + 1
    );
  });
  expect(inside).toBe(true);
});

test("iphone16pro shadow control drives the overlay drop-shadow", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "16 Pro");
  await expect(page.locator('img[src*="iphone16pro.svg"]')).toBeVisible();

  const frameFilter = () =>
    page.evaluate(() => getComputedStyle(document.querySelector("[data-mockup-frame]") as HTMLElement).filter);

  const shadow = page.locator('label:has-text("Shadow") input[type="range"]');
  await shadow.fill("0");
  await page.waitForTimeout(150);
  const atZero = await frameFilter();

  await shadow.fill("1");
  await page.waitForTimeout(150);
  const atMax = await frameFilter();

  // At 0 opacity the drop-shadow alpha is 0; at 1 it is fully opaque. The
  // Shadow control must affect overlay frames (it used to be a no-op there).
  expect(atZero).toContain("rgba(0, 0, 0, 0)");
  expect(atMax).toContain("rgb(0, 0, 0)");
  expect(atZero).not.toBe(atMax);
});

test("iphone15 and iphone16pro overlays have a transparent screen cutout", async ({ page }) => {
  await page.goto("/");
  for (const label of ["15", "16 Pro"]) {
    await selectFrame(page, label);
    await page.waitForTimeout(200);

    // Draw the overlay skin onto a canvas and read the alpha at the screen
    // center. A real cutout is transparent there; an opaque skin is not.
    const centerAlpha = await page.evaluate(async () => {
      const overlay = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement;
      const canvas = document.createElement("canvas");
      canvas.width = overlay.naturalWidth;
      canvas.height = overlay.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return -1;
      ctx.drawImage(overlay, 0, 0);
      const { data } = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1);
      return data[3];
    });
    expect(centerAlpha, `${label} screen center should be transparent`).toBe(0);
  }
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
  await selectFrame(page, "Tablet");
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(await frameIsActive(page, "Tablet")).toBe("true");
});

test("watch frame renders as a circle", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "Watch");
  await expect(await frameIsActive(page, "Watch")).toBe("true");
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
  await selectFrame(page, "Tablet");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(await frameIsActive(page, "iPhone")).toBe("true");
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
});

test("undo and redo restore a previous frame choice", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "Desktop");
  await expect(await frameIsActive(page, "Desktop")).toBe("true");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(await frameIsActive(page, "iPhone")).toBe("true");

  await page.getByRole("button", { name: "Redo" }).click();
  await expect(await frameIsActive(page, "Desktop")).toBe("true");
});

test("keyboard undo reverts the last change", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "Tablet");
  await expect(await frameIsActive(page, "Tablet")).toBe("true");

  await page.keyboard.press("Control+z");
  await expect(await frameIsActive(page, "iPhone")).toBe("true");
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

test("video options accordion collapses and expands", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles("public/sample-video.mp4");
  const toggle = page.getByRole("button", { name: "Video options" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Trim")).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("Trim")).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Trim")).toBeVisible();
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

test("exporting an image scene triggers an MP4 download", async ({ page }) => {
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
  await page.getByRole("button", { name: "Export MP4" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);

  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import("node:fs");
  const size = path ? fs.statSync(path).size : 0;
  expect(size).toBeGreaterThan(0);
});




