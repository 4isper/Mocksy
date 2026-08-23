import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec, type FrameSpec } from "@/lib/render/frames";

export const SQUIRCLE_POWER = 0.5;
export const SQUIRCLE_STEPS = 24;

type Pt = [number, number];

function corner(cx: number, cy: number, sx: number, sy: number, rx: number, ry: number, reverse: boolean): Pt[] {
  const pts: Pt[] = [];
  for (let i = 1; i <= SQUIRCLE_STEPS; i++) {
    const k = reverse ? SQUIRCLE_STEPS - i : i;
    const th = (k / SQUIRCLE_STEPS) * (Math.PI / 2);
    pts.push([cx + sx * rx * Math.pow(Math.cos(th), SQUIRCLE_POWER), cy + sy * ry * Math.pow(Math.sin(th), SQUIRCLE_POWER)]);
  }
  return pts;
}

export function squirclePoints(w: number, h: number, rx: number, ry: number = rx): Pt[] {
  const pts: Pt[] = [[rx, 0], [w - rx, 0]];
  pts.push(...corner(w - rx, ry, 1, -1, rx, ry, true));
  pts.push([w, h - ry]);
  pts.push(...corner(w - rx, h - ry, 1, 1, rx, ry, false));
  pts.push([rx, h]);
  pts.push(...corner(rx, h - ry, -1, 1, rx, ry, true));
  pts.push([0, h - ry]);
  pts.push(...corner(rx, ry, -1, -1, rx, ry, false));
  return pts;
}

const f2 = (n: number) => n.toFixed(2);

export function squirclePathD(x: number, y: number, w: number, h: number, rx: number, ry: number = rx): string {
  const pts = squirclePoints(w, h, rx, ry);
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
  ry: number = rx
): void {
  ctx.beginPath();
  ctx.moveTo(x + rx, y);
  for (const [px, py] of squirclePoints(w, h, rx, ry)) ctx.lineTo(x + px, y + py);
  ctx.closePath();
}

/** Path in unit-box coordinates for clipPathUnits="objectBoundingBox": radii
 *  are fractions of the element's width/height so the px shape keeps a uniform
 *  corner radius once the browser stretches the unit box onto the element. */
export function squircleUnitD(rux: number, ruy: number): string {
  const pts = squirclePoints(1, 1, rux, ruy);
  const first = pts[0]!;
  let d = `M ${f2(first[0])} ${f2(first[1])} `;
  for (let i = 1; i < pts.length; i++) d += `L ${f2(pts[i]![0])} ${f2(pts[i]![1])} `;
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
  return { id, d: squircleUnitD(cutout.rx / cutout.w, cutout.rx / cutout.h) };
}

export function collectOverlayClipDefs(scene: EditorScene): OverlayClipDef[] {
  const specs: FrameSpec[] = [getFrameSpec(scene.frame, scene.customFrame)];
  for (const inst of scene.frameInstances) specs.push(getFrameSpec(inst.frame, scene.customFrame));
  const byId = new Map<string, OverlayClipDef>();
  for (const spec of specs) {
    const def = overlayClipDefForSpec(spec);
    if (def) byId.set(def.id, def);
  }
  return [...byId.values()];
}
