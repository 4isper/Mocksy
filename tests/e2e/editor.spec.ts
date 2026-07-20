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

// Opens the unified export dialog from the toolbar. Use an exact match so we
// don't also resolve the preview's "Export My mockup" button (its accessible
// name contains "Export" too, which trips strict mode when both are present).
async function openExportDialog(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.locator(".modal[role='dialog']")).toBeVisible();
}

// Picks a format tab inside the export dialog (PNG / MP4 / GIF).
async function chooseExportFormat(page: import("@playwright/test").Page, label: "PNG" | "MP4" | "GIF") {
  await page
    .locator('.segmented[aria-label="Format"] button', { hasText: label })
    .first()
    .click();
}

test("shows editor shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Scene presets")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
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

test("templates include the Soft Glass preset", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Soft Glass" })).toBeVisible();
});

test("uploading media reveals a Clear button that resets it", async ({ page }) => {
  await page.goto("/");
  const fileInput = page.getByRole("button", { name: "Upload image or video" });
  await fileInput.setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
  const clear = page.locator("#preview-canvas").getByRole("button", { name: "Clear media" });
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(0);
  await expect(page.getByText("Drop image or video to start")).toBeVisible();
});

test("exporting an image scene triggers a PNG download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  await openExportDialog(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/mocksy-export\.png$/);
});

test("watermark preview matches the exported image", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  // Enable the watermark toggle.
  await page.locator('label.toggle:has-text("Watermark")').click();
  await expect(page.locator(".preview-watermark")).toBeVisible();

  // The on-screen watermark must read as 13px Inter/500 at a 16px inset so it
  // visually matches what renderMockup paints onto the exported canvas.
  const wm = await page.evaluate(() => {
    const span = document.querySelector(".preview-watermark") as HTMLElement;
    const canvas = document.querySelector("#preview-canvas")!.getBoundingClientRect();
    const r = span.getBoundingClientRect();
    const cs = getComputedStyle(span);
    return {
      fontSize: parseFloat(cs.fontSize),
      fontWeight: cs.fontWeight,
      rightGap: Math.round(canvas.right - r.right),
      bottomGap: Math.round(canvas.bottom - r.bottom)
    };
  });
  expect(wm.fontSize).toBe(13);
  expect(wm.fontWeight).toBe("500");
  expect(wm.rightGap).toBe(16);
  expect(wm.bottomGap).toBe(16);

  // Exporting with the watermark on must still produce a PNG download.
  await openExportDialog(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/mocksy-export\.png$/);
});

test("autosaves the scene and restores it after reload", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "Tablet");
  await expect(page.getByText("Saved")).toBeVisible();
  // Give the debounced autosave a moment to flush to localStorage before we
  // tear the page down with a reload.
  await page.waitForTimeout(300);
  await page.reload();
  // The restored scene is applied in a post-mount effect, so poll until the
  // persisted Tablet frame becomes active again.
  await expect.poll(() => frameIsActive(page, "Tablet")).toBe("true");
});

test("watch frame renders as a circle", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "Watch");
  await expect.poll(() => frameIsActive(page, "Watch")).toBe("true");
  const radius = await page.locator("[data-mockup-frame]").evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).toContain("50%");
});

test("changing aspect ratio resizes the canvas but not the device frame", async ({ page }) => {
  await page.goto("/");
  // Desktop frame keeps its own 16/10 device shape regardless of scene ratio.
  await selectFrame(page, "Desktop");
  await expect.poll(() => frameIsActive(page, "Desktop")).toBe("true");

  const frameRatio = () =>
    page.locator("[data-mockup-frame]").evaluate((el) => getComputedStyle(el).aspectRatio);
  const canvasRatio = () =>
    page.locator("#preview-canvas").evaluate((el) => getComputedStyle(el).aspectRatio);

  // Default scene aspect ratio is 16/9; the frame must stay at its device ratio.
  expect(await frameRatio()).toContain("16 / 10");
  expect(await canvasRatio()).toContain("16 / 9");

  // Switch the scene to 1/1; the canvas follows, the desktop frame does not.
  await page.locator('.segmented[aria-label="Aspect ratio"] button', { hasText: "1 / 1" }).first().click();
  await page.waitForTimeout(150);
  expect(await canvasRatio()).toContain("1 / 1");
  expect(await frameRatio()).toContain("16 / 10");
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
  // Reset opens a confirmation modal; confirm it.
  await page.locator(".modal").getByRole("button", { name: "Reset" }).click();
  await expect.poll(() => frameIsActive(page, "iPhone")).toBe("true");
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
});

test("Layers panel clears media of the active layer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  // The layers panel exposes a Clear button for the selected layer, mirroring
  // the one in the preview. It empties the active layer's media rather than
  // deleting the layer itself. Scope to the layers panel title so we don't
  // clash with the identical button inside the preview canvas.
  await page.getByTitle("Remove media from the selected layer").click();
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(0);
  await expect(page.getByText("Drop image or video to start")).toBeVisible();
});

test("duplicating a layer clones it with the same media", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
  // One layer to start.
  await expect(page.locator(".layer-item")).toHaveCount(1);

  // Duplicate the selected layer from the layers panel. The clone keeps the
  // same media, so the preview now renders two copies of it.
  await page.locator(".layer-item.is-active").getByRole("button", { name: "Duplicate layer" }).click();
  await expect(page.locator(".layer-item")).toHaveCount(2);
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(2);
});

test("Control panel clears the active layer's media", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  // The Controls panel exposes its own Clear button next to Upload, distinct
  // from the one in the preview/layers panel. It empties the active layer.
  await page.getByTitle("Clear the active layer's media").click();
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(0);
  await expect(page.getByText("Drop image or video to start")).toBeVisible();
});

test("keyboard duplicates and reorders the active layer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
  await expect(page.locator(".layer-item")).toHaveCount(1);

  // ⌘D duplicates the active layer; the clone is appended and becomes active.
  await page.keyboard.press("Control+d");
  await expect(page.locator(".layer-item")).toHaveCount(2);
  await expect(page.locator(".layer-item").last()).toHaveClass(/is-active/);

  // ⌘↑ moves the active clone to the top of the stack.
  await page.keyboard.press("Control+ArrowUp");
  await expect(page.locator(".layer-item").first()).toHaveClass(/is-active/);

  // ⌘↓ moves it back to the bottom.
  await page.keyboard.press("Control+ArrowDown");
  await expect(page.locator(".layer-item").last()).toHaveClass(/is-active/);
});

test("keyboard switches between layers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
  await expect(page.locator(".layer-item")).toHaveCount(1);

  // ⌘D gives two layers; the clone (bottom) is active.
  await page.keyboard.press("Control+d");
  await expect(page.locator(".layer-item")).toHaveCount(2);
  await expect(page.locator(".layer-item").last()).toHaveClass(/is-active/);

  // ⌘[ selects the previous (top) layer.
  await page.keyboard.press("Control+[");
  await expect(page.locator(".layer-item").first()).toHaveClass(/is-active/);

  // ⌘] selects the next (bottom) layer again.
  await page.keyboard.press("Control+]");
  await expect(page.locator(".layer-item").last()).toHaveClass(/is-active/);
});

test("toggling layer visibility hides and shows it in the preview", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  // Hide the active layer via the eye toggle in the layers panel; the preview
  // drops its media without deleting the layer.
  await page.locator(".layer-item.is-active").getByTitle("Hide layer").click();
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(0);

  // Show it again; the media returns to the preview.
  await page.locator(".layer-item.is-active").getByTitle("Show layer").click();
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();
});

test("undo and redo restore a previous frame choice", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "Desktop");
  await expect.poll(() => frameIsActive(page, "Desktop")).toBe("true");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => frameIsActive(page, "iPhone")).toBe("true");

  await page.getByRole("button", { name: "Redo" }).click();
  await expect.poll(() => frameIsActive(page, "Desktop")).toBe("true");
});

test("keyboard undo reverts the last change", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "Tablet");
  await expect.poll(() => frameIsActive(page, "Tablet")).toBe("true");

  await page.keyboard.press("Control+z");
  await expect.poll(() => frameIsActive(page, "iPhone")).toBe("true");
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
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
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
  await expect(page.getByText("Scene presets")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
  // No horizontal overflow on mobile.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(overflow).toBe(true);
});

test("portrait 9/16 preview fits the viewport without page scroll on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator('.segmented[aria-label="Aspect ratio"] button', { hasText: "9 / 16" }).first().click();
  await page.waitForTimeout(200);
  // The editor locks to the viewport, so the whole frame is visible and the
  // page itself never scrolls (the previous bug forced 50% zoom or scrolling).
  const fit = await page.evaluate(() => {
    const frame = document.querySelector("[data-mockup-frame]") as HTMLElement;
    const r = frame.getBoundingClientRect();
    return {
      frameInViewport: r.bottom <= window.innerHeight + 1 && r.top >= 0,
      noPageScroll: document.body.scrollHeight <= window.innerHeight + 1
    };
  });
  expect(fit.frameInViewport).toBe(true);
  expect(fit.noPageScroll).toBe(true);
});

test("video scene shows a dual-range trim control", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles("public/sample-video.mp4");
  await expect(page.getByText("Trim")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Trim start" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Trim end" })).toBeVisible();
  // Dragging trim end updates the displayed window label.
  const trimLabel = page.locator("div", { hasText: /s – .*s/ }).filter({ has: page.getByText("Trim") }).first();
  await expect(trimLabel).toBeVisible();
});

test("video options accordion collapses and expands", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles("public/sample-video.mp4");
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
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
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
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await openExportDialog(page);
  await chooseExportFormat(page, "MP4");
  await page.getByRole("button", { name: "Export MP4" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);

  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import("node:fs");
  const size = path ? fs.statSync(path).size : 0;
  expect(size).toBeGreaterThan(0);
});

test("exporting an overlay phone frame (16 Pro) produces an MP4", async ({ page }) => {
  await page.goto("/");
  await page.locator('.segmented[aria-label="Frame"] button', { hasText: "16 Pro" }).first().click();
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[src*="iphone16pro.svg"]')).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await openExportDialog(page);
  await chooseExportFormat(page, "MP4");
  await page.getByRole("button", { name: "Export MP4" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import("node:fs");
  const size = path ? fs.statSync(path).size : 0;
  expect(size).toBeGreaterThan(0);
});

test("Auto from media builds a gradient from the uploaded image palette", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    // A solid red 2x2 PNG so the extracted palette is dominated by red.
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSFQGAFa0A/0jf9d",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  // The button starts disabled until the media palette is analyzed after load.
  const autoBtn = page.getByRole("button", { name: "Auto from media" });
  await expect(autoBtn).toBeEnabled();

  await autoBtn.click();
  await page.waitForTimeout(150);

  // The background container must now carry a gradient derived from the media.
  const bg = await page.evaluate(
    () => getComputedStyle(document.querySelector("#preview-canvas") as HTMLElement).backgroundImage
  );
  expect(bg).toContain("gradient");
  // The preset swatch should no longer read as the previously-active gradient.
  await expect(page.getByRole("button", { name: "Blue → Violet", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("copy PNG button writes the mockup image to the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  await openExportDialog(page);
  await page.getByRole("button", { name: "Copy PNG" }).click();
  await expect(page.getByText("Copied PNG to clipboard")).toBeVisible();

  // The clipboard must actually hold a PNG, not just claim success.
  const type = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return items[0]?.types[0] ?? "";
  });
  expect(type).toBe("image/png");
});

test("exporting an MP4 via keyboard shortcut triggers a download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.keyboard.press("Control+Shift+e");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
});

test("exporting a GIF via keyboard shortcut triggers a download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[alt="Uploaded media"]')).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.keyboard.press("Control+Shift+g");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.gif$/);
});

test("dragging the media pans it inside the frame", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  const media = page.locator('img[alt="Uploaded media"]');
  await expect(media).toBeVisible();

  // Position X starts at 0; dragging the media right must move it.
  const slider = page.locator('[aria-label="Media horizontal position"]');
  expect(await slider.inputValue()).toBe("0");

  const box = await media.boundingBox();
  if (!box) throw new Error("media has no box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy, { steps: 5 });
  await page.mouse.up();

  expect(await slider.inputValue()).not.toBe("0");
});

test("adding a text annotation renders it on the canvas and can be deleted", async ({ page }) => {
  await page.goto("/");
  await page.locator('.segmented[aria-label="Add annotation"] button', { hasText: "+ Text" }).click();
  // The overlay text shows in the preview and a panel row appears.
  await expect(page.locator("#preview-canvas").getByText("Label")).toBeVisible();
  await expect(page.getByRole("button", { name: /Text 1/ })).toBeVisible();

  // Editing the text updates the overlay.
  await page.locator("textarea").fill("Hello");
  await expect(page.locator("#preview-canvas").getByText("Hello")).toBeVisible();

  // Delete removes it from the preview and the panel.
  await page.locator(".annotations-panel").getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("#preview-canvas").getByText("Hello")).toHaveCount(0);
});

test("adding an arrow draws an overlay and selecting it shows the editor", async ({ page }) => {
  await page.goto("/");
  await page.locator('.segmented[aria-label="Add annotation"] button', { hasText: "+ Arrow" }).click();
  // The arrow is an SVG drawn on the canvas.
  await expect(page.locator("#preview-canvas svg").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Arrow 1/ })).toBeVisible();

  // The selected annotation exposes a color and stroke editor.
  await expect(page.locator('input[type="color"]')).toBeVisible();
});

test("Fill / Fit toggle switches the media fit and persists across reload", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(300);

  const previewFit = () =>
    page.evaluate(() => {
      const media = document.querySelector('#preview-canvas img[alt="Uploaded media"]') as HTMLElement | null;
      return media ? getComputedStyle(media).objectFit : null;
    });

  // Default is cover (fill/crop).
  expect(await previewFit()).toBe("cover");

  // Switch the active layer to Fit (contain / letterbox).
  await page
    .locator('.segmented[aria-label="Fill / Fit"] button', { hasText: "Fit" })
    .first()
    .click();
  await page.waitForTimeout(400);
  const fitAfter = await previewFit();
  expect(fitAfter).toBe("contain");

  // The choice is part of the scene and autosaved, so it survives a reload.
  // Wait for the debounced autosave to flush before reloading.
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await page.waitForTimeout(400);
  const fitAfterReload = await previewFit();
  expect(fitAfterReload).toBe("contain");
});

test("export dialog Size selector sets the chosen resolution", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(300);

  const sizeButton = (label: string) =>
    page.locator('.segmented[aria-label="Size"] button', { hasText: label }).first();

  await openExportDialog(page);
  // Defaults to 2× (matching the preview's pixel ratio on a standard display).
  await expect(sizeButton("2×")).toHaveAttribute("aria-pressed", "true");

  // The selector drives the export resolution for PNG, MP4 and GIF. It lives
  // outside the scene (an export preference, not serialized into share URLs),
  // but it persists in the store while the editor is open.
  await sizeButton("4×").click();
  await expect(sizeButton("4×")).toHaveAttribute("aria-pressed", "true");

  // Closing and reopening keeps the chosen preference.
  await page.locator(".modal-backdrop").click({ position: { x: 4, y: 4 } });
  await openExportDialog(page);
  await expect(sizeButton("4×")).toHaveAttribute("aria-pressed", "true");
});





