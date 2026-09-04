import type { Annotation } from "@/lib/types/editor";
import { escapeAttr } from "@/lib/export/markupUtils";

/** Returns true when the annotation has both gradientFrom and gradientTo set. */
export function hasAnnotationGradient(a: Annotation): boolean {
  return !!a.gradientFrom && !!a.gradientTo;
}

/** Builds a CSS linear-gradient() or radial-gradient() string from annotation
 *  gradient fields. Returns null when no gradient is configured. */
export function annotationGradientCSS(a: Annotation): string | null {
  if (!hasAnnotationGradient(a)) return null;
  const from = a.gradientFrom!;
  const to = a.gradientTo!;
  const via = a.gradientVia;
  const stops = via ? `${from}, ${via}, ${to}` : `${from}, ${to}`;
  if (a.gradientType === "radial") return `radial-gradient(circle, ${stops})`;
  const angle = a.gradientAngle ?? 135;
  return `linear-gradient(${angle}deg, ${stops})`;
}

/**
 * Shared CSS-convention gradient geometry. CSS `linear-gradient(θdeg)` measures
 * θ clockwise from north: the gradient direction in screen coordinates is
 * (sin θ, −cos θ), and the gradient line runs through the center with length
 * |w·sin θ| + |h·cos θ|. Using a math-convention (cos, sin) instead mirrors
 * every export relative to the CSS preview and the HTML export.
 * Returns the start/end points of the gradient line for a box at (x, y, w, h).
 */
function cssGradientLine(x: number, y: number, w: number, h: number, angleDeg: number): { x1: number; y1: number; x2: number; y2: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2;
  const cy = y + h / 2;
  return {
    x1: cx - (dx * len) / 2,
    y1: cy - (dy * len) / 2,
    x2: cx + (dx * len) / 2,
    y2: cy + (dy * len) / 2
  };
}

/** Builds a canvas CanvasGradient for annotation stroke/fill. */
export function annotationCanvasGradient(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  x: number,
  y: number,
  w: number,
  h: number
): CanvasGradient | null {
  if (!hasAnnotationGradient(a)) return null;
  const from = a.gradientFrom!;
  const to = a.gradientTo!;
  const via = a.gradientVia;
  if (a.gradientType === "radial") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    // CSS radial-gradient(circle) defaults to farthest-corner.
    const r = Math.hypot(w, h) / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, from);
    if (via) g.addColorStop(0.5, via);
    g.addColorStop(1, to);
    return g;
  }
  const { x1, y1, x2, y2 } = cssGradientLine(x, y, w, h, a.gradientAngle ?? 135);
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, from);
  if (via) g.addColorStop(0.5, via);
  g.addColorStop(1, to);
  return g;
}

/** Builds SVG <defs> markup for a gradient, returning the def string and the
 *  fill/stroke reference url(#id). */
export function annotationSvgGradientDef(
  a: Annotation,
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): { def: string; ref: string } | null {
  if (!hasAnnotationGradient(a)) return null;
  const from = escapeAttr(a.gradientFrom!);
  const to = escapeAttr(a.gradientTo!);
  const via = a.gradientVia ? escapeAttr(a.gradientVia) : null;
  if (a.gradientType === "radial") {
    // userSpaceOnUse with the exact farthest-corner circle so the gradient
    // matches the CSS preview; objectBoundingBox with r="50%" would degrade
    // the circle into an ellipse on non-square boxes.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.hypot(w, h) / 2;
    const def = `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}"><stop offset="0%" stop-color="${from}"/>${via ? `<stop offset="50%" stop-color="${via}"/>` : ""}<stop offset="100%" stop-color="${to}"/></radialGradient>`;
    return { def, ref: `url(#${id})` };
  }
  // Percent coordinates of the CSS gradient line (through the box center),
  // expressed in objectBoundingBox fractions so the direction matches the
  // preview for any box aspect.
  const { x1, y1, x2, y2 } = cssGradientLine(0, 0, w, h, a.gradientAngle ?? 135);
  const x1pct = 50 + ((x1 - w / 2) / w) * 100;
  const y1pct = 50 + ((y1 - h / 2) / h) * 100;
  const x2pct = 50 + ((x2 - w / 2) / w) * 100;
  const y2pct = 50 + ((y2 - h / 2) / h) * 100;
  const def = `<linearGradient id="${id}" x1="${num(x1pct)}%" y1="${num(y1pct)}%" x2="${num(x2pct)}%" y2="${num(y2pct)}%"><stop offset="0%" stop-color="${from}"/>${via ? `<stop offset="50%" stop-color="${via}"/>` : ""}<stop offset="100%" stop-color="${to}"/></linearGradient>`;
  return { def, ref: `url(#${id})` };
}

function num(n: number): string {
  return Number(n.toFixed(2)).toString();
}
