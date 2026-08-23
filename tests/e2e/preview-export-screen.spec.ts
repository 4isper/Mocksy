import { test, expect } from "@playwright/test";
import fs from "node:fs";

// Preview ≡ export checks for the on-screen "chrome" (lock clock/date, home
// dock, status bar) across frame types. Each case renders a deterministic
// scene via a share URL, screenshots the frame region, triggers the real PNG
// export and compares the two pixel-for-pixel. A drift in chrome geometry
// (preview SVG vs export canvas) shows up as a large diff ratio.
//
// Media is a 1×1 opaque image matching the background so the frame fills with a
// solid color and the comparison isolates the chrome, not a photo.

// 1×1 PNG, color #15151c (matches scene.backgroundColor).
const SOLID_MEDIA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQFZX5DwABzwFGACFM1wAAAABJRU5ErkJggg==";

const W = 450;
const H = 800;

interface ScreenCase {
  name: string;
  frame: string;
  screen: Record<string, unknown>;
  mediaUrl?: string;
  tiltX?: number;
  tiltY?: number;
  /** When set, renders a multi-frame grid instead of the single frame view. */
  frameInstances?: Array<Record<string, unknown>>;
}

const BASE_SCREEN = {
  enabled: true,
  theme: "dark" as const,
  time: "9:41",
  date: "Tuesday, August 4"
};

const lock = { ...BASE_SCREEN, style: "lock", showStatusBar: true, showClock: true, showDate: true, showDock: false, showHomeIndicator: true };
const home = { ...BASE_SCREEN, style: "home", showStatusBar: true, showClock: false, showDate: false, showDock: true, showHomeIndicator: true };
const statusBar = { ...BASE_SCREEN, style: "statusBar", showStatusBar: true, showClock: false, showDate: false, showDock: false, showHomeIndicator: false };

const cases: ScreenCase[] = [
  { name: "lock screen (overlay iphone15)", frame: "iphone15", screen: lock },
  { name: "home screen (overlay iphone15)", frame: "iphone15", screen: home },
  { name: "status bar only (overlay iphone15)", frame: "iphone15", screen: statusBar },
  { name: "lock screen (frame none)", frame: "none", screen: lock },
  { name: "home screen (frame none)", frame: "none", screen: home },
  { name: "home screen (css iphone)", frame: "iphone", screen: home },
  { name: "home screen (overlay ipad)", frame: "ipad", screen: home },
  { name: "home screen (overlay macbook)", frame: "macbook", screen: home },
  { name: "lock screen (overlay iphone15, real photo)", frame: "iphone15", screen: lock, mediaUrl: "/test-photo.png" },
  { name: "home screen (overlay ipad, real photo)", frame: "ipad", screen: home, mediaUrl: "/test-photo.png" },
  // Regression: in the multi-frame grid the media must not paint above the
  // device skin (notch) or the screen chrome — it used to, because the grid
  // rendered the media element after them in the DOM. Photo media makes the
  // whole device body visible so a paint-order drift shows up as a large diff.
  {
    name: "lock screen (multi-frame grid)",
    frame: "iphone15",
    screen: lock,
    mediaUrl: "/test-photo.png",
    frameInstances: [{ id: "fi1", frame: "iphone15", layerId: "l1", x: 0.5, y: 0.5, scale: 0.9 }]
  },
  {
    name: "home screen (multi-frame grid)",
    frame: "iphone15",
    screen: home,
    mediaUrl: "/test-photo.png",
    frameInstances: [{ id: "fi1", frame: "iphone15", layerId: "l1", x: 0.5, y: 0.5, scale: 0.9 }]
  },
  {
    name: "status bar only (multi-frame grid)",
    frame: "ipad",
    screen: statusBar,
    mediaUrl: "/test-photo.png",
    frameInstances: [{ id: "fi1", frame: "ipad", layerId: "l1", x: 0.5, y: 0.5, scale: 0.9 }]
  }
];

for (const c of cases) {
  test(`preview matches export — ${c.name}`, async ({ page }) => {
    const scene = {
      frame: c.frame,
      aspectRatio: "9 / 16",
      backgroundMode: "solid",
      backgroundColor: "#15151c",
      layers: [{ id: "l1", mediaUrl: c.mediaUrl ?? SOLID_MEDIA, mediaType: "image" }],
      tiltX: c.tiltX ?? 0,
      tiltY: c.tiltY ?? 0,
      screen: c.screen,
      ...(c.frameInstances ? { frameInstances: c.frameInstances } : {})
    };
    const url = `/en?scene=${encodeURIComponent(JSON.stringify(scene))}`;
    await page.goto(url);
    await page.locator("#preview-canvas").waitFor({ state: "visible" });
    await page.waitForTimeout(900);

    const box = await page.locator("#preview-canvas").boundingBox();
    expect(box).toBeTruthy();
    const panelShot = await page.screenshot({ clip: box! });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export PNG \/ MP4/ }).click();
    await page.locator('.modal[role="dialog"]').getByRole("button", { name: "Export PNG" }).click();
    const download = await downloadPromise;
    const exportBuf = fs.readFileSync(await download.path());

    const diffRatio = await page.evaluate(
      async ({ panelB64, exportB64 }) => {
        const W = 450;
        const H = 800;
        const load = (b64: string) =>
          new Promise<HTMLImageElement>((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = rej;
            img.src = "data:image/png;base64," + b64;
          });
        const [panelImg, exportImg] = await Promise.all([load(panelB64), load(exportB64)]);
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.canvas.width = W;
        ctx.canvas.height = H;
        // panelImg is already the clipped frame region (origin 0,0), so sample it
        // from its own bounds — not the viewport-relative box coordinates.
        ctx.drawImage(panelImg, 0, 0, panelImg.width, panelImg.height, 0, 0, W, H);
        const preview = ctx.getImageData(0, 0, W, H).data;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(exportImg, 0, 0, W, H);
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
        return { ratio: diff / total, bands: bands.map((b, i) => +(b / bandTot[i]!).toFixed(2)) };
      },
      { panelB64: panelShot.toString("base64"), exportB64: exportBuf.toString("base64") }
    );

    console.log(`DIFF[${c.name}] = ${diffRatio.ratio.toFixed(3)} bands=${JSON.stringify(diffRatio.bands)}`);
    expect(diffRatio.ratio, `preview/export diff ratio ${diffRatio.ratio.toFixed(3)}`).toBeLessThan(0.06);
  });
}
