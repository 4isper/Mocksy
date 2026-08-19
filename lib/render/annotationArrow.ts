import type { Annotation } from "@/lib/types/editor";

export interface ArrowGeometry {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  points: string;
}

/**
 * Computes the SVG line + arrowhead geometry for an arrow annotation. All
 * values are in canvas pixels so the stroke width and arrowhead match the
 * exported PNG exactly. `bx`/`by` are the box's top-left in fraction space
 * (already normalized so the arrow points in the right direction regardless of
 * the sign of w/h), and `canvasW`/`canvasH` are the laid-out canvas size.
 */
export function computeArrowGeometry(
  annotation: Annotation,
  canvasW: number,
  canvasH: number,
  bx: number,
  by: number
): ArrowGeometry {
  const cw = canvasW || 1;
  const ch = canvasH || 1;
  const startX = (annotation.x - bx) * cw;
  const startY = (annotation.y - by) * ch;
  const endX = startX + annotation.w * cw;
  const endY = startY + annotation.h * ch;
  const angle = Math.atan2(endY - startY, endX - startX);
  const head = 14;
  const a1 = angle + Math.PI - 0.45;
  const a2 = angle + Math.PI + 0.45;
  const points = `${endX},${endY} ${endX + head * Math.cos(a1)},${endY + head * Math.sin(a1)} ${endX + head * Math.cos(a2)},${endY + head * Math.sin(a2)}`;
  return { startX, startY, endX, endY, points };
}
