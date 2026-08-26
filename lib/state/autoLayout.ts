import type { CustomFrame, FrameInstance, LayoutPreset, MockupFrame } from "@/lib/types/editor";
import { nextFrameInstanceId } from "@/lib/state/ids";
import { frameInstAr } from "@/lib/render/frames";

export { nextFrameInstanceId };

export const LAYOUT_PRESETS: LayoutPreset[] = ["grid", "fan", "cascade", "masonry", "stack"];

/**
 * Creates a horizontal or vertical grid of frame instances.
 * x = (i / (count-1)) for spacing, y = 0.5 (centered vertically).
 * Each frame gets a layerId pointing to the corresponding layer.
 */
export function layoutFrameGrid(
  frame: MockupFrame,
  count: number,
  direction: "horizontal" | "vertical",
  aspectRatio = "16 / 9",
  customFrame: CustomFrame | null = null
): FrameInstance[] {
  if (count < 1) return [];
  const gap = 0.02;
  const s = (1 - gap * (count - 1)) / count;
  const instAr = frameInstAr(frame, customFrame, aspectRatio);
  const [w, h] = aspectRatio.split(" / ").map(Number);
  const sceneRatio = (w ?? 16) / (h ?? 9);
  // The width fit (s) alone makes portrait frames taller than the canvas and
  // they get clipped by the preview/export canvas edge. Cap the scale so the
  // instance height (scale * canvasW * instAr) never exceeds the canvas
  // height. Null-aspect frames ("none") follow the scene and always fit.
  const heightCap = instAr ? 1 / (sceneRatio * instAr) : 1;
  const scale = Math.min(s, heightCap);
  const pitch = s + gap;
  return Array.from({ length: count }, (_, i) => ({
    id: nextFrameInstanceId(),
    frame,
    x: direction === "horizontal" ? i * pitch + s / 2 : 0.5,
    y: direction === "vertical" ? i * pitch + s / 2 : 0.5,
    scale,
    layerId: null
  }));
}

/**
 * Auto-layout presets for multi-frame scenes. Each algorithm computes
 * positioning (x, y as fractions 0..1) and scale for every frame.
 * The caller is responsible for assigning layerIds and appending new layers.
 */
export function buildAutoLayout(
  frame: MockupFrame,
  count: number,
  layout: LayoutPreset,
  aspectRatio: string,
  customFrame: CustomFrame | null = null
): FrameInstance[] {
  if (count < 1) return [];
  const gap = 0.02;
  const instAr = frameInstAr(frame, customFrame, aspectRatio);
  const [w, h] = aspectRatio.split(" / ").map(Number);
  const sceneRatio = (w ?? 16) / (h ?? 9);

  switch (layout) {
    case "grid":
      return buildGrid(frame, count, gap, instAr, sceneRatio);
    case "fan":
      return buildFan(frame, count, gap, instAr, sceneRatio);
    case "cascade":
      return buildCascade(frame, count, gap, instAr, sceneRatio);
    case "masonry":
      return buildMasonry(frame, count, gap, instAr, sceneRatio);
    case "stack":
      return buildStack(frame, count, gap, instAr, sceneRatio);
    default:
      return buildGrid(frame, count, gap, instAr, sceneRatio);
  }
}

function buildGrid(
  frame: MockupFrame,
  count: number,
  gap: number,
  instAr: number | null,
  sceneRatio: number
): FrameInstance[] {
  if (count <= 0) return [];
  // Try to keep cells close to square. Compute cols so cell ratio ~ 1.
  // cellW/cellH ~ sceneAR, use cols = ceil(sqrt(count * sceneAR))
  const cols = Math.max(1, Math.min(count, Math.round(Math.sqrt(count * sceneRatio))));
  const rows = Math.ceil(count / cols);
  const cellW = (1 - gap * (cols - 1)) / cols;
  const cellH = (1 - gap * (rows - 1)) / rows;
  // Instance height = scale * sceneRatio * instAr (canvas fractions); the
  // cell-height cap keeps every instance inside its cell. Null-aspect frames
  // ("none") follow the scene and only need to fit the cell height.
  const scale = Math.min(cellW, instAr ? cellH / (sceneRatio * instAr) : cellH);

  return Array.from({ length: count }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      id: nextFrameInstanceId(),
      frame,
      x: c * (cellW + gap) + cellW / 2,
      y: r * (cellH + gap) + cellH / 2,
      scale,
      layerId: null
    };
  });
}

function buildFan(
  frame: MockupFrame,
  count: number,
  gap: number,
  instAr: number | null,
  sceneRatio: number
): FrameInstance[] {
  // Arc from -30deg to +30deg, centered at bottom center of canvas.
  // Each frame is placed on the arc and rotated so the screens face outward.
  const radius = 0.45; // Distance from pivot to frame center
  const startAngle = -0.45; // radians (~ -25deg)
  const endAngle = 0.45;
  // Pivot at bottom center (0.5, 0.9)
  const pivotX = 0.5;
  const pivotY = 0.88;
  // The arc keeps every center below y ≈ 0.637, so the tightest margin is the
  // bottom. Cap the scale so tall portrait frames stay inside the canvas.
  const verticalMargin = 1 - (pivotY - Math.cos(startAngle) * radius * 0.6);
  // Adjacent centers are spaced ~radius*cos(midAngle)*Δangle apart along x; cap
  // the frame width to that gap so a large count doesn't pile frames on top of
  // each other (the old 0.28 floor let them overlap badly past ~4 frames).
  const step = count > 1 ? (endAngle - startAngle) / (count - 1) : 1;
  const horizontalGap = 2 * radius * Math.cos((startAngle + endAngle) / 2) * Math.sin(step / 2);
  const scale = Math.min(
    0.28,
    Math.max(0.08, horizontalGap * 0.9),
    instAr ? (2 * verticalMargin) / (sceneRatio * instAr) : 1
  );

  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const angle = startAngle + t * (endAngle - startAngle);
    // Pivot at bottom center (0.5, 0.9)
    const x = pivotX + Math.sin(angle) * radius;
    const y = pivotY - Math.cos(angle) * radius * 0.6; // flattened arc
    return {
      id: nextFrameInstanceId(),
      frame,
      x: Math.max(scale / 2, Math.min(1 - scale / 2, x)),
      y: Math.max(scale / 2, Math.min(1 - scale / 2, y)),
      scale: Math.max(0.08, scale),
      layerId: null
    };
  });
}

function buildCascade(
  frame: MockupFrame,
  count: number,
  gap: number,
  instAr: number | null,
  sceneRatio: number
): FrameInstance[] {
  // Diagonal cascade: each frame offset by (dx, dy) from previous.
  // Start top-left, cascade to bottom-right. Half-extents (canvas fractions):
  // halfW = scale/2, halfH = scale*sceneRatio*instAr/2; the steps share the
  // remaining extent, so everything stays inside with a gap margin. For
  // portrait frames the scale is driven by the height: halfH ≤ (1-2*gap)/2.
  const halfCap = instAr ? (1 - 2 * gap) / (2 * sceneRatio * instAr) : 1;
  const scale = Math.min(0.35, 1 / (count * 0.35 + 0.5), halfCap);
  const halfW = scale / 2;
  const halfH = instAr ? (scale * sceneRatio * instAr) / 2 : scale / 2;
  const dx = (1 - 2 * gap - halfW * 2) / Math.max(1, count - 1);
  const dy = (1 - 2 * gap - halfH * 2) / Math.max(1, count - 1);

  return Array.from({ length: count }, (_, i) => ({
    id: nextFrameInstanceId(),
    frame,
    x: gap + halfW + i * dx,
    y: gap + halfH + i * dy,
    scale,
    layerId: null
  }));
}

function buildMasonry(
  frame: MockupFrame,
  count: number,
  gap: number,
  instAr: number | null,
  sceneRatio: number
): FrameInstance[] {
  // Two-column masonry with alternating tall/short cells.
  const cols = 2;
  const rows = Math.ceil(count / cols);
  const cellW = (1 - gap) / cols;
  const cellH = (1 - gap * (rows - 1)) / rows;
  // Instance height = scale * sceneRatio * instAr (canvas fractions); cap so
  // the tall column fits its cell height (null-aspect frames follow the scene).
  const baseScale = Math.min(cellW, instAr ? cellH / (sceneRatio * instAr) : cellH);

  return Array.from({ length: count }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    // Alternate tall/short per column for visual interest
    const isTall = (c + r) % 2 === 0;
    const s = isTall ? baseScale : baseScale * 0.75;
    return {
      id: nextFrameInstanceId(),
      frame,
      x: c * (cellW + gap) + cellW / 2,
      y: r * (cellH + gap) + cellH / 2,
      scale: Math.max(0.08, s),
      layerId: null
    };
  });
}

function buildStack(
  frame: MockupFrame,
  count: number,
  gap: number,
  instAr: number | null,
  sceneRatio: number
): FrameInstance[] {
  // Stack with visible offset so each frame is partially visible behind the next.
  // The first row sits at y = 0.35, so the scale is capped so half the frame
  // height fits above it; the offset then spreads the rows below.
  const topRoom = 0.35;
  const halfCap = instAr ? (2 * topRoom) / (sceneRatio * instAr) : 1;
  const scale = Math.min(0.38, 1.1 / count, halfCap);
  const halfH = instAr ? (scale * sceneRatio * instAr) / 2 : scale / 2;
  const rows = Math.ceil(count / 2);
  // rows-1 is 0 when count<=2 — spread those frames horizontally instead of
  // stacking them on the exact same y (which would fully overlap and hide all
  // but one). When there are real rows, use the vertical step computed above.
  const offset = rows > 1 ? Math.min(0.06, (1 - gap - halfH - topRoom) / (rows - 1)) : 0;
  // Snake pattern: right, down-left, right, down-right. The two-per-row x
  // split already separates frames in multi-row stacks; for a single row we
  // widen the split so both frames stay visible.
  const xSpread = rows > 1 ? 0.15 : Math.min(0.25, 0.5 - scale / 2 - gap);
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const xDir = row % 2 === 0 ? 1 : -1;
    const baseX = 0.5 + (col === 0 ? -xSpread : xSpread) * xDir;
    const baseY = 0.35 + row * offset;
    return {
      id: nextFrameInstanceId(),
      frame,
      x: Math.max(scale / 2, Math.min(1 - scale / 2, baseX)),
      y: Math.max(scale / 2, Math.min(1 - scale / 2, baseY)),
      scale: Math.max(0.08, scale),
      layerId: null
    };
  });
}
