import { test, expect } from "@playwright/test";
import fs from "node:fs";

// Preview ≡ export under 3D tilt. A tilted frame is rotated around its center,
// so it spills outside the untransformed #preview-canvas box — a naive clip
// misaligns with the export's projected quad. To compare fairly we pad/shrink
// the preview frame (injected CSS) so the rotated frame has margin, then clip a
// scene-aspect region centered on the frame, with the panel background forced
// to match the scene background so only the tilted frame content differs.

// 1×1 PNG, color #15151c (matches scene.backgroundColor).
const SOLID_MEDIA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQFZX5DwABzwFGACFM1wAAAABJRU5ErkJggg==";

const W = 450;
const H = 800;

interface TiltCase {
  name: string;
  frame: string;
  screen: Record<string, unknown>;
  tiltX: number;
  tiltY: number;
}

const BASE_SCREEN = {
  enabled: true,
  theme: "dark" as const,
  time: "9:41",
  date: "Tuesday, August 4"
};
const lock = { ...BASE_SCREEN, style: "lock", showStatusBar: true, showClock: true, showDate: true, showDock: false, showHomeIndicator: true };
const home = { ...BASE_SCREEN, style: "home", showStatusBar: true, showClock: false, showDate: false, showDock: true, showHomeIndicator: true };

const cases: TiltCase[] = [
  { name: "lock screen tilted (overlay iphone15)", frame: "iphone15", screen: lock, tiltX: 12, tiltY: 8 },
  { name: "home screen tilted (css iphone)", frame: "iphone", screen: home, tiltX: -10, tiltY: 6 },
  { name: "lock screen tilted (frame none)", frame: "none", screen: lock, tiltX: 10, tiltY: -8 },
  { name: "lock screen tilted (css iphone)", frame: "iphone", screen: lock, tiltX: -10, tiltY: 6 }
];

test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

for (const c of cases) {
  test(`preview matches export — ${c.name}`, async ({ page }) => {
    const scene = {
      frame: c.frame,
      aspectRatio: "9 / 16",
      backgroundMode: "solid",
      backgroundColor: "#15151c",
      layers: [{ id: "l1", mediaUrl: SOLID_MEDIA, mediaType: "image" }],
      tiltX: c.tiltX,
      tiltY: c.tiltY,
      screen: c.screen
    };
    const url = `/en?scene=${encodeURIComponent(JSON.stringify(scene))}`;
    await page.goto(url);

    // Pad/shrink the preview frame and force its background to match the scene
    // so the clipped region contains the fully-rotated frame with no UI chrome.
    await page.addStyleTag({
      content: `
        div.panel:has(#preview-canvas) {
          padding: 180px !important;
          background: #15151c !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .preview-chip { display: none !important; }
      `
    });

    await page.locator("#preview-canvas").waitFor({ state: "visible" });
    await page.waitForTimeout(900);

    const box = await page.locator("#preview-canvas").boundingBox();
    expect(box).toBeTruthy();
    // The export canvas is exactly #preview-canvas' client box (× pixelRatio),
    // so clip the preview to that same box — both clip the tilted frame at the
    // identical boundary, keeping the frame at the same relative scale.
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    const clipW = box!.width;
    const clipH = box!.height;
    const panelShot = await page.screenshot({
      clip: { x: cx - clipW / 2, y: cy - clipH / 2, width: clipW, height: clipH }
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export PNG \/ MP4/ }).click();
    await page.locator('.modal[role="dialog"]').getByRole("button", { name: "Export PNG" }).click();
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
        const W = Math.min(panelImg.width, exportImg.width);
        const H = Math.min(panelImg.height, exportImg.height);
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.canvas.width = W;
        ctx.canvas.height = H;
        ctx.drawImage(panelImg, 0, 0);
        const preview = ctx.getImageData(0, 0, W, H).data;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(exportImg, 0, 0);
        const exp = ctx.getImageData(0, 0, W, H).data;
        let diff = 0;
        const total = W * H;
        const bands = new Array(10).fill(0);
        const bandTot = new Array(10).fill(0);
        for (let y = 0; y < H; y++) {
          const band = Math.min(9, Math.floor((y / H) * 10));
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const dr = Math.abs(preview[i]! - exp[i]!);
            const dg = Math.abs(preview[i + 1]! - exp[i + 1]!);
            const db = Math.abs(preview[i + 2]! - exp[i + 2]!);
            bandTot[band]!++;
            if (dr > 40 || dg > 40 || db > 40) {
              diff++;
              bands[band]!++;
            }
          }
        }
        const bbox = (data: Uint8ClampedArray) => {
          let minX = W, minY = H, maxX = 0, maxY = 0, cnt = 0, sx = 0, sy = 0;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
            if (r + g + b > 120) {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
              sx += x; sy += y; cnt++;
            }
          }
          return { minX, minY, maxX, maxY, cx: cnt ? (sx / cnt) | 0 : -1, cy: cnt ? (sy / cnt) | 0 : -1, w: maxX - minX, h: maxY - minY };
        };
        return {
          ratio: diff / total,
          bands: bands.map((b, i) => +(b / bandTot[i]!).toFixed(2)),
          dims: [panelImg.width, panelImg.height, exportImg.width, exportImg.height],
          prevBox: bbox(preview),
          expBox: bbox(exp)
        };
      },
      { panelB64: panelShot.toString("base64"), exportB64: exportBuf.toString("base64") }
    );

    console.log(`DIFF[${c.name}] = ${diffRatio.ratio.toFixed(3)} bands=${JSON.stringify(diffRatio.bands)}`);
    console.log(`   prevBox=${JSON.stringify(diffRatio.prevBox)} expBox=${JSON.stringify(diffRatio.expBox)}`);
    // Under tilt the canvas export and the CSS preview differ by a small,
    // systematic amount (AA/edge effects at the rotated frame borders); this
    // ceiling catches gross regressions (e.g. a missing/unapplied tilt) while
    // allowing that sub-pixel tilt delta.
    expect(diffRatio.ratio, `preview/export diff ratio ${diffRatio.ratio}`).toBeLessThan(0.07);
  });
}
