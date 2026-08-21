import { expect, test } from "@playwright/test";
import fs from "node:fs";

/**
 * Strict "preview ≡ export" check. Renders a deterministic scene (frame "none"
 * so there is no CSS-vs-canvas device-chrome mismatch), screenshots the exact
 * preview frame region — which now contains the annotation/watermark overlay —
 * and compares it pixel-for-pixel against a real PNG export produced by the same
 * `renderSceneToImageBlob` pipeline the app uses. If a frame/overlay/annotation
 * drifts (the kind of bug fixed in canvasDrawing + PreviewCanvas), the diff
 * blows past the tolerance.
 */
test("preview frame matches the PNG export (annotations + watermark)", async ({ page }) => {
  const scene = {
    frame: "none",
    aspectRatio: "9 / 16",
    backgroundMode: "solid",
    backgroundColor: "#15151c",
    // 1×1 transparent media so the frame renders as a solid color in both
    // preview and export — isolates the annotation/watermark alignment check
    // from any media-fit/crop differences.
    layers: [{ id: "l1", mediaUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQFZX5DwABzwFGACFM1wAAAABJRU5ErkJggg==", mediaType: "image" }],
    tiltX: 0,
    tiltY: 0,
    annotations: [
      { id: "t1", type: "text", x: 0.08, y: 0.07, w: 0.55, h: 0.08, text: "Hello Mocksy", color: "#ff3b30", fontSize: 30, fontWeight: "bold", textAlign: "center", bgColor: "rgba(0,0,0,0.55)", bgPadding: 8, bgRadius: 10 },
      { id: "r1", type: "rect", x: 0.5, y: 0.2, w: 0.4, h: 0.22, color: "#34c759", strokeWidth: 5 },
      { id: "a1", type: "arrow", x: 0.08, y: 0.5, w: 0.45, h: 0.3, color: "#0a84ff", strokeWidth: 4 }
    ],
    watermarkEnabled: true,
    watermarkText: "MOCKSY",
    watermarkPosition: "bottom-right",
    watermarkSize: 22
  };
  const url = `/en?scene=${encodeURIComponent(JSON.stringify(scene))}`;
  await page.goto(url);

  // Let the share scene hydrate and the demo media decode.
  await expect(page.locator("#preview-canvas")).toBeVisible();
  await page.locator("#preview-canvas img").waitFor({ state: "visible" }).catch(() => {});
  await page.waitForTimeout(800);

  // Crop the preview to the exact frame box (the annotation overlay now overlaps
  // it, so this captures frame + annotations + watermark together).
  const box = await page.locator("#preview-canvas").boundingBox();
  expect(box).toBeTruthy();
  // Clip to the exact frame box: the annotation/watermark overlay now overlaps
  // it, so this captures frame + annotations + watermark together.
  const panelShot = await page.screenshot({ clip: box! });

  // Trigger the real PNG export and capture the downloaded blob.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export PNG \/ MP4/ }).click();
  await page.locator('.modal[role="dialog"]').getByRole("button", { name: /Export PNG/ }).click();
  const download = await downloadPromise;
  const exportBuf = fs.readFileSync(await download.path());

  const diffRatio = await page.evaluate(
    async ({ panelB64, exportB64, box }) => {
      const load = (b64: string) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = "data:image/png;base64," + b64;
        });
      const [panelImg, exportImg] = await Promise.all([load(panelB64), load(exportB64)]);
      const W = 450;
      const H = 800;
      const ctx = document.createElement("canvas").getContext("2d")!;
      // Preview: crop the frame region out of the panel screenshot.
      ctx.canvas.width = W;
      ctx.canvas.height = H;
      // panelImg is already the clipped frame region (origin 0,0), so sample it
      // from its own bounds rather than the viewport-relative box coordinates.
      ctx.drawImage(panelImg, 0, 0, panelImg.width, panelImg.height, 0, 0, W, H);
      const preview = ctx.getImageData(0, 0, W, H).data;
      // Export: whole canvas is the scene.
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(exportImg, 0, 0, W, H);
      const exp = ctx.getImageData(0, 0, W, H).data;
      let diff = 0;
      const total = W * H;
      for (let i = 0; i < preview.length; i += 4) {
        const dr = Math.abs(preview[i]! - exp[i]!);
        const dg = Math.abs(preview[i + 1]! - exp[i + 1]!);
        const db = Math.abs(preview[i + 2]! - exp[i + 2]!);
        if (dr > 40 || dg > 40 || db > 40) {
          diff++;
        }
      }
      return diff / total;
    },
    { panelB64: panelShot.toString("base64"), exportB64: exportBuf.toString("base64"), box: box! }
  );

  // ~6% tolerance covers AA on text/edges and the 12px frame corner rounding
  // (preview is rounded, export is rectangular) without hiding a real drift.
  expect(diffRatio, `preview/export diff ratio ${diffRatio.toFixed(3)}`).toBeLessThan(0.06);
});

test("preview matches the PNG export for a landscape frame instance", async ({ page }) => {
  // Multi-frame scene with one portrait and one ROTATED (landscape) "none"
  // instance. Solid-color media isolates box geometry: if the swapped
  // extents / 90° rotation drift between the CSS preview and the canvas
  // export, the colored rectangles land in different places and the diff
  // ratio explodes.
  const px = (hex: string) =>
    `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nG${hex}DwABzwFGACFM1wAAAABJRU5ErkJggg==`;
  const scene = {
    frame: "none",
    aspectRatio: "16 / 9",
    backgroundMode: "solid",
    backgroundColor: "#101014",
    layers: [
      { id: "l1", mediaUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/7yMK/gAAAABJRU5ErkJggg==", mediaType: "image" },
      { id: "l2", mediaUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAZki1cgAAAABJRU5ErkJggg==", mediaType: "image" }
    ],
    tiltX: 0,
    tiltY: 0,
    annotations: [],
    watermarkEnabled: false,
    frameInstances: [
      { id: "p", frame: "none", x: 0.25, y: 0.5, scale: 0.28, layerId: "l1" },
      { id: "l", frame: "none", x: 0.72, y: 0.5, scale: 0.28, layerId: "l2", orientation: "landscape" }
    ]
  };
  const url = `/en?scene=${encodeURIComponent(JSON.stringify(scene))}`;
  await page.goto(url);

  await expect(page.locator("#preview-canvas")).toBeVisible();
  await page.locator("#preview-canvas img").first().waitFor({ state: "visible" }).catch(() => {});
  await page.waitForTimeout(800);

  const box = await page.locator("#preview-canvas").boundingBox();
  expect(box).toBeTruthy();
  const panelShot = await page.screenshot({ clip: box! });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export PNG \/ MP4/ }).click();
  await page.locator('.modal[role="dialog"]').getByRole("button", { name: /Export PNG/ }).click();
  const download = await downloadPromise;
  const exportBuf = fs.readFileSync(await download.path());

  const diffRatio = await page.evaluate(
    async ({ panelB64, exportB64 }) => {
      const load = (b64: string) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = "data:image/png;base64," + b64;
        });
      const [panelImg, exportImg] = await Promise.all([load(panelB64), load(exportB64)]);
      const W = 800;
      const H = 450;
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.canvas.width = W;
      ctx.canvas.height = H;
      ctx.drawImage(panelImg, 0, 0, panelImg.width, panelImg.height, 0, 0, W, H);
      const preview = ctx.getImageData(0, 0, W, H).data;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(exportImg, 0, 0, W, H);
      const exp = ctx.getImageData(0, 0, W, H).data;
      let diff = 0;
      const total = W * H;
      for (let i = 0; i < preview.length; i += 4) {
        const dr = Math.abs(preview[i]! - exp[i]!);
        const dg = Math.abs(preview[i + 1]! - exp[i + 1]!);
        const db = Math.abs(preview[i + 2]! - exp[i + 2]!);
        if (dr > 40 || dg > 40 || db > 40) diff++;
      }
      return diff / total;
    },
    { panelB64: panelShot.toString("base64"), exportB64: exportBuf.toString("base64") }
  );

  expect(diffRatio, `landscape preview/export diff ${diffRatio.toFixed(3)}`).toBeLessThan(0.06);
});
