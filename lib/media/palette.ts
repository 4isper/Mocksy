/**
 * Extracts a small dominant-color palette from loaded media so the editor can
 * offer a "match the background to the image" action. Images are sampled
 * straight off a downscaled canvas; videos use the current frame (poster or
 * paused frame). Color quantization is a lightweight median-cut-ish bucket
 * approach — good enough for gradient picks without pulling in a heavy lib.
 */

/** Maximum pixels per axis we sample; keeps the pixel read cheap on 4K media. */
const SAMPLE_MAX = 96;

export interface QuantizedColor {
  hex: string;
  count: number;
}

export interface PaletteResult {
  /** Sorted by dominance, light→dark is NOT guaranteed; first is most common. */
  colors: QuantizedColor[];
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

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) } : null;
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
export function quantize(data: Uint8ClampedArray, count: number): QuantizedColor[] {
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
  const colors = sorted.slice(0, count).map((b) => ({ hex: rgbToHex(b.r / b.count, b.g / b.count, b.b / b.count), count: b.count }));
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
 * Merges multiple weighted palettes into one by aggregating colors into
 * quantized bins weighted by per-color count × source weight. The result
 * is sorted by total weight descending, then deduplicated to the top 5.
 * Average color is a weighted mean of all source averages.
 */
export function mergeWeightedPalettes(
  palettes: { colors: QuantizedColor[]; average: string; weight: number }[]
): PaletteResult {
  if (palettes.length === 0) return { colors: [], average: "#000000" };

  type Bin = { r: number; g: number; b: number; weight: number };
  const binMap = new Map<number, Bin>();
  let totalWeight = 0;
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;

  for (const p of palettes) {
    if (p.weight <= 0) continue;
    totalWeight += p.weight;
    const avg = hexToRgb(p.average);
    if (avg) {
      avgR += avg.r * p.weight;
      avgG += avg.g * p.weight;
      avgB += avg.b * p.weight;
    }
    for (const c of p.colors) {
      const rgb = hexToRgb(c.hex);
      if (!rgb) continue;
      const binKey = ((rgb.r >> 4) << 8) | ((rgb.g >> 4) << 4) | (rgb.b >> 4);
      const w = c.count * p.weight;
      const existing = binMap.get(binKey);
      if (existing) {
        existing.r += rgb.r * w;
        existing.g += rgb.g * w;
        existing.b += rgb.b * w;
        existing.weight += w;
      } else {
        binMap.set(binKey, { r: rgb.r * w, g: rgb.g * w, b: rgb.b * w, weight: w });
      }
    }
  }

  if (totalWeight === 0) return { colors: [], average: "#000000" };

  const mergedColors = [...binMap.entries()]
    .map(([, v]) => ({ hex: rgbToHex(v.r / v.weight, v.g / v.weight, v.b / v.weight), count: Math.round(v.weight) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    colors: mergedColors,
    average: rgbToHex(avgR / totalWeight, avgG / totalWeight, avgB / totalWeight)
  };
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 0 };
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

/**
 * Picks two well-separated colors from a palette to form a pleasant gradient.
 * Uses HSL to find the color closest to complementary (hue + 180°) of the
 * dominant color, preferring vibrant and balanced colors. Falls back to the
 * palette extremes when no good harmonic pair is found.
 */
export function pickGradientPair(colors: string[]): [string, string] {
  if (colors.length === 0) return ["#1d4ed8", "#7c3aed"];
  if (colors.length === 1) return [colors[0]!, colors[0]!];

  const hslList = colors.map(c => ({ hex: c, ...hexToHsl(c) }));
  const dominant = hslList[0]!;
  const targetHue = (dominant.h + 180) % 360;

  let best = hslList[1]!;
  let bestScore = -Infinity;
  for (const c of hslList) {
    if (c.hex === dominant.hex) continue;
    const hueDist = hueDistance(c.h, targetHue);
    const hueScore = 1 - hueDist / 180;
    const satScore = c.s / 100;
    const lightScore = 1 - Math.abs(c.l - 50) / 50;
    const score = hueScore * 0.6 + satScore * 0.2 + lightScore * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (best.hex === dominant.hex) return [dominant.hex, colors[colors.length - 1]!];
  return [dominant.hex, best.hex];
}

/**
 * Returns the best solid color from the palette — the most dominant color.
 * Useful for one-click solid backgrounds matched to media.
 */
export function pickBestSolid(colors: string[]): string {
  if (colors.length === 0) return "#1d4ed8";
  return colors[0]!;
}

/**
 * Converts a PaletteResult (with QuantizedColor[] colors) to a flat hex string
 * array for use with store / pickGradientPair.
 */
export function paletteColorsFlat(result: PaletteResult): string[] {
  return result.colors.map((c) => c.hex);
}
