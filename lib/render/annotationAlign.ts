import type { Annotation } from "@/lib/types/editor";

/** A normalized axis-aligned box (canvas fractions) derived from an
 *  annotation's signed w/h. Annotations may carry negative w/h, so callers
 *  must normalize before measuring/aligning — this helper does that once. */
export interface NormBox {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

/** Normalizes an annotation's signed w/h into a positive box. */
export function normBox(a: Annotation): NormBox {
  const left = Math.min(a.x, a.x + a.w);
  const top = Math.min(a.y, a.y + a.h);
  const right = Math.max(a.x, a.x + a.w);
  const bottom = Math.max(a.y, a.y + a.h);
  return { id: a.id, left, top, right, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 };
}

/** Bounding box enclosing every supplied annotation (or null when empty). */
export function selectionBounds(boxes: NormBox[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.left);
    minY = Math.min(minY, b.top);
    maxX = Math.max(maxX, b.right);
    maxY = Math.max(maxY, b.bottom);
  }
  return { minX, minY, maxX, maxY };
}

export type AlignOp = "left" | "centerH" | "right" | "top" | "centerV" | "bottom";
export type DistributeOp = "horizontal" | "vertical";

/**
 * Computes per-id x/y patches that align a set of annotations. With a single
 * annotation the target is the canvas (0/0.5/1); with two or more it is the
 * bounding box of the selection. Each patch keeps the annotation's size, so we
 * only shift its origin. `getW`/`getH` read signed w/h so negative boxes keep
 * their orientation.
 */
export function alignAnnotations(
  anns: Annotation[],
  op: AlignOp
): Record<string, { x: number; y: number }> {
  const boxes = anns.map(normBox);
  // A single annotation has no peers to align against, so it aligns to the
  // canvas (0/0.5/1) instead of collapsing onto its own bounding box, which
  // would be a no-op.
  const target = anns.length === 1
    ? { minX: 0, maxX: 1, minY: 0, maxY: 1 }
    : selectionBounds(boxes) ?? { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  const patches: Record<string, { x: number; y: number }> = {};
  for (const a of anns) {
    const w = a.w;
    const h = a.h;
    let x = a.x;
    let y = a.y;
    const right = a.x + w;
    const bottom = a.y + h;
    switch (op) {
      case "left":
        x = target.minX;
        break;
      case "centerH":
        x = (target.minX + target.maxX) / 2 - w / 2;
        break;
      case "right":
        x = target.maxX - w;
        break;
      case "top":
        y = target.minY;
        break;
      case "centerV":
        y = (target.minY + target.maxY) / 2 - h / 2;
        break;
      case "bottom":
        y = target.maxY - h;
        break;
    }
    void right;
    void bottom;
    patches[a.id] = { x, y };
  }
  return patches;
}

/**
 * Distributes three or more annotations with equal spacing. Horizontal spreads
 * them along the X axis (left edges spaced evenly across the selection span,
 * preserving order by current left); vertical does the same along Y. Returns an
 * empty patch set for fewer than three annotations so the caller can disable
 * the action rather than silently doing nothing.
 */
export function distributeAnnotations(
  anns: Annotation[],
  op: DistributeOp
): Record<string, { x: number; y: number }> {
  if (anns.length < 3) return {};
  const boxes = anns.map(normBox);
  const sorted = [...boxes].sort((p, q) => (op === "horizontal" ? p.left - q.left : p.top - q.top));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const start = op === "horizontal" ? first.left : first.top;
  const end = op === "horizontal" ? last.right : last.bottom;
  // Total span minus the combined size of every item gives the free space to
  // spread across (n-1) gaps. Each item's leading edge lands at start + i*gap.
  const sizes = sorted.map((b) => (op === "horizontal" ? b.right - b.left : b.bottom - b.top));
  const totalSize = sizes.reduce((s, v) => s + v, 0);
  const gap = (end - start - totalSize) / (sorted.length - 1);
  const patches: Record<string, { x: number; y: number }> = {};
  let cursor = start;
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i]!;
    const w = anns.find((a) => a.id === b.id)!.w;
    const h = anns.find((a) => a.id === b.id)!.h;
    if (op === "horizontal") {
      // Preserve orientation: shift the origin so the box's left edge sits at
      // the computed position.
      const newLeft = cursor;
      const newX = w >= 0 ? newLeft : newLeft + w;
      patches[b.id] = { x: newX, y: anns.find((a) => a.id === b.id)!.x };
    } else {
      const newTop = cursor;
      const newY = h >= 0 ? newTop : newTop + h;
      patches[b.id] = { x: anns.find((a) => a.id === b.id)!.x, y: newY };
    }
    cursor += (sizes[i] ?? 0) + gap;
  }
  return patches;
}

export interface GuideLine {
  /** "x" for a vertical guide line at fraction `pos`; "y" for a horizontal one. */
  axis: "x" | "y";
  /** Canvas fraction (0..1) where the guide line sits. */
  pos: number;
}

export interface SmartGuideResult {
  /** Adjusted origin (canvas fractions) for the dragged annotation. */
  x: number;
  y: number;
  /** Guides to render while dragging. */
  guides: GuideLine[];
}

/** Candidate snap targets shared by every dragged box: the canvas edges and
 *  centerlines plus the edges/centers of the other boxes on that axis. */
function axisTargets(others: NormBox[], axis: "x" | "y"): number[] {
  if (axis === "x") return [0, 0.5, 1, ...others.flatMap((b) => [b.left, b.right, b.cx])];
  return [0, 0.5, 1, ...others.flatMap((b) => [b.top, b.bottom, b.cy])];
}

/** Finds the closest probe/target pairing within `threshold`. Returns the
 *  shift needed to move the probe onto its target (plus the target itself for
 *  guide rendering), or null when nothing is close enough to snap. */
function bestAxisSnap(
  probes: number[],
  targets: number[],
  threshold: number
): { shift: number; guide: number } | null {
  let bestDist = Infinity;
  let bestProbe = Infinity;
  let bestTarget = Infinity;
  for (const probe of probes) {
    for (const target of targets) {
      const dist = Math.abs(probe - target);
      if (dist < bestDist) {
        bestDist = dist;
        bestProbe = probe;
        bestTarget = target;
      }
    }
  }
  if (!Number.isFinite(bestProbe) || bestDist > threshold) return null;
  return { shift: bestTarget - bestProbe, guide: bestTarget };
}

/**
 * Snaps a dragged annotation to the canvas centerlines and to the edges/centers
 * of the other annotations, within `threshold` canvas fractions. Returns the
 * adjusted origin plus the guide lines that should be drawn. Pure and DOM-free
 * so it can be unit-tested against synthetic annotation lists.
 */
export function computeSmartGuide(
  dragging: Annotation,
  others: Annotation[],
  threshold = 0.02
): SmartGuideResult {
  const box = normBox(dragging);
  const otherBoxes = others.map(normBox);
  const xTargets = axisTargets(otherBoxes, "x");
  const yTargets = axisTargets(otherBoxes, "y");

  // The dragged box has three probe points per axis too (left/center/right).
  const guides: GuideLine[] = [];
  let x = box.left;
  let y = box.top;

  const xSnap = bestAxisSnap([box.left, box.cx, box.right], xTargets, threshold);
  if (xSnap) {
    x += xSnap.shift;
    guides.push({ axis: "x", pos: xSnap.guide });
  }

  const ySnap = bestAxisSnap([box.top, box.cy, box.bottom], yTargets, threshold);
  if (ySnap) {
    y += ySnap.shift;
    guides.push({ axis: "y", pos: ySnap.guide });
  }

  // Preserve the dragged annotation's signed w/h by re-deriving origin from
  // the snapped left/top.
  const newX = dragging.w >= 0 ? x : x + dragging.w;
  const newY = dragging.h >= 0 ? y : y + dragging.h;
  return { x: newX, y: newY, guides };
}

/** A centered box (e.g. a frame instance): center point plus half-extents,
 *  all as fractions of the canvas. */
export interface CenteredBox {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

/**
 * Snaps a centered box (frame instance drag) to the canvas edges/centerlines
 * and to the edges/centers of sibling boxes, mirroring computeSmartGuide but
 * for center-anchored geometry: inst.x/y is the box CENTER, so after snapping
 * the probed left/top edges the center is re-derived instead of an origin.
 * Pure and DOM-free for unit testing.
 */
export function snapCenteredBox(
  dragging: CenteredBox,
  others: NormBox[],
  threshold = 0.02
): SmartGuideResult {
  const box: NormBox = {
    id: "",
    left: dragging.x - dragging.halfW,
    top: dragging.y - dragging.halfH,
    right: dragging.x + dragging.halfW,
    bottom: dragging.y + dragging.halfH,
    cx: dragging.x,
    cy: dragging.y
  };
  const xTargets = axisTargets(others, "x");
  const yTargets = axisTargets(others, "y");
  const guides: GuideLine[] = [];
  let x = dragging.x;
  let y = dragging.y;

  const xSnap = bestAxisSnap([box.left, box.cx, box.right], xTargets, threshold);
  if (xSnap) {
    x += xSnap.shift;
    guides.push({ axis: "x", pos: xSnap.guide });
  }

  const ySnap = bestAxisSnap([box.top, box.cy, box.bottom], yTargets, threshold);
  if (ySnap) {
    y += ySnap.shift;
    guides.push({ axis: "y", pos: ySnap.guide });
  }

  return { x, y, guides };
}
