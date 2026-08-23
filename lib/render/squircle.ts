import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec, type FrameSpec } from "@/lib/render/frames";

/** Corner curve exponent in the parametric form x=r·cos(t)^p, y=r·sin(t)^p.
 *  1 = circular arc — matches real device vectors (e.g. the iPhone 16 outline,
 *  whose corner bezier handle ratio 0.554 ≈ the 0.5523 of a circle). Devices
 *  with Apple's fuller continuous corner (Apple Watch) use 0.5, which yields
 *  an n≈4 superellipse: at 45° it sits 19% farther out than a circle. */
export const CORNER_POWER_CIRCLE = 1;
export const CORNER_POWER_SQUIRCLE = 0.5;
export const SQUIRCLE_STEPS = 24;

type Pt = [number, number];

function corner(cx: number, cy: number, sx: number, sy: number, rx: number, ry: number, reverse: boolean, power: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= SQUIRCLE_STEPS; i++) {
    const k = reverse ? SQUIRCLE_STEPS - i : i;
    const th = (k / SQUIRCLE_STEPS) * (Math.PI / 2);
    pts.push([cx + sx * rx * Math.pow(Math.cos(th), power), cy + sy * ry * Math.pow(Math.sin(th), power)]);
  }
  return pts;
}

export function squirclePoints(w: number, h: number, rx: number, ry: number = rx, power: number = CORNER_POWER_CIRCLE): Pt[] {
  const pts: Pt[] = [[rx, 0], [w - rx, 0]];
  pts.push(...corner(w - rx, ry, 1, -1, rx, ry, true, power));
  pts.push([w, h - ry]);
  pts.push(...corner(w - rx, h - ry, 1, 1, rx, ry, false, power));
  pts.push([rx, h]);
  pts.push(...corner(rx, h - ry, -1, 1, rx, ry, true, power));
  pts.push([0, h - ry]);
  pts.push(...corner(rx, ry, -1, -1, rx, ry, false, power));
  return pts;
}

const f2 = (n: number) => n.toFixed(2);

export function squirclePathD(x: number, y: number, w: number, h: number, rx: number, ry: number = rx, power: number = CORNER_POWER_CIRCLE): string {
  const pts = squirclePoints(w, h, rx, ry, power);
  const first = pts[0]!;
  let d = `M ${f2(x + first[0])} ${f2(y + first[1])} `;
  for (let i = 1; i < pts.length; i++) d += `L ${f2(x + pts[i]![0])} ${f2(y + pts[i]![1])} `;
  return d + "Z";
}

export function traceSquirclePath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  ry: number = rx,
  power: number = CORNER_POWER_CIRCLE
): void {
  ctx.beginPath();
  ctx.moveTo(x + rx, y);
  for (const [px, py] of squirclePoints(w, h, rx, ry, power)) ctx.lineTo(x + px, y + py);
  ctx.closePath();
}

/** Path in unit-box coordinates for clipPathUnits="objectBoundingBox": radii
 *  are fractions of the element's width/height so the px shape keeps a uniform
 *  corner radius once the browser stretches the unit box onto the element. */
export function squircleUnitD(rux: number, ruy: number, power: number = CORNER_POWER_CIRCLE): string {
  // Unit-box coordinates get 6 decimals: at 2 decimals a 0.01 quantization
  // step is ~4px on a 400px element, which renders as a visible staircase.
  const f6 = (n: number) => n.toFixed(6);
  const pts = squirclePoints(1, 1, rux, ruy, power);
  const first = pts[0]!;
  let d = `M ${f6(first[0])} ${f6(first[1])} `;
  for (let i = 1; i < pts.length; i++) d += `L ${f6(pts[i]![0])} ${f6(pts[i]![1])} `;
  return d + "Z";
}

export interface OverlayClipDef {
  id: string;
  d: string;
}

export function overlayClipDefForSpec(spec: FrameSpec): OverlayClipDef | null {
  if (!spec.isOverlay || !spec.cutout) return null;
  const { cutout } = spec;
  const id = `mocksy-sq-${String(spec.asset ?? "frame").replace(/[^a-z0-9]/gi, "")}`;
  return { id, d: squircleUnitD(cutout.rx / cutout.w, cutout.rx / cutout.h, cutout.power ?? CORNER_POWER_CIRCLE) };
}

export function collectOverlayClipDefs(scene: EditorScene): OverlayClipDef[] {
  // Material-aware specs: the clip id is derived from the asset path, and
  // material variants use different assets (--silver/--white). The ids emitted
  // here must match the ones referenced by the media styles in buildSceneCss,
  // or the clip silently fails and the media loses its rounded corners.
  const specs: FrameSpec[] = [getFrameSpec(scene.frame, scene.customFrame, scene.frameMaterial)];
  for (const inst of scene.frameInstances) specs.push(getFrameSpec(inst.frame, scene.customFrame, inst.material));
  const byId = new Map<string, OverlayClipDef>();
  for (const spec of specs) {
    const def = overlayClipDefForSpec(spec);
    if (def) byId.set(def.id, def);
  }
  return [...byId.values()];
}
