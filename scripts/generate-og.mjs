// Generates public/og-image.png by screenshotting the /og route with
// Playwright. Usage:
//   npm run og                 (starts a temporary dev server itself)
//   BASE_URL=http://localhost:3000 npm run og   (uses an already-running server)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const WIDTH = 1200;
const HEIGHT = 630;
const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "og-image.png");

function startDevServer() {
  const port = 3457;
  const child = spawn("npx", ["next", "dev", "-p", String(port)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  return {
    url: `http://localhost:${port}`,
    close() {
      child.kill("SIGTERM");
    }
  };
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready in time`);
}

const external = process.env.BASE_URL;

// Next 16 allows only one dev server per project directory. When the script
// is run during an active `next dev` session its spawned server would exit
// immediately, so probe the conventional port first and reuse it.
let base = external;
if (!base) {
  try {
    const res = await fetch("http://localhost:3000", { signal: AbortSignal.timeout(1000) });
    if (res.ok) base = "http://localhost:3000";
  } catch {
    // no running server — start our own below
  }
}
const server = base ? null : startDevServer();
base ??= server.url;

try {
  await waitForServer(base);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1
    });
    await page.goto(`${base}/en/og`, { waitUntil: "networkidle" });
    // The Next.js dev tools button is injected into the page; drop it so the
    // screenshot stays clean regardless of dev/prod mode.
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
    await page.evaluate(() => document.fonts.ready);
    // Let the SVG data-URI media and device skin finish decoding.
    await page.evaluate(() =>
      Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))))
    );
    mkdirSync(path.dirname(OUT), { recursive: true });
    const shot = await page.screenshot({ clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    writeFileSync(OUT, shot);
    console.log(`Wrote ${OUT} (${shot.length} bytes)`);
  } finally {
    await browser.close();
  }
} finally {
  server?.close();
}
