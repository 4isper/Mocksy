import type { MediaLayer } from "@/lib/types/editor";

/**
 * Text-layer rendering shared by every renderer (CSS preview, canvas, SVG,
 * HTML, video). The text is laid out in a fixed viewBox whose aspect matches
 * the frame's screen area, so one set of geometry constants drives all
 * outputs: the CSS/HTML/SVG renderers embed an SVG stretched over the screen
 * box (aspect-exact viewBox → no distortion), and the canvas renderer maps the
 * same coordinates through a uniform scale. Keep both paths in this module —
 * never reimplement layout in a renderer.
 */

export const TEXT_LAYER_FONT_FALLBACK = "Inter, system-ui, sans-serif";
/** Line height as a multiple of the font size (mirrors RENDER annotation ratio). */
export const TEXT_LAYER_LINE_HEIGHT = 1.2;
/** Horizontal padding inside the screen, as a fraction of the screen width. */
const PAD_X_FRAC = 0.055;
/** ViewBox width for the embedded SVG; height derives from the screen aspect. */
const VB_W = 390;

/** True when the layer renders text instead of media. Deliberately a plain
 *  boolean: a type-guard predicate would narrow non-union `MediaLayer`
 *  arguments to `never` in the false branch. */
export function isTextLayer(layer: MediaLayer | undefined | null): boolean {
  return layer?.kind === "text";
}

interface TextLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  blockHeight: number;
  /** Baseline y of the first line (block is vertically centered). */
  firstBaselineY: number;
  /** Anchor x for each of start/middle/end alignment. */
  anchorX: Record<"start" | "middle" | "end", number>;
  anchorByAlign: Record<string, "start" | "middle" | "end">;
  fontFamily: string;
  weight: string;
  fill: string;
}

/** Pure layout math in viewBox units (VB_W × vbH). Shared by the SVG builder
 *  and the canvas drawer so preview and exports stay pixel-identical. */
export function layoutTextLayer(layer: MediaLayer, vbH: number): TextLayout {
  const fontSize = Math.max(1, (layer.textSize ?? 0.12) * vbH);
  const lineHeight = fontSize * TEXT_LAYER_LINE_HEIGHT;
  const rawLines = (layer.textContent ?? "").split("\n");
  const lines = rawLines.length > 0 ? rawLines : [""];
  const blockHeight = lines.length * lineHeight;
  // Vertically center the block: half-leading above the first line, then the
  // baseline at ~80% of the font size (standard ascent approximation).
  const firstBaselineY = (vbH - blockHeight) / 2 + (lineHeight - fontSize) / 2 + fontSize * 0.8;
  const padX = VB_W * PAD_X_FRAC;
  return {
    lines,
    fontSize,
    lineHeight,
    blockHeight,
    firstBaselineY,
    anchorX: { start: padX, middle: VB_W / 2, end: VB_W - padX },
    anchorByAlign: { left: "start", center: "middle", right: "end" },
    fontFamily: layer.fontFamily ?? TEXT_LAYER_FONT_FALLBACK,
    weight: layer.fontWeight === "normal" ? "400" : "700",
    fill: layer.textColor ?? "#ffffff"
  };
}

/** Maps the viewBox coordinates onto a pixel screen box. */
function screenScale(innerW: number): number {
  return innerW / VB_W;
}

/**
 * Full `<svg>` markup stretched over the frame's screen area, mirroring how
 * screen chrome is embedded (aspect-matched viewBox so glyphs don't distort).
 * Returns null for media layers or empty content.
 */
export function buildTextLayerSvg(layer: MediaLayer | null | undefined, screenAspect: number): string | null {
  if (!layer || !isTextLayer(layer)) return null;
  const content = (layer.textContent ?? "").trim();
  if (!content) return null;
  const vbH = VB_W / Math.max(screenAspect, Number.EPSILON);
  const L = layoutTextLayer(layer, vbH);
  const anchor = L.anchorByAlign[layer.textAlign ?? "center"] ?? "middle";
  const tspans = L.lines
    .map((line, i) => `<tspan x="${num(anchor === "middle" ? L.anchorX.middle : anchor === "end" ? L.anchorX.end : L.anchorX.start)}" y="${num(L.firstBaselineY + i * L.lineHeight)}">${escapeMarkup(line)}</tspan>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${num(vbH)}" preserveAspectRatio="none" style="width:100%;height:100%;display:block"><text font-size="${num(L.fontSize)}" font-weight="${L.weight}" fill="${L.fill}" font-family="${escapeAttr(L.fontFamily)}" text-anchor="${anchor}">${tspans}</text></svg>`;
}

/**
 * Canvas twin of `buildTextLayerSvg`: draws the same layout into the frame's
 * inner screen rect. Coordinates map linearly from the viewBox via a uniform
 * scale, so the output matches the CSS/SVG renderers exactly.
 */
export function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: MediaLayer,
  innerX: number,
  innerY: number,
  innerW: number,
  innerH: number
): void {
  const content = (layer.textContent ?? "").trim();
  if (!isTextLayer(layer) || !content) return;  const vbH = VB_W / Math.max(innerW / Math.max(innerH, Number.EPSILON), Number.EPSILON);
  const k = screenScale(innerW);
  const L = layoutTextLayer(layer, vbH);
  const align = layer.textAlign ?? "center";
  const x = innerX + L.anchorX[L.anchorByAlign[align] ?? "middle"] * k;
  ctx.save();
  ctx.fillStyle = L.fill;
  ctx.textAlign = (L.anchorByAlign[align] ?? "middle") as CanvasTextAlign;
  ctx.textBaseline = "alphabetic";
  ctx.font = `${L.weight} ${L.fontSize * k}px ${L.fontFamily}`;
  L.lines.forEach((line, i) => {
    ctx.fillText(line, x, innerY + (L.firstBaselineY + i * L.lineHeight) * k);
  });
  ctx.restore();
}

function num(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

function escapeMarkup(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
