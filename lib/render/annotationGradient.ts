import type { Annotation } from "@/lib/types/editor";

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
    const r = Math.max(w, h) / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, from);
    if (via) g.addColorStop(0.5, via);
    g.addColorStop(1, to);
    return g;
  }
  const angle = ((a.gradientAngle ?? 135) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const len = Math.max(w, h) / 2;
  const g = ctx.createLinearGradient(
    cx - Math.cos(angle) * len,
    cy - Math.sin(angle) * len,
    cx + Math.cos(angle) * len,
    cy + Math.sin(angle) * len
  );
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
  const from = a.gradientFrom!;
  const to = a.gradientTo!;
  const via = a.gradientVia;
  if (a.gradientType === "radial") {
    const def = `<radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${from}"/>${via ? `<stop offset="50%" stop-color="${via}"/>` : ""}<stop offset="100%" stop-color="${to}"/></radialGradient>`;
    return { def, ref: `url(#${id})` };
  }
  const angle = a.gradientAngle ?? 135;
  const rad = (angle * Math.PI) / 180;
  const x1 = 50 - Math.cos(rad) * 50;
  const y1 = 50 - Math.sin(rad) * 50;
  const x2 = 50 + Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;
  const def = `<linearGradient id="${id}" x1="${num(x1)}%" y1="${num(y1)}%" x2="${num(x2)}%" y2="${num(y2)}%"><stop offset="0%" stop-color="${from}"/>${via ? `<stop offset="50%" stop-color="${via}"/>` : ""}<stop offset="100%" stop-color="${to}"/></linearGradient>`;
  return { def, ref: `url(#${id})` };
}

function num(n: number): string {
  return Number(n.toFixed(2)).toString();
}
