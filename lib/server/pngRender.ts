import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { createHash } from "node:crypto";
import type { EditorScene } from "@/lib/types/editor";
import type { SpinRenderResult } from "@/lib/types/spin";

/**
 * Server-side PNG rendering for the spin API. Drives a headless Chromium
 * instance (shared per-process) to the `[locale]/spin-render` harness page,
 * which runs the exact same `renderSceneToImageBlob` pipeline the client
 * export uses — so originals and API renders stay pixel-identical.
 *
 * Pure Node — no `next/server` — so it can be unit/integration tested without
 * a framework runtime. Returns null on any failure; callers decide how to
 * fall back.
 */

const RENDER_TIMEOUT_MS = 45_000;
export const CACHE_MAX = 40;
/** Hard byte ceiling for the cache in addition to the entry count: a single
 *  8192×8192 PNG can be tens of MB, so 40 count-only entries could pin
 *  gigabytes of RSS on the unauthenticated spin endpoint. */
export const CACHE_MAX_BYTES = 256 * 1024 * 1024;

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({
        headless: true,
        chromiumSandbox: false,
        args: ["--no-sandbox", "--disable-dev-shm-usage"]
      })
      .then((browser) => {
        browser.on("disconnected", () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        // A failed launch must not be cached forever: a rejected promise here
        // would make every subsequent render reuse the same failure until the
        // process restarts, even after the underlying cause clears.
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

function cacheKey(scene: EditorScene, width: number, height: number): string {
  return createHash("sha256").update(JSON.stringify([scene, width, height])).digest("hex");
}

/** Least-recently-used (LRU) cache: identical (scene, size) spins never
 *  re-render. Reads promote the entry to the most-recent position so eviction
 *  drops the least-recently-used one. Bounded by BOTH entry count and total
 *  bytes so long-running servers don't leak pixels. */
export class PngCache {
  private entries = new Map<string, Buffer>();
  private totalBytes = 0;

  get(key: string): Buffer | null {
    const value = this.entries.get(key);
    if (value === undefined) return null;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: Buffer): void {
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      this.totalBytes -= existing.length;
      this.entries.delete(key);
    }
    this.entries.set(key, value);
    this.totalBytes += value.length;
    while (this.entries.size > CACHE_MAX) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      const dropped = this.entries.get(oldest)!;
      this.totalBytes -= dropped.length;
      this.entries.delete(oldest);
    }
    while (this.totalBytes > CACHE_MAX_BYTES && this.entries.size > 1) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      const dropped = this.entries.get(oldest)!;
      this.totalBytes -= dropped.length;
      this.entries.delete(oldest);
    }
  }
}

const cache = new PngCache();

export interface RenderSceneToPngOptions {
  scene: EditorScene;
  width: number;
  height: number;
  /** Absolute URL of the harness page (e.g. http://host/en/spin-render). */
  pageUrl: string;
  /** Bypass the in-memory cache (used by tests). */
  noCache?: boolean;
}

/** Renders a scene to PNG bytes via the harness page. Deterministic: the same
 *  scene renders the same pixels, and the cache short-circuits identical spins.
 *  Returns null when Chromium is unavailable or the render fails. */
export async function renderSceneToPngBuffer(opts: RenderSceneToPngOptions): Promise<Buffer | null> {
  const { scene, width, height, pageUrl } = opts;
  const key = cacheKey(scene, width, height);
  if (!opts.noCache) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  let browser: Browser;
  let context: BrowserContext | null = null;
  try {
    browser = await getBrowser();
    context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: RENDER_TIMEOUT_MS });
      await page.waitForFunction(
        () => typeof (window as Window & { __mocksyRender?: unknown }).__mocksyRender === "function",
        null,
        { timeout: RENDER_TIMEOUT_MS }
      );
      // A timeout only REJECTS the in-page promise when racing — the evaluate
      // itself has no deadline, so a hung in-page render (image load that
      // never settles) would otherwise hold the request open forever.
      const evaluate = page.evaluate(
        async (req) => {
          const api = (window as Window & { __mocksyRender?: (r: unknown) => Promise<SpinRenderResult> }).__mocksyRender;
          if (!api) return { error: "harness not ready" } satisfies SpinRenderResult;
          return await api(req);
        },
        { scene, width, height }
      );
      // The context close below settles a hung evaluate; swallow its
      // rejection so it can't surface as an unhandled promise rejection.
      evaluate.catch(() => undefined);
      const result = await Promise.race([
        evaluate,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("In-page render timed out")), RENDER_TIMEOUT_MS)
        )
      ]) as SpinRenderResult;

      if (!result.dataUrl) {
        if (result.error) console.error("[spin-render]", result.error);
        return null;
      }
      const comma = result.dataUrl.indexOf(",");
      if (comma === -1) return null;
      const buffer = Buffer.from(result.dataUrl.slice(comma + 1), "base64");
      if (buffer.length === 0) return null;
      if (!opts.noCache) cache.set(key, buffer);
      return buffer;
    } finally {
      await context.close().catch(() => undefined);
    }
  } catch (err) {
    console.error("[spin-render]", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Preloads the harness page so the first spin request skips page compilation. */
export async function warmHarness(pageUrl: string): Promise<void> {
  try {
    const browser = await getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: RENDER_TIMEOUT_MS });
      await page.waitForFunction(
        () => typeof (window as Window & { __mocksyRender?: unknown }).__mocksyRender === "function",
        null,
        { timeout: RENDER_TIMEOUT_MS }
      );
    } finally {
      await context.close().catch(() => undefined);
    }
  } catch (err) {
    console.error("[spin-render] warm:", err instanceof Error ? err.message : err);
  }
}