import type { FrameBox } from "@/lib/render/frameGeometry";
import { frameViewBox, type FrameSpec } from "@/lib/render/frames";
import { escapeMarkup } from "@/lib/export/markupUtils";

/**
 * Browser-frame address bar. The window skin (public/devices/browser.svg)
 * paints the toolbar, traffic lights and the empty address pill; the URL text
 * itself is dynamic, so every renderer draws it on top of the pill using the
 * shared geometry below — `browserUrlSvg` emits SVG markup in skin viewBox
 * units (CSS preview, SVG/HTML export) and `drawBrowserUrl` paints the same
 * layout on a 2D canvas (PNG/video export), mirroring screenChrome.ts.
 */

/** Must match the browser.svg viewBox and FRAME_SPECS.browser geometry. */
export const BROWSER_VIEWBOX = { w: 1440, h: 1000 };
export const BROWSER_TOOLBAR_H = 96;
/** Address pill rect in viewBox units (where the URL text is drawn). Sits to
 *  the right of the tab strip. */
export const BROWSER_PILL = { x: 460, y: 20, w: 960, h: 56 };

export const BROWSER_URL_FONT_SIZE = 26;
export const BROWSER_URL_COLOR = "#5f6368";
export const BROWSER_URL_COLOR_DARK = "#e8eaed";
export const BROWSER_TOOLBAR_DARK = "#202124";
export const BROWSER_URL_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
/** Corner radius of the dark toolbar overlay (viewBox units), matched to the
 *  browser skin's window radius so the dark bar tracks the rounded corners. */
export const BROWSER_TOOLBAR_RADIUS = 24;
/** Horizontal gap between the pill edge and the text, per side. */
export const BROWSER_URL_PADDING = 24;
/** Rough average glyph width factor for system sans at a given font size;
 *  used to truncate long URLs to the pill width without measuring text. */
const CHAR_WIDTH_FACTOR = 0.52;

export function isBrowserFrameSpec(spec: FrameSpec): boolean {
  return spec.urlBar === true;
}

/** Truncates the URL with an ellipsis so it fits the address pill. */
export function fitBrowserUrl(url: string): string {
  const maxWidth = BROWSER_PILL.w - BROWSER_URL_PADDING * 2;
  const maxChars = Math.floor(maxWidth / (BROWSER_URL_FONT_SIZE * CHAR_WIDTH_FACTOR));
  const trimmed = url.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/** Vertical center of the pill in viewBox units. */
function pillCenterY(): number {
  return BROWSER_PILL.y + BROWSER_PILL.h / 2;
}

/** SVG `<text>` markup for the URL, in skin viewBox units. Callers place it
 *  inside the same translate/scale group as the skin so it tracks the frame. */
export function browserUrlSvg(url: string, theme: "light" | "dark" = "light"): string {
  const x = BROWSER_PILL.x + BROWSER_URL_PADDING;
  const color = theme === "dark" ? BROWSER_URL_COLOR_DARK : BROWSER_URL_COLOR;
  return `<text x="${x}" y="${pillCenterY()}" font-size="${BROWSER_URL_FONT_SIZE}" fill="${color}" font-family="${BROWSER_URL_FONT}" dominant-baseline="central">${escapeMarkup(fitBrowserUrl(url))}</text>`;
}

/** Rounded-top toolbar background for the dark browser theme, drawn over the
 *  skin's toolbar area so the URL text stays legible on a dark bar. */
function darkToolbarSvg(): string {
  const w = BROWSER_VIEWBOX.w;
  const h = BROWSER_TOOLBAR_H;
  const r = BROWSER_TOOLBAR_RADIUS;
  const path = `M0 ${r} Q0 0 ${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h} H0 Z`;
  return `<path d="${path}" fill="${BROWSER_TOOLBAR_DARK}"/>`;
}

/** Full standalone SVG document for the URL text, sized to the skin's
 *  viewBox. Used by the CSS preview and the HTML export; stretched over the
 *  whole frame so it tracks the skin exactly. When `theme` is "dark" a dark
 *  toolbar bar is painted behind the address pill. */
export function browserChromeSvg(url: string, theme: "light" | "dark" = "light"): string {
  const inner = theme === "dark" ? `${darkToolbarSvg()}${browserUrlSvg(url, theme)}` : browserUrlSvg(url);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BROWSER_VIEWBOX.w} ${BROWSER_VIEWBOX.h}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

/** Paints the URL into the frame box on a 2D canvas. Applies the same
 *  translate/scale mapping as the SVG export (box origin + viewBox scale) so
 *  both stay pixel-aligned at any rendered size. */
export function drawBrowserUrl(
  ctx: CanvasRenderingContext2D,
  box: FrameBox,
  spec: FrameSpec,
  url: string,
  theme: "light" | "dark" = "light"
): void {
  const vb = frameViewBox(spec);
  const sx = box.width / vb.w;
  const sy = box.height / vb.h;
  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.scale(sx, sy);
  if (theme === "dark") {
    ctx.fillStyle = BROWSER_TOOLBAR_DARK;
    const w = vb.w;
    const h = BROWSER_TOOLBAR_H;
    const r = BROWSER_TOOLBAR_RADIUS;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = theme === "dark" ? BROWSER_URL_COLOR_DARK : BROWSER_URL_COLOR;
  ctx.font = `400 ${BROWSER_URL_FONT_SIZE}px ${BROWSER_URL_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(fitBrowserUrl(url), BROWSER_PILL.x + BROWSER_URL_PADDING, pillCenterY());
  ctx.restore();
}
