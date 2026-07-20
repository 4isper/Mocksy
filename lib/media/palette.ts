/**
 * Extracts a small dominant-color palette from loaded media so the editor can
 * offer a "match the background to the image" action. Images are sampled
 * straight off a downscaled canvas; videos use the current frame (poster or
 * paused frame). Color quantization is a lightweight median-cut-ish bucket
 * approach — good enough for gradient picks without pulling in a heavy lib.
 */

/** Maximum pixels per axis we sample; keeps the pixel read cheap on 4K media. */
const SAMPLE_MAX = 96;

export interface PaletteResult {
  /** Sorted by dominance, light→dark is NOT guaranteed; first is most common. */
  colors: string[];
  /** Average color of the whole image, handy as a single solid fallback. */
  average: string;
}

function loadElementImage(el: HTMLImageElement | HTMLVideoElement): HTMLCanvasElement {
  const srcW = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
  const srcH = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
  if (!srcW || !srcH) throw new Error("Media has no readable dimensions yet.");

  const scale = Math.min(1, SAMPLE_MAX / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not read media pixels.");
  ctx.drawImage(el as CanvasImageSource, 0, 0, w, h);
  return canvas;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Buckets pixels into a coarse 4-bit-per-channel grid, then returns the N most
 * populated buckets as hex colors. Returns [] when no pixels are readable.
 */
export function quantize(data: Uint8ClampedArray, count: number): string[] {
  const buckets = new Map<number, Bucket>();
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = Number(data[i + 3]);
    if (a < 125) continue;
    const r = Number(data[i]);
    const g = Number(data[i + 1]);
    const b = Number(data[i + 2]);
    // 4 bits per channel → 4096 buckets, enough to separate distinct hues.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
    totalR += r;
    totalG += g;
    totalB += b;
    total += 1;
  }

  if (total === 0) return [];

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const colors = sorted.slice(0, count).map((b) => rgbToHex(b.r / b.count, b.g / b.count, b.b / b.count));
  return colors;
}

/**
 * Extracts a dominant-color palette from a loaded image or video element.
 * Thumbnails/transparent areas are skipped. Throws if the element isn't ready
 * or the canvas can't be read (e.g. a tainted cross-origin video).
 */
export function extractPalette(
  el: HTMLImageElement | HTMLVideoElement,
  colorCount = 5
): PaletteResult {
  const canvas = loadElementImage(el);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not read media pixels.");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const colors = quantize(data, colorCount);
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (Number(data[i + 3]) < 125) continue;
    totalR += Number(data[i]);
    totalG += Number(data[i + 1]);
    totalB += Number(data[i + 2]);
    total += 1;
  }
  const average = total > 0 ? rgbToHex(totalR / total, totalG / total, totalB / total) : "#000000";
  return { colors, average };
}

/**
 * Picks two well-separated colors from a palette to form a pleasant gradient:
 * the most saturated color and the average, or the two most distant hues.
 * Falls back to a flat pair when fewer than two colors are available.
 */
export function pickGradientPair(colors: string[]): [string, string] {
  if (colors.length === 0) return ["#1d4ed8", "#7c3aed"];
  if (colors.length === 1) {
    // Shift lightness a touch so a single color still reads as a gradient.
    return [colors[0] ?? "#1d4ed8", colors[0] ?? "#7c3aed"];
  }
  // Use the first (most dominant) as the start and the last as the end so the
  // gradient spans the palette's extremes rather than two near-identical hues.
  return [colors[0] ?? "#1d4ed8", colors[colors.length - 1] ?? "#7c3aed"];
}
