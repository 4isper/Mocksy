import { expect, test } from "@playwright/test";
import fs from "node:fs";

/**
 * Regression guard for the device drop-shadow export pipeline (the bug class
 * that took three rounds to fix):
 *  1. the off-thread render lost the SVG skin entirely (silent
 *     createImageBitmap(SVG-blob) failure) → no skin, no shadow;
 *  2. casting the canvas shadow from the skin raster / glass fills produced a
 *     shadow ~4× weaker than the preview's CSS drop-shadow;
 *  3. erasing the shadow silhouette over the whole frame box left a light
 *     ring around the device (the skin artwork is inset from the box), and
 *     leaving the silhouette visible bled black through the skin's
 *     transparent margins and through transparent media.
 *
 * These tests export REAL PNGs through the app pipeline and measure pixels
 * just outside each device's left edge (edge x derived from the scene
 * geometry): the shadow must hug the device (no light gap), stay in the
 * shadow luminance band (no black silhouette bleed), and a transparent media
 * must show the background through the screen cutout (no black rectangle).
 */

const OPAQUE_RED = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/7yMK/gAAAABJRU5ErkJggg==";
/** Genuinely transparent 1×1 PNG (alpha 0). */
const TRANSPARENT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4AWMAAQAABQABNtCI3QAAAABJRU5ErkJggg==";

const BG = 232; // #e8e8ec scene background luminance
const DEVICE_LUM = 50; // bezel pixels are ~16-21; the deepest shadow stays above this

async function exportPng(page: import("@playwright/test").Page, scene: Record<string, unknown>): Promise<Buffer> {
  await page.goto(`/en?scene=${encodeURIComponent(JSON.stringify(scene))}`, { waitUntil: "networkidle" });
  await page.locator("#preview-canvas").waitFor();
  await page.waitForTimeout(1000);
  const download = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByRole("button", { name: /Export PNG \/ MP4/ }).click();
  await page.locator(".modal[role='dialog']").locator("button").filter({ hasText: /^Export PNG$/ }).click();
  const file = await download;
  const path = "/tmp/mocksy-shadow-guard.png";
  await file.saveAs(path);
  await page.keyboard.press("Escape");
  return fs.readFileSync(path);
}

interface EdgeReport {
  bg: number;
  bands: Array<{ edge: number; ringMin: number; ringMax: number; edgeMax: number; shadowMin: number }>;
  screenCenter: number;
}

/** In-browser pixel analysis: measures the luminance band just left of each
 *  expected device edge (fractions of the canvas width) at mid-height. */
async function analyzeEdges(
  page: import("@playwright/test").Page,
  png: Buffer,
  edgeFractions: number[],
  sampleScreen: boolean
): Promise<EdgeReport> {
  return page.evaluate(async ({ b64, edgeFracs, sampleScreen, deviceLum }) => {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("export decode failed"));
      i.src = "data:image/png;base64," + b64;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const W = canvas.width;
    const H = canvas.height;
    const { data: d } = ctx.getImageData(0, 0, W, H);
    const lum = (x: number, y: number): number => d[(Math.round(y) * W + Math.round(x)) * 4] ?? 0;

    const midY = Math.round(H / 2);
    const bands = edgeFracs.map((frac) => {
      // Negative fraction = "scan the row from the left" (single-frame mode,
      // where the centered phone's edge can't be derived from a fraction).
      let edge: number;
      if (frac < 0) {
        edge = -1;
        for (let x = 0; x < W; x++) if (lum(x, midY) < deviceLum) { edge = x; break; }
      } else {
        // Walk right from the expected box edge until the dark bezel is found
        // (at most a few px of artwork inset), then measure the outer bands.
        edge = Math.round(frac * W);
        for (let probe = 0; probe < 30; probe++) {
          if (lum(edge + probe, midY) < deviceLum) { edge = edge + probe; break; }
        }
      }
      let ringMin = 255;
      let ringMax = 0;
      let edgeMax = 0;
      let shadowMin = 255;
      for (let dx = 1; dx <= 8; dx++) {
        const l = lum(edge - dx, midY);
        ringMin = Math.min(ringMin, l);
        ringMax = Math.max(ringMax, l);
        if (dx <= 6) edgeMax = Math.max(edgeMax, l);
      }
      for (let dx = 8; dx <= 40; dx++) shadowMin = Math.min(shadowMin, lum(edge - dx, midY));
      return { edge, ringMin, ringMax, edgeMax, shadowMin };
    });
    const screenCenter = sampleScreen ? lum(Math.round(W / 2), Math.round(H / 2)) : -1;
    return { bg: lum(4, 4), bands, screenCenter };
  }, { b64: png.toString("base64"), edgeFracs: edgeFractions, sampleScreen, deviceLum: DEVICE_LUM });
}

test("overlay device export keeps a contact shadow: no light ring, no black bleed, transparent screen shows bg", async ({ page }) => {
  const scene = {
    frame: "iphone15",
    aspectRatio: "16 / 9",
    backgroundMode: "solid",
    backgroundColor: "#e8e8ec",
    shadowOpacity: 1,
    // Transparent media is the harshest case: the screen cutout must show the
    // background (the old black-silhouette bug rendered it near-black), and
    // the shadow must still hug the bezel.
    layers: [{ id: "l1", mediaUrl: TRANSPARENT, mediaType: "image" }],
    tiltX: 0,
    tiltY: 0
  };
  const png = await exportPng(page, scene);
  // Single-frame mode: the phone is centered, its box width follows from the
  // frame aspect inside the 16/9 canvas — the edge sits just left of center.
  const report = await analyzeEdges(page, png, [-1], true);

  const { edge, ringMin, ringMax, edgeMax, shadowMin } = report.bands[0]!;
  expect(edge, "device edge found on the row").toBeGreaterThan(0);
  // The shadow must start immediately at the artwork edge: any run of pure
  // background pixels hugging the device is the light-ring regression.
  expect(edgeMax, `max luminance at 1-6px outside the edge ${edgeMax}`).toBeLessThan(BG - 15);
  // No light ring: the band hugging the device must carry real shadow (the
  // full-box-punch regression rendered pure background here, ~bg).
  expect(ringMin, `ring min ${ringMin} (bg ${report.bg})`).toBeLessThan(BG - 25);
  // No black silhouette bleed: the old black-rect bug rendered ~10-30 here.
  expect(ringMax, `ring max ${ringMax}`).toBeGreaterThan(60);
  // The shadow must be strong in the near band (the weak-shadow regression
  // measured ~216 at bg 232).
  expect(shadowMin, `shadow min ${shadowMin}`).toBeLessThan(BG - 25);
  // Transparent media: the screen shows the background, not the silhouette.
  expect(report.screenCenter, `screen center ${report.screenCenter}`).toBeGreaterThan(BG - 25);
});

test("multi-frame export: every device keeps its shadow, no boxes between them", async ({ page }) => {
  const scale = 0.22;
  const xs = [0.18, 0.5, 0.82];
  const scene = {
    frame: "none",
    aspectRatio: "16 / 9",
    backgroundMode: "solid",
    backgroundColor: "#e8e8ec",
    shadowOpacity: 1,
    frameInstances: xs.map((x, i) => ({ id: `f${i + 1}`, frame: "iphone15", x, y: 0.5, scale, layerId: "l1" })),
    layers: [{ id: "l1", mediaUrl: OPAQUE_RED, mediaType: "image" }],
    tiltX: 0,
    tiltY: 0
  };
  const png = await exportPng(page, scene);
  // Instance box: width = scale × canvas width, centered on x → left edge at
  // (x − scale/2) as a canvas fraction.
  const report = await analyzeEdges(page, png, xs.map((x) => x - scale / 2), false);

  expect(report.bands, "one band report per device").toHaveLength(3);
  for (const [i, band] of report.bands.entries()) {
    expect(band.edge, `device ${i + 1} edge found`).toBeGreaterThan(0);
    expect(band.edgeMax, `device ${i + 1} edge-band max ${band.edgeMax}`).toBeLessThan(BG - 15);
    expect(band.ringMin, `device ${i + 1} ring min ${band.ringMin}`).toBeLessThan(BG - 25);
    expect(band.ringMax, `device ${i + 1} ring max ${band.ringMax}`).toBeGreaterThan(60);
    expect(band.shadowMin, `device ${i + 1} shadow min ${band.shadowMin}`).toBeLessThan(BG - 25);
  }
});
