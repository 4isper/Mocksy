import type { CustomFrame } from "@/lib/types/editor";
import { blobToDataUrl } from "@/lib/media/loadFile";

export class UnsupportedFrameError extends Error {
  constructor(fileName: string) {
    super(`"${fileName}" is not a supported SVG frame.`);
    this.name = "UnsupportedFrameError";
  }
}

/** Parses the viewBox attribute from an SVG document. Falls back to a default
 *  canvas when the SVG omits it (many hand-authored skins don't declare one). */
export function parseSvgViewBox(text: string): { w: number; h: number } {
  const match = /viewBox\s*=\s*["']\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s*["']/i.exec(text);
  if (match) {
    const w = Number(match[3]);
    const h = Number(match[4]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w, h };
  }
  return { w: 800, h: 600 };
}

/** True when the file looks like an SVG document. */
export function isSvgFile(file: File): boolean {
  return file.type.includes("svg") || file.name.toLowerCase().endsWith(".svg");
}

/** Encodes an uploaded SVG as a self-contained custom frame. The cutout spans
 *  the whole viewBox (rx 0) so the media fills the frame behind the skin and
 *  the SVG's transparent screen area defines what shows through. */
export async function loadCustomFrameFromFile(file: File): Promise<CustomFrame> {
  if (!isSvgFile(file)) throw new UnsupportedFrameError(file.name);
  const text = await file.text();
  const viewBox = parseSvgViewBox(text);
  return {
    // Two uploads in the same millisecond must not alias the same id — the
    // random suffix disambiguates (same scheme as ids.ts).
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    asset: await blobToDataUrl(file),
    name: file.name,
    viewBox,
    cutout: { x: 0, y: 0, w: viewBox.w, h: viewBox.h, rx: 0 }
  };
}
