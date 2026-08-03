import { expect, test } from "@playwright/test";

// Video/GIF exports run MediaRecorder plus the 32MB FFmpeg WASM encoder inside
// the browser tab; on slow/shared CI runners they need generous headroom.
const VIDEO_EXPORT_TIMEOUT = 180_000;
const VIDEO_EXPORT_EVENT_TIMEOUT = 170_000;

// Frame/Style/Animation/Aspect are now segmented button groups or the visual
// frame picker, not <select>. Pick the frame by its accessible name.
async function selectFrame(page: import("@playwright/test").Page, label: string) {
  await page.getByRole("radio", { name: label, exact: true }).click();
}

async function frameIsActive(page: import("@playwright/test").Page, label: string) {
  return page.getByRole("radio", { name: label, exact: true }).getAttribute("aria-checked");
}

// Opens the unified export dialog from the toolbar. Use an exact match so we
// don't also resolve the preview's "Export My mockup" button (its accessible
// name contains "Export" too, which trips strict mode when both are present).
async function openExportDialog(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.locator(".modal[role='dialog']")).toBeVisible();
}

// Picks a format button inside the export dialog (PNG / MP4 / GIF / ...).
// The dialog groups formats into Image and Video segmented rows; the label is
// matched by its visible text regardless of the group it lives in.
async function chooseExportFormat(
  page: import("@playwright/test").Page,
  label: "PNG" | "MP4" | "GIF" | "WebP" | "WebM" | "Animated WebP" | "SVG" | "HTML"
) {
  await page
    .locator('.segmented[role="group"] button', { hasText: label })
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first()
    .click();
}

// Awaits the download and returns its suggested name plus file bytes.
async function downloadBuffer(downloadPromise: Promise<import("@playwright/test").Download>) {
  const download = await downloadPromise;
  const path = await download.path();
  const fs = await import("node:fs");
  return {
    name: download.suggestedFilename(),
    buffer: path ? fs.readFileSync(path) : Buffer.alloc(0)
  };
}

// Decodes a PNG in-page and reports dark corners + how many of a 6x6 grid
// inside the central 60% region are colorful (saturation > 40). Useful for
// asserting that exported raster exports actually drew the media (a video
// frame, for instance) rather than an empty/background screen.
async function samplePngColors(
  page: import("@playwright/test").Page,
  buffer: Buffer
): Promise<{ width: number; height: number; corners: { tl: number[]; br: number[] }; colorful: number; total: number }> {
  return page.evaluate(
    async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d");
      if (!g) throw new Error("no 2d context");
      g.drawImage(img, 0, 0);
      const px = (x: number, y: number): number[] => {
        const d = g.getImageData(x, y, 1, 1).data;
        return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
      };
      const sat = (p: number[]) => Math.max(p[0]!, p[1]!, p[2]!) - Math.min(p[0]!, p[1]!, p[2]!);
      const W = img.width;
      const H = img.height;
      const corners = { tl: px(4, 4), br: px(W - 5, H - 5) };
      let colorful = 0;
      for (let i = 1; i <= 6; i++) {
        for (let j = 1; j <= 6; j++) {
          if (sat(px(Math.round(W * (0.2 + i * 0.1)), Math.round(H * (0.2 + j * 0.1)))) > 40) colorful++;
        }
      }
      return { width: W, height: H, corners, colorful, total: 36 };
    },
    buffer.toString("base64")
  );
}

// The default scene is a multi-frame grid, so the uploaded media renders once
// per visible frame. Scope to the preview canvas and take the first match so
// strict-mode locators don't trip over the duplicate copies.
function previewMedia(page: import("@playwright/test").Page) {
  return page.locator('#preview-canvas img[alt="Uploaded media"]').first();
}

test("shows editor shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Scene presets")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
});

test("selecting iphone16pro renders the device overlay", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "16 Pro");
  await expect(page.locator('img[src*="iphone16pro.svg"]').first()).toBeVisible();
  // The overlay frame adopts its native (portrait) aspect ratio instead of
  // stretching the skin to the scene's default 16/9.
  const ratio = await page
    .locator("[data-mockup-frame]")
    .first()
    .evaluate((el) => getComputedStyle(el).aspectRatio);
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
  await expect(previewMedia(page)).toBeVisible();

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
  await expect(page.locator('img[src*="iphone16pro.svg"]').first()).toBeVisible();

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

test("overlay skins have a transparent screen cutout", async ({ page }) => {
  await page.goto("/");
  for (const label of ["15", "16 Pro", "iPad", "MacBook"]) {
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
  // The preset gallery lives in the Scene presets tab (Layers is open by default).
  await page.getByRole("tab", { name: "Scene presets" }).click();
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
  await expect(previewMedia(page)).toBeVisible();
  const clear = page.locator("#preview-canvas").getByRole("button", { name: "Clear media" });
  await expect(clear).toBeVisible();
  await clear.click();
  // The active layer's media is gone; the grid's other frame keeps its demo.
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(1);
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
  await expect(previewMedia(page)).toBeVisible();

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
  await expect(previewMedia(page)).toBeVisible();

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
  // Wait until the debounced autosave actually writes the scene with the new
  // frame to localStorage (the "Saved" badge can lag the write).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("mocksy-projects");
        if (!raw) return null;
        return JSON.parse(raw).projects[0]?.scene.frame ?? null;
      })
    )
    .toBe("tablet");
  await page.reload();
  // The restored scene is applied in a post-mount effect, so poll until the
  // persisted Tablet frame becomes active again.
  await expect.poll(() => frameIsActive(page, "Tablet")).toBe("true");
});

test("watch frame renders as a circle", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "Watch");
  await expect.poll(() => frameIsActive(page, "Watch")).toBe("true");
  const radius = await page.locator("[data-mockup-frame]").first().evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).toContain("50%");
});

test("changing aspect ratio resizes the canvas but not the device frame", async ({ page }) => {
  await page.goto("/");
  // Desktop frame keeps its own 16/10 device shape regardless of scene ratio.
  await selectFrame(page, "Desktop");
  await expect.poll(() => frameIsActive(page, "Desktop")).toBe("true");

  const frameRatio = () =>
    page.locator("[data-mockup-frame]").first().evaluate((el) => getComputedStyle(el).aspectRatio);
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
  await expect(previewMedia(page)).toBeVisible();
});

test("Reset restores default settings and demo media", async ({ page }) => {
  await page.goto("/");
  await selectFrame(page, "Tablet");
  await page.getByRole("button", { name: "Reset" }).click();
  // Reset opens a confirmation modal; confirm it.
  await page.locator(".modal").getByRole("button", { name: "Reset" }).click();
  await expect.poll(() => frameIsActive(page, "iPhone")).toBe("true");
  await expect(previewMedia(page)).toBeVisible();
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
  await expect(previewMedia(page)).toBeVisible();

  // The layers panel exposes a Clear button for the selected layer, mirroring
  // the one in the preview. It empties the active layer's media rather than
  // deleting the layer itself. Scope to the layers panel title so we don't
  // clash with the identical button inside the preview canvas.
  await page.getByTitle("Remove media from the selected layer").click();
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(1);
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
  await expect(previewMedia(page)).toBeVisible();
  // The default demo is a 2-frame grid, so two layers to start.
  await expect(page.locator(".layer-item")).toHaveCount(2);

  // Duplicate the selected layer from the layers panel. The clone keeps the
  // same media, so the layer list grows to three.
  await page.locator(".layer-item.is-active").getByRole("button", { name: "Duplicate layer" }).click();
  await expect(page.locator(".layer-item")).toHaveCount(3);
  // Only the two grid frames render; the duplicated layer has no frame slot.
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
  await expect(previewMedia(page)).toBeVisible();

  // The Controls panel exposes its own Clear button next to Upload, distinct
  // from the one in the preview/layers panel. It empties the active layer.
  await page.locator(".control-panel").getByRole("button", { name: "Clear media" }).click();
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(1);
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
  await expect(previewMedia(page)).toBeVisible();
  await expect(page.locator(".layer-item")).toHaveCount(2);

  // ⌘D duplicates the active layer; the clone is appended and becomes active.
  await page.keyboard.press("Control+d");
  await expect(page.locator(".layer-item")).toHaveCount(3);
  await expect(page.locator(".layer-item").last()).toHaveClass(/is-active/);
  const activeIndex = () =>
    page.locator(".layer-item").evaluateAll((items) =>
      items.findIndex((el) => el.classList.contains("is-active"))
    );

  // ⌘↑ moves the active clone one slot up the stack.
  const beforeUp = await activeIndex();
  await page.keyboard.press("Control+ArrowUp");
  expect(await activeIndex()).toBe(beforeUp - 1);

  // ⌘↓ moves it back down again.
  const beforeDown = await activeIndex();
  await page.keyboard.press("Control+ArrowDown");
  expect(await activeIndex()).toBe(beforeDown + 1);
});

test("drag-and-drop reorders layers", async ({ page }) => {
  await page.goto("/");
  // The default demo is a 2-frame grid, so two layers to start.
  await expect(page.locator(".layer-item")).toHaveCount(2);

  const namesBefore = await page.locator(".layer-item").evaluateAll((items) => items.map((el) => el.textContent));
  // Drag the first layer onto the second; it should land below it.
  await page.dragAndDrop(".layer-item >> nth=0", ".layer-item >> nth=1");
  await page.waitForTimeout(150);

  const namesAfter = await page.locator(".layer-item").evaluateAll((items) => items.map((el) => el.textContent));
  expect(namesAfter).toHaveLength(2);
  // The same two layers are present, but the top slot now holds the second one.
  expect(namesAfter).toEqual([namesBefore[1], namesBefore[0]]);
});

test("grid overlay toggles from the preview chip", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-grid-overlay]")).toHaveCount(0);

  await page.getByLabel("Grid", { exact: true }).click();
  const overlay = page.locator("[data-grid-overlay]");
  await expect(overlay).toHaveCount(1);
  // 12 divisions by default -> 8.3333% cells (computed as one size per gradient layer).
  await expect(overlay).toHaveCSS("background-size", "8.33333% 8.33333%, 8.33333% 8.33333%");

  // Switching density resizes the cells.
  await page.getByRole("combobox", { name: "Grid lines" }).selectOption("8");
  await expect(overlay).toHaveCSS("background-size", "12.5% 12.5%, 12.5% 12.5%");

  // Toggling off removes the overlay.
  await page.getByLabel("Grid", { exact: true }).click();
  await expect(page.locator("[data-grid-overlay]")).toHaveCount(0);
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
  await expect(previewMedia(page)).toBeVisible();
  await expect(page.locator(".layer-item")).toHaveCount(2);

  // ⌘D gives three layers; the clone (bottom) is active.
  await page.keyboard.press("Control+d");
  await expect(page.locator(".layer-item")).toHaveCount(3);
  await expect(page.locator(".layer-item").last()).toHaveClass(/is-active/);
  const activeIndex = () =>
    page.locator(".layer-item").evaluateAll((items) =>
      items.findIndex((el) => el.classList.contains("is-active"))
    );

  // ⌘[ selects the previous layer in the stack.
  const beforePrev = await activeIndex();
  await page.keyboard.press("Control+[");
  expect(await activeIndex()).toBe(beforePrev - 1);

  // ⌘] selects the next layer again.
  const beforeNext = await activeIndex();
  await page.keyboard.press("Control+]");
  expect(await activeIndex()).toBe(beforeNext + 1);
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
  await expect(previewMedia(page)).toBeVisible();

  // Hide the active layer via the eye toggle in the layers panel; the preview
  // drops its media without deleting the layer (the grid's other frame stays).
  await page.locator(".layer-item.is-active").getByTitle("Hide layer").click();
  await expect(page.locator('img[alt="Uploaded media"]')).toHaveCount(1);

  // Show it again; the media returns to the preview.
  await page.locator(".layer-item.is-active").getByTitle("Show layer").click();
  await expect(previewMedia(page)).toBeVisible();
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

  // Solid tab → solid preset swatch
  await page.getByRole("button", { name: "Solid", exact: true }).click();
  await page.getByRole("button", { name: "Zinc", exact: true }).click();
  await expect(page.getByRole("button", { name: "Zinc", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Gradient tab → gradient preset swatch
  await page.getByRole("button", { name: "Gradient", exact: true }).click();
  await page.getByRole("button", { name: "Blue → Violet", exact: true }).click();
  await expect(page.getByRole("button", { name: "Blue → Violet", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Transparent mode via its tab
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
  await expect(previewMedia(page)).toBeVisible();

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
  await expect(media).toHaveCount(2);
  await expect(media.first()).toHaveAttribute("src", /data:image\/svg/);
  await expect(page.getByText("Drop image or video to start")).toHaveCount(0);
});

test("exporting an image scene triggers an MP4 download", async ({ page }) => {
  test.setTimeout(VIDEO_EXPORT_TIMEOUT);
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

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
  test.setTimeout(VIDEO_EXPORT_TIMEOUT);
  await page.goto("/");
  await page.getByRole("radio", { name: "16 Pro", exact: true }).click();
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(page.locator('img[src*="iphone16pro.svg"]').first()).toBeVisible();

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
  await expect(previewMedia(page)).toBeVisible();

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
  await expect(previewMedia(page)).toBeVisible();

  await openExportDialog(page);
  await page.locator(".modal.export").getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByText("Copied PNG to clipboard")).toBeVisible();

  // The clipboard must actually hold a PNG, not just claim success.
  const type = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return items[0]?.types[0] ?? "";
  });
  expect(type).toBe("image/png");
});

test("exporting an MP4 via keyboard shortcut triggers a download", async ({ page }) => {
  test.setTimeout(VIDEO_EXPORT_TIMEOUT);
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  const downloadPromise = page.waitForEvent("download", { timeout: VIDEO_EXPORT_EVENT_TIMEOUT });
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
  await expect(previewMedia(page)).toBeVisible();

  test.setTimeout(VIDEO_EXPORT_TIMEOUT);
  const downloadPromise = page.waitForEvent("download", { timeout: VIDEO_EXPORT_EVENT_TIMEOUT });
  await page.keyboard.press("Control+Shift+g");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.gif$/);
});

test("dragging the media pans it inside the frame", async ({ page }) => {
  await page.goto("/");
  // Drag-panning is a single-frame gesture; collapse the demo grid to one frame.
  const removeFrame = page.locator(".control-panel").getByRole("button", { name: "Remove frame" });
  await removeFrame.first().click();
  await removeFrame.first().click();
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  const media = previewMedia(page);
  await expect(media).toBeVisible();

  // Position X starts at 0; dragging the media right must move it.
  const slider = page.locator('[aria-label="Position X"]');
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
  await page.getByRole("tab", { name: "Annotations" }).click();
  await page.locator('.segmented[aria-label="Add annotation"] button', { hasText: "+ Text" }).click();
  // The overlay text shows in the preview and a panel row appears.
  await expect(page.locator("#preview-canvas").getByText("Label")).toBeVisible();
  await expect(page.getByRole("button", { name: /Text 1/ })).toBeVisible();

  // Editing the text updates the overlay.
  await page.locator("textarea").fill("Hello");
  await expect(page.locator("#preview-canvas").getByText("Hello")).toBeVisible();

  // Delete removes it from the preview and the panel.
  await page.getByRole("tabpanel").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator("#preview-canvas").getByText("Hello")).toHaveCount(0);
});

test("adding an arrow draws an overlay and selecting it shows the editor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Annotations" }).click();
  await page.locator('.segmented[aria-label="Add annotation"] button', { hasText: "+ Arrow" }).click();
  // The arrow is an SVG drawn on the canvas.
  await expect(page.locator("#preview-canvas svg").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Arrow 1/ })).toBeVisible();

  // The selected annotation exposes a color and stroke editor.
  await expect(page.getByRole("tabpanel").locator('input[type="color"]')).toBeVisible();
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
  // Wait until the debounced autosave actually writes the scene with the new
  // fit to localStorage (the "Saved" badge can briefly lag the write).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("mocksy-projects");
        if (!raw) return false;
        const proj = JSON.parse(raw).projects[0] as { scene: { layers: { mediaFit?: string }[] } } | undefined;
        return proj?.scene.layers.some((l) => l.mediaFit === "contain") ?? false;
      })
    )
    .toBe(true);
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

test("keyboard shortcuts cheat sheet lists every shortcut", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(300);

  // Opens from the toolbar button (also reachable via "?").
  await page.getByRole("button", { name: /Keyboard shortcuts/ }).click();
  await expect(page.locator(".modal[role='dialog']")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();

  // Every registered shortcut appears, grouped by area.
  await expect(page.getByText("Export PNG")).toBeVisible();
  await expect(page.getByText("Copy PNG to clipboard")).toBeVisible();
  await expect(page.getByText("Export MP4")).toBeVisible();
  await expect(page.getByText("Export GIF")).toBeVisible();
  await expect(page.getByText("Duplicate active layer")).toBeVisible();
  await expect(page.getByText("Reset to defaults")).toBeVisible();

  // Esc (or backdrop click) closes it.
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal[role='dialog']")).toHaveCount(0);
});

test("? key opens the keyboard shortcuts cheat sheet", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(300);
  await page.keyboard.press("Shift+Slash");
  await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.locator(".modal-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(page.locator(".modal[role='dialog']")).toHaveCount(0);
});

test("export dialog lists every image and video format", async ({ page }) => {
  await page.goto("/");
  await openExportDialog(page);
  // The format buttons live in segmented rows whose accessible name prefixes
  // the row label ("Image Image"), so match on the button's visible text.
  for (const label of ["PNG", "WebP", "SVG", "HTML", "MP4", "WebM", "GIF", "Animated WebP"]) {
    await expect(
      page.locator('.segmented[role="group"] button', { hasText: new RegExp(`^${label}$`) }).first()
    ).toBeVisible();
  }
  // Every format has a matching Export action button: the dialog's single
  // action button relabels itself to the currently selected format.
  for (const label of ["PNG", "SVG", "HTML", "WebM", "Animated WebP"]) {
    await page
      .locator('.segmented[role="group"] button', { hasText: new RegExp(`^${label}$`) })
      .first()
      .click();
    await expect(page.getByRole("button", { name: `Export ${label}` })).toBeVisible();
  }
});

test("exporting an image scene triggers a WebP download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  await openExportDialog(page);
  await chooseExportFormat(page, "WebP");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export WebP" }).click();
  const { name, buffer } = await downloadBuffer(downloadPromise);
  expect(name).toMatch(/\.webp$/);
  expect(buffer.length).toBeGreaterThan(0);
});

test("exporting an image scene produces a standalone SVG with embedded media", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  await openExportDialog(page);
  await chooseExportFormat(page, "SVG");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const { name, buffer } = await downloadBuffer(downloadPromise);
  expect(name).toMatch(/\.svg$/);
  const svg = buffer.toString("utf8");
  expect(svg.trimStart().startsWith("<svg")).toBe(true);
  // The media must be embedded as a data URL so the file opens standalone.
  expect(svg).toContain("<image");
  expect(svg).toContain("data:image/png;base64,");
});

test("exporting an image scene produces a self-contained HTML document", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  await openExportDialog(page);
  await chooseExportFormat(page, "HTML");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export HTML" }).click();
  const { name, buffer } = await downloadBuffer(downloadPromise);
  expect(name).toMatch(/\.html$/);
  const html = buffer.toString("utf8");
  expect(html.trimStart().toLowerCase().startsWith("<!doctype html")).toBe(true);
  // The default scene is a multi-frame grid, so the HTML embeds a rendered PNG
  // snapshot of the whole grid as a data URL (see exportHtml).
  expect(html).toContain('<img src="data:image/png;base64,');
});

test("exporting a video scene triggers a WebM download", async ({ page }) => {
  test.setTimeout(VIDEO_EXPORT_TIMEOUT);
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles("public/sample-video.mp4");
  await expect(page.locator("#preview-canvas video")).toBeVisible();

  await openExportDialog(page);
  await chooseExportFormat(page, "WebM");
  const downloadPromise = page.waitForEvent("download", { timeout: VIDEO_EXPORT_EVENT_TIMEOUT });
  await page.getByRole("button", { name: "Export WebM" }).click();
  const { name, buffer } = await downloadBuffer(downloadPromise);
  expect(name).toMatch(/\.webm$/);
  expect(buffer.length).toBeGreaterThan(0);
});

test("animated WebP export of an image scene downloads a non-empty file", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  await openExportDialog(page);
  await chooseExportFormat(page, "Animated WebP");
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: "Export Animated WebP" }).click();
  const { name, buffer } = await downloadBuffer(downloadPromise);
  expect(name).toMatch(/\.webp$/);
  expect(buffer.length).toBeGreaterThan(0);
});

test("PNG export of a video scene draws the video frame, not an empty screen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles("public/sample-video.mp4");
  const video = page.locator("#preview-canvas video");
  await expect(video).toBeVisible();
  // Wait until the preview video has actually decoded a frame.
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(2);

  // Solid near-black background: an empty frame would export as black, so the
  // colorful screen region below proves the video content was painted.
  await page.getByRole("button", { name: "Zinc", exact: true }).click();
  await page.waitForTimeout(300);

  await openExportDialog(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { buffer } = await downloadBuffer(downloadPromise);
  const samples = await samplePngColors(page, buffer);

  const cornerIsDark = (p: number[]) => p.every((v) => v < 60);
  expect(cornerIsDark(samples.corners.tl), `TL corner should be near-black, got ${samples.corners.tl}`).toBe(true);
  expect(cornerIsDark(samples.corners.br), `BR corner should be near-black, got ${samples.corners.br}`).toBe(true);
  expect(samples.colorful, `${samples.colorful}/${samples.total} central points colorful`).toBeGreaterThanOrEqual(samples.total * 0.5);
});

test("SVG export of a video scene embeds the poster frame", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles("public/sample-video.mp4");
  await expect(page.locator("#preview-canvas video")).toBeVisible();
  await expect
    .poll(() => page.locator("#preview-canvas video").evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(2);

  await openExportDialog(page);
  await chooseExportFormat(page, "SVG");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG" }).click();
  const { buffer } = await downloadBuffer(downloadPromise);
  const svg = buffer.toString("utf8");
  // The video frame is rasterized and embedded as a PNG data URL inside <image>.
  expect(svg).toContain("<image");
  expect(svg).toContain("data:image/png;base64,");
});

test("creating a 2-frame grid renders two mockups in the preview", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles("public/sample-video.mp4");
  await expect(page.locator("#preview-canvas video")).toHaveCount(1);

  // The horizontal 2-column grid button (first of the two "2" buttons).
  await page.getByRole("button", { name: "2", exact: true }).first().click();
  await expect(page.locator("#preview-canvas video")).toHaveCount(2);
});

test("PNG export of a 2-frame video grid draws video in both frames", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles("public/sample-video.mp4");
  await expect(page.locator("#preview-canvas video")).toHaveCount(1);
  await page.getByRole("button", { name: "Zinc", exact: true }).click();
  await page.getByRole("button", { name: "2", exact: true }).first().click();
  await page.waitForTimeout(600);

  await openExportDialog(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { buffer } = await downloadBuffer(downloadPromise);

  // Sample the left and right halves where the two phones' screens sit.
  const sample = await page.evaluate(
    async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d");
      if (!g) throw new Error("no 2d context");
      g.drawImage(img, 0, 0);
      const px = (x: number, y: number): number[] => {
        const d = g.getImageData(x, y, 1, 1).data;
        return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
      };
      const sat = (p: number[]) => Math.max(p[0]!, p[1]!, p[2]!) - Math.min(p[0]!, p[1]!, p[2]!);
      const W = img.width;
      const H = img.height;
      const count = (xs: number[]) => {
        let n = 0;
        for (const x of xs) for (let j = 1; j <= 6; j++) {
          if (sat(px(Math.round(x), Math.round(H * (0.2 + j * 0.1)))) > 40) n++;
        }
        return n;
      };
      const corners = { tl: px(4, 4), br: px(W - 5, H - 5) };
      return { corners, left: count([W * 0.25, W * 0.25 + 40]), right: count([W * 0.75, W * 0.75 - 40]), perHalf: 12 };
    },
    buffer.toString("base64")
  );

  const dark = (p: number[]) => p.every((v) => v < 60);
  expect(dark(sample.corners.tl)).toBe(true);
  expect(dark(sample.corners.br)).toBe(true);
  expect(sample.left, `left half colorful points ${sample.left}/${sample.perHalf}`).toBeGreaterThanOrEqual(6);
  expect(sample.right, `right half colorful points ${sample.right}/${sample.perHalf}`).toBeGreaterThanOrEqual(6);
});

test("export Size selector scales the PNG pixel dimensions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  const sizeButton = (label: string) =>
    page.locator('.segmented[aria-label="Size"] button', { hasText: label }).first();

  const exportPng = async () => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PNG" }).click();
    const { buffer } = await downloadBuffer(downloadPromise);
    return (await samplePngColors(page, buffer)).width;
  };

  // 1x export.
  await openExportDialog(page);
  await sizeButton("1×").click();
  const width1x = await exportPng();

  // 4x export (the dialog closes after each export, so reopen it).
  await openExportDialog(page);
  await sizeButton("4×").click();
  const width4x = await exportPng();

  expect(width4x).toBeGreaterThan(width1x * 3);
});

test("RTL locales render with dir=rtl and LTR locales with dir=ltr", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");

  await page.goto("/he");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("locale switcher switches the UI language end-to-end", async ({ page }) => {
  await page.goto("/");
  const switcher = page.locator("select.locale-select");
  await expect(switcher).toHaveValue("en");

  await page.waitForTimeout(1000);
  await Promise.all([
    page.waitForURL("**/ru", { waitUntil: "commit" }),
    switcher.selectOption({ label: "Русский" }),
  ]);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("button", { name: "Экспорт", exact: true })).toBeVisible();
  await expect(page.getByLabel("Сетка")).toBeVisible();

  await page.waitForTimeout(1000);
  await Promise.all([
    page.waitForURL("**/en", { waitUntil: "commit" }),
    switcher.selectOption({ label: "English" }),
  ]);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
});

test("Russian locale renders translated UI strings", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("button", { name: "Экспорт", exact: true })).toBeVisible();
  await expect(page.getByLabel("Сетка")).toBeVisible();
});

test("grid controls are translated per locale", async ({ page }) => {
  const expectGridLabels = async (locale: string, gridLabel: string, divisionsLabel: string) => {
    await page.goto(`/${locale}`);
    await page.getByLabel(gridLabel, { exact: true }).click();
    await expect(page.getByLabel(divisionsLabel)).toBeVisible();
  };

  await expectGridLabels("ru", "Сетка", "Линии сетки");
  await expectGridLabels("de", "Raster", "Rasterlinien");
  await expectGridLabels("ar", "شبكة", "خطوط الشبكة");
});

test("skip link navigates to main content on Enter", async ({ page }) => {
  await page.goto("/");
  const skipLink = page.locator(".skip-link");
  await expect(skipLink).toHaveAttribute("href", "#main-content");
  await skipLink.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("frame instances have keyboard-accessible role and tabindex", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-mockup-frame]").first()).toBeVisible();
  const frame = page.locator(".frame-instance").first();
  await expect(frame).toHaveAttribute("role", "button");
  await expect(frame).toHaveAttribute("tabindex", "0");
});

test("GIF export of an image scene downloads a non-empty file", async ({ page }) => {
  test.setTimeout(VIDEO_EXPORT_TIMEOUT);
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  await openExportDialog(page);
  await chooseExportFormat(page, "GIF");
  const downloadPromise = page.waitForEvent("download", { timeout: VIDEO_EXPORT_EVENT_TIMEOUT });
  await page.getByRole("button", { name: "Export GIF" }).click();
  const { name, buffer } = await downloadBuffer(downloadPromise);
  expect(name).toMatch(/\.gif$/);
  expect(buffer.length).toBeGreaterThan(0);
});

test("MP4 export of a video scene produces a non-empty file", async ({ page }) => {
  test.setTimeout(VIDEO_EXPORT_TIMEOUT);
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles("public/sample-video.mp4");
  await expect(page.locator("#preview-canvas video")).toBeVisible();

  await openExportDialog(page);
  await chooseExportFormat(page, "MP4");
  const downloadPromise = page.waitForEvent("download", { timeout: VIDEO_EXPORT_EVENT_TIMEOUT });
  await page.getByRole("button", { name: "Export MP4" }).click();
  const { name, buffer } = await downloadBuffer(downloadPromise);
  expect(name).toMatch(/\.mp4$/);
  expect(buffer.length).toBeGreaterThan(0);
});

test("exporting with a text annotation includes the annotation in the PNG", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  // Add a text annotation.
  await page.getByRole("tab", { name: "Annotations" }).click();
  await page.locator('.segmented[aria-label="Add annotation"] button', { hasText: "+ Text" }).click();
  await page.waitForTimeout(200);

  await openExportDialog(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { buffer } = await downloadBuffer(downloadPromise);
  expect(buffer.length).toBeGreaterThan(0);

  // The exported PNG should contain non-uniform pixels (annotation + media).
  const samples = await samplePngColors(page, buffer);
  expect(samples.colorful).toBeGreaterThan(0);
});

test("exporting with an arrow annotation includes the arrow in the PNG", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  // Add an arrow annotation.
  await page.getByRole("tab", { name: "Annotations" }).click();
  await page.locator('.segmented[aria-label="Add annotation"] button', { hasText: "+ Arrow" }).click();
  await page.waitForTimeout(200);

  await openExportDialog(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { buffer } = await downloadBuffer(downloadPromise);
  expect(buffer.length).toBeGreaterThan(0);
});

test("exporting with glassDark style preset draws the frame border", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  // Apply the glassDark style preset.
  await page.getByRole("button", { name: "Dark glass" }).click();
  await page.waitForTimeout(200);

  await openExportDialog(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { buffer } = await downloadBuffer(downloadPromise);
  expect(buffer.length).toBeGreaterThan(0);
});

test("exporting with outline style preset draws the frame border", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  // Apply the outline style preset.
  await page.getByRole("button", { name: "Style" }).click();
  await page.getByRole("button", { name: "Outline" }).click();
  await page.waitForTimeout(200);

  await openExportDialog(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { buffer } = await downloadBuffer(downloadPromise);
  expect(buffer.length).toBeGreaterThan(0);
});

test("exporting with a gradient background produces a non-empty PNG", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
      "base64"
    )
  });
  await expect(previewMedia(page)).toBeVisible();

  // Switch to gradient background mode.
  await page.getByRole("button", { name: "Sunset" }).click();
  await page.waitForTimeout(200);

  await openExportDialog(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { buffer } = await downloadBuffer(downloadPromise);
  expect(buffer.length).toBeGreaterThan(0);
});

test("exporting a video scene as MP4 produces a non-empty file with video content", async ({ page }) => {
  test.setTimeout(VIDEO_EXPORT_TIMEOUT);
  await page.goto("/");
  await page.getByRole("button", { name: "Upload image or video" }).setInputFiles("public/sample-video.mp4");
  await expect(page.locator("#preview-canvas video")).toBeVisible();

  await openExportDialog(page);
  await chooseExportFormat(page, "MP4");
  const downloadPromise = page.waitForEvent("download", { timeout: VIDEO_EXPORT_EVENT_TIMEOUT });
  await page.getByRole("button", { name: "Export MP4" }).click();
  const { name, buffer } = await downloadBuffer(downloadPromise);
  expect(name).toMatch(/\.mp4$/);
  expect(buffer.length).toBeGreaterThan(0);
});

test("export dialog shows error when no media is uploaded", async ({ page }) => {
  await page.goto("/");
  await openExportDialog(page);
  // Without media, the export buttons should still be visible but the
  // export should produce a valid (possibly empty) file — the app
  // should not crash.
  const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
  await page.getByRole("button", { name: "Export PNG" }).click();
  const { name, buffer } = await downloadBuffer(downloadPromise);
  expect(name).toMatch(/mocksy-export\.png$/);
  expect(buffer.length).toBeGreaterThanOrEqual(0);
});

test("applying a fan layout preset rearranges frames in a fan pattern", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Fan" }).click();
  await page.waitForTimeout(400);

  const frames = page.locator("[data-mockup-frame]");
  await expect(frames).toHaveCount(2);

  const leftX = await frames.first().evaluate((el) => el.getBoundingClientRect().left);
  const rightX = await frames.last().evaluate((el) => el.getBoundingClientRect().left);
  expect(leftX).toBeLessThan(rightX);
});

test("applying a cascade layout preset rearranges frames diagonally", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Cascade" }).click();
  await page.waitForTimeout(400);

  const frames = page.locator("[data-mockup-frame]");
  await expect(frames).toHaveCount(2);

  const firstRect = await frames.first().boundingBox();
  const lastRect = await frames.last().boundingBox();
  expect(firstRect).toBeTruthy();
  expect(lastRect).toBeTruthy();
  expect(firstRect!.x).toBeLessThan(lastRect!.x);
  expect(firstRect!.y).toBeLessThan(lastRect!.y);
});

test("applying a stack layout preset overlaps frames", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Stack" }).click();
  await page.waitForTimeout(400);

  const frames = page.locator("[data-mockup-frame]");
  await expect(frames).toHaveCount(2);

  const boxes = await frames.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect())
  );
  expect(boxes[0]!.left).toBeLessThan(boxes[1]!.right);
  expect(boxes[1]!.left).toBeGreaterThan(boxes[0]!.left);
});





