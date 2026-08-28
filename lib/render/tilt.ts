/**
 * 3D tilt of the mockup (device + media) around its center. The same
 * projection math is shared by every renderer so preview, PNG/WebP, HTML,
 * SVG and video exports all agree on the geometry:
 *   - CSS preview / HTML export use a real 3D transform
 *     `perspective(Dpx) rotateX(tiltY) rotateY(tiltX)`.
 *   - Canvas exports project the frame's four corners through the same
 *     rotation + perspective and warp the flat composite into that quad.
 *   - SVG (which has no perspective) gets the affine best-fit parallelogram
 *     through the projected top-left / top-right / bottom-left corners.
 */
import type { EditorScene } from "@/lib/types/editor";

export const TILT_LIMIT = 25;
/** Camera distance (CSS px) used by the perspective projection. */
export const TILT_PERSPECTIVE = 1200;
/** Warp granularity for the canvas perspective drawing. */
export const TILT_SUBDIVISIONS = 20;

export interface Point {
  x: number;
  y: number;
}

export interface Quad {
  tl: Point;
  tr: Point;
  bl: Point;
  br: Point;
}

export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function hasTilt(scene: Pick<EditorScene, "tiltX" | "tiltY">): boolean {
  return Math.abs(scene.tiltX) > 0.01 || Math.abs(scene.tiltY) > 0.01;
}

/**
 * CSS transform prefix producing the same 3D look as the canvas projection.
 * `projectPoint` mirrors this exact order: CSS post-multiplies the function
 * list (rightmost `rotateX` applied first to the point, then `rotateY`).
 */
export function tiltCss(scene: Pick<EditorScene, "tiltX" | "tiltY">): string {
   if (!hasTilt(scene)) return "";
   return `perspective(${TILT_PERSPECTIVE}px) rotateY(${scene.tiltX}deg) rotateX(${scene.tiltY}deg) `;
}

export function projectPoint(dx: number, dy: number, tiltX: number, tiltY: number, perspective: number): Point {
  const rotY = (tiltX * Math.PI) / 180;
  const rotX = (tiltY * Math.PI) / 180;
  // Mirror the CSS transform `perspective() rotateY(tiltX) rotateX(tiltY)`.
  // CSS post-multiplies the matrix list, so the rightmost function (rotateX)
  // is applied to the point first, then rotateY — not the other way around.
  // rotateX (around horizontal axis) first:
  const xr = dx;
  const yr = dy * Math.cos(rotX);
  const zr = dy * Math.sin(rotX);
  // rotateY (around vertical axis): matches CSS rotateY(θ): z' = -x·sinθ + z·cosθ
  const x1 = xr * Math.cos(rotY) + zr * Math.sin(rotY);
  const z2 = -xr * Math.sin(rotY) + zr * Math.cos(rotY);
  const denom = perspective - z2;
  const scale = Math.abs(denom) < 1e-6 ? perspective : perspective / denom;
  return { x: x1 * scale, y: yr * scale };
}

/**
 * Projects an axis-aligned rect rotated by `tiltX` (left/right) and `tiltY`
 * (up/down) about its center, seen from `perspective` px away. Returns the
 * destination quad in the same coordinate space as the rect.
 */
export function projectTiltedRect(rect: RectLike, tiltX: number, tiltY: number, perspective: number = TILT_PERSPECTIVE): Quad {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const p = (dx: number, dy: number) => {
    const proj = projectPoint(dx, dy, tiltX, tiltY, perspective);
    return { x: cx + proj.x, y: cy + proj.y };
  };
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  return {
    tl: p(-halfW, -halfH),
    tr: p(halfW, -halfH),
    bl: p(-halfW, halfH),
    br: p(halfW, halfH)
  };
}

/**
 * Affine best-fit of the tilted rect (parallelogram through the projected
 * top-left / top-right / bottom-left corners) for SVG, which cannot express a
 * perspective projection. Returns an SVG `matrix(a b c d e f)` string or ""
 * when there is no tilt.
 */
export function tiltMatrixSvg(scene: Pick<EditorScene, "tiltX" | "tiltY">, rect: RectLike, perspective: number = TILT_PERSPECTIVE): string {
  if (!hasTilt(scene)) return "";
  const quad = projectTiltedRect(rect, scene.tiltX, scene.tiltY, perspective);
  const a = (quad.tr.x - quad.tl.x) / rect.width;
  const b = (quad.tr.y - quad.tl.y) / rect.width;
  const c = (quad.bl.x - quad.tl.x) / rect.height;
  const d = (quad.bl.y - quad.tl.y) / rect.height;
  const fmt = (n: number) => String(Math.round(n * 100) / 100);
  return `matrix(${fmt(a)} ${fmt(b)} ${fmt(c)} ${fmt(d)} ${fmt(quad.tl.x)} ${fmt(quad.tl.y)})`;
}

/** Bilinear interpolation inside a quad for one unit-space coordinate. */
function quadAt(quad: Quad, u: number, v: number): Point {
  const topX = quad.tl.x + (quad.tr.x - quad.tl.x) * u;
  const topY = quad.tl.y + (quad.tr.y - quad.tl.y) * u;
  const botX = quad.bl.x + (quad.br.x - quad.bl.x) * u;
  const botY = quad.bl.y + (quad.br.y - quad.bl.y) * u;
  return { x: topX + (botX - topX) * v, y: topY + (botY - topY) * v };
}

/**
 * Draws a flat source canvas warped into the projected quad using a grid of
 * affine quads — the standard "perspective texture mapping" approximation.
 * Straight edges of a plane project to straight edges, so the quad outline is
 * exact; only the interior sampling is piecewise-affine.
 */
export function drawTiltedQuad(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { width: number; height: number },
  quad: Quad,
  subdivisions: number = TILT_SUBDIVISIONS
): void {
  const sw = source.width;
  const sh = source.height;
  if (sw === 0 || sh === 0) return;

  // Anti-aliasing on each tile's clip edge leaves a hairline gap between
  // adjacent tiles ("puzzle" seams), worse at steeper tilts. Expanding each
  // tile's source and destination slightly beyond its exact cell so neighbors
  // overlap by a small margin hides the seam without visibly distorting the
  // image (the overlap is sub-pixel in source space).
  const EPS_U = 0.5 / subdivisions;
  const EPS_V = 0.5 / subdivisions;

  for (let v = 0; v < subdivisions; v++) {
    const v0 = Math.max(0, v / subdivisions - EPS_V);
    const v1 = Math.min(1, (v + 1) / subdivisions + EPS_V);
    for (let u = 0; u < subdivisions; u++) {
      const u0 = Math.max(0, u / subdivisions - EPS_U);
      const u1 = Math.min(1, (u + 1) / subdivisions + EPS_U);

      const p00 = quadAt(quad, u0, v0);
      const p10 = quadAt(quad, u1, v0);
      const p01 = quadAt(quad, u0, v1);
      const p11 = quadAt(quad, u1, v1);
      const sx = u0 * sw;
      const sy = v0 * sh;
      const subW = (u1 - u0) * sw;
      const subH = (v1 - v0) * sh;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.clip();
      ctx.transform(
        (p10.x - p00.x) / subW,
        (p10.y - p00.y) / subW,
        (p01.x - p00.x) / subH,
        (p01.y - p00.y) / subH,
        p00.x,
        p00.y
      );
      ctx.drawImage(source, sx, sy, subW, subH, 0, 0, subW, subH);
      ctx.restore();
    }
  }
}
