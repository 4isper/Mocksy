import type {
  Annotation,
  AnnotationType,
  EditorScene,
  FrameInstance,
  MediaLayer,
  MediaType,
  MockupFrame,
  StylePreset,
  VideoQuality,
  WatermarkPosition
} from "@/lib/types/editor";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";
import type { LayoutPreset } from "@/lib/types/editor";
import { countOf, nextAnnotationId, nextFrameInstanceId, nextLayerId } from "@/lib/state/ids";

export { nextLayerId, nextFrameInstanceId, nextAnnotationId };

const ANNOTATION_COLORS = ["#00d9ff", "#f87171", "#fbbf24", "#4ade80", "#c084fc", "#ffffff"];

export const LAYOUT_PRESETS: LayoutPreset[] = ["grid", "fan", "cascade", "masonry", "stack"];

export function makeAnnotation(type: AnnotationType): Annotation {
  const color = ANNOTATION_COLORS[countOf("anno") % ANNOTATION_COLORS.length] ?? "#00d9ff";
  const base = {
    id: nextAnnotationId(),
    type,
    color,
    strokeWidth: type === "text" ? 0 : 4,
    // Anchored near the center so a freshly added overlay is visible and
    // easy to grab, regardless of the current canvas aspect ratio.
    x: 0.32,
    y: 0.32
  };
  if (type === "text") {
    return { ...base, w: 0.36, h: 0, text: "Label", fontSize: 48, fontFamily: "Inter, system-ui, sans-serif", fontWeight: "bold", fontStyle: "normal", textAlign: "left", bgColor: null, bgPadding: 0, bgRadius: 0 };
  }
  if (type === "arrow") {
    return { ...base, w: 0.32, h: 0.2, text: "", fontSize: 0 };
  }
  if (type === "circle") {
    return { ...base, w: 0.2, h: 0.2, text: "", fontSize: 0 };
  }
  return { ...base, w: 0.28, h: 0.2, text: "", fontSize: 0 };
}

export function makeDemoLayer(): MediaLayer {
  return {
    id: nextLayerId(),
    mediaUrl: DEMO_MEDIA_URL,
    mediaType: "image",
    mediaName: DEMO_MEDIA_NAME,
    hidden: false,
    zoom: 1,
    mediaOffsetX: 0,
    mediaOffsetY: 0,
    mediaFit: "cover",
    animationPreset: "none",
    videoMuted: true,
    videoLoop: true,
    videoAutoplay: true,
    videoPosterTime: 0,
    videoDuration: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    videoQuality: "medium"
  };
}

const HISTORY_LIMIT = 100;
/** Edits of the same field within this window collapse into one undo step,
 *  so dragging a slider doesn't flood history with a record per pixel. */
const COALESCE_MS = 400;

type HistoryMutator = {
  past: EditorScene[];
  future: EditorScene[];
  scene: EditorScene;
  lastHistoryKey: string | null;
  lastHistoryAt: number;
};

/** Returns an object suitable for passing to Zustand's set(state => ...).
 *  Coalesces rapid repeats of the same field (e.g. slider drags) so undo
 *  returns to the pre-drag value rather than one pixel at a time. */
export function pushHistory(
  s: HistoryMutator,
  scene: EditorScene,
  coalesceKey?: string
): HistoryMutator {
  const now = Date.now();
  if (coalesceKey && coalesceKey === s.lastHistoryKey && now - s.lastHistoryAt < COALESCE_MS) {
    return { ...s, scene, lastHistoryAt: now };
  }
  const past = [...s.past, s.scene].slice(-HISTORY_LIMIT);
  return { past, future: [], scene, lastHistoryKey: coalesceKey ?? null, lastHistoryAt: now };
}

/** Returns the layer currently targeted by scene-level controls. */
export function activeLayer(scene: EditorScene): MediaLayer | undefined {
  return scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
}

/** Poster time of the active video layer (or 0 when none). */
export function activePosterTime(scene: EditorScene): number {
  const layer = activeLayer(scene);
  return layer?.videoPosterTime ?? 0;
}

/** Applies a patch to the active layer, returning a new layers array. */
export function patchActive(scene: EditorScene, patch: Partial<MediaLayer>): MediaLayer[] {
  const id = scene.activeLayerId ?? scene.layers[0]?.id;
  return scene.layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
}

/**
 * Creates a horizontal or vertical grid of frame instances.
 * x = (i / (count-1)) for spacing, y = 0.5 (centered vertically).
 * Each frame gets a layerId pointing to the corresponding layer.
 */
export function layoutFrameGrid(
  frame: MockupFrame,
  count: number,
  direction: "horizontal" | "vertical"
): FrameInstance[] {
  if (count < 1) return [];
  const gap = 0.02;
  const s = (1 - gap * (count - 1)) / count;
  const pitch = s + gap;
  return Array.from({ length: count }, (_, i) => ({
    id: nextFrameInstanceId(),
    frame,
    x: direction === "horizontal" ? i * pitch + s / 2 : 0.5,
    y: direction === "vertical" ? i * pitch + s / 2 : 0.5,
    scale: s,
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
  aspectRatio: string
): FrameInstance[] {
  if (count < 1) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const gap = 0.02;

  switch (layout) {
    case "grid":
      return buildGrid(frame, count, aspectRatio, gap);
    case "fan":
      return buildFan(frame, count, gap);
    case "cascade":
      return buildCascade(frame, count, gap);
    case "masonry":
      return buildMasonry(frame, count, aspectRatio, gap);
    case "stack":
      return buildStack(frame, count, gap);
    default:
      return buildGrid(frame, count, aspectRatio, gap);
  }
}

function buildGrid(
  frame: MockupFrame,
  count: number,
  aspectRatio: string,
  gap: number
): FrameInstance[] {
  if (count <= 0) return [];
  // Try to keep cells close to square. Compute cols so cell ratio ~ 1.
  // cellW/cellH ~ sceneAR, use cols = ceil(sqrt(count * sceneAR))
  const [w, h] = aspectRatio.split(" / ").map(Number);
  const sceneRatio = (w ?? 16) / (h ?? 9);
  const cols = Math.max(1, Math.min(count, Math.round(Math.sqrt(count * sceneRatio))));
  const rows = Math.ceil(count / cols);
  const cellW = (1 - gap * (cols - 1)) / cols;
  const cellH = (1 - gap * (rows - 1)) / rows;
  const scale = Math.min(cellW, cellH * sceneRatio);

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
  gap: number
): FrameInstance[] {
  // Arc from -30deg to +30deg, centered at bottom center of canvas.
  // Each frame is placed on the arc and rotated so the screens face outward.
  const radius = 0.45; // Distance from pivot to frame center
  const startAngle = -0.45; // radians (~ -25deg)
  const endAngle = 0.45;
  const scale = Math.min(0.28, (endAngle - startAngle) / (count * 0.12));

  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const angle = startAngle + t * (endAngle - startAngle);
    // Pivot at bottom center (0.5, 0.9)
    const pivotX = 0.5;
    const pivotY = 0.88;
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
  gap: number
): FrameInstance[] {
  // Diagonal cascade: each frame offset by (dx, dy) from previous.
  // Start top-left, cascade to bottom-right.
  const scale = Math.min(0.35, 1 / (count * 0.35 + 0.5));
  const dx = (1 - scale - gap) / Math.max(1, count - 1);
  const dy = (1 - scale - gap) / Math.max(1, count - 1);

  return Array.from({ length: count }, (_, i) => ({
    id: nextFrameInstanceId(),
    frame,
    x: gap + scale / 2 + i * dx,
    y: gap + scale / 2 + i * dy,
    scale,
    layerId: null
  }));
}

function buildMasonry(
  frame: MockupFrame,
  count: number,
  aspectRatio: string,
  gap: number
): FrameInstance[] {
  // Two-column masonry with alternating tall/short cells.
  const [w, h] = aspectRatio.split(" / ").map(Number);
  const sceneRatio = (w ?? 16) / (h ?? 9);
  const cols = 2;
  const rows = Math.ceil(count / cols);
  const cellW = (1 - gap) / cols;
  const cellH = (1 - gap * (rows - 1)) / rows;
  const baseScale = Math.min(cellW, cellH * sceneRatio);

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
      y: r * (cellH + gap * 1.5) + cellH / 2,
      scale: Math.max(0.08, s),
      layerId: null
    };
  });
}

function buildStack(
  frame: MockupFrame,
  count: number,
  _gap: number
): FrameInstance[] {
  // Stack with visible offset so each frame is partially visible behind the next.
  const scale = Math.min(0.38, 1.1 / count);
  const maxOffset = 0.06;
  const offset = Math.min(maxOffset, (1 - scale * 1.5) / Math.max(1, count - 1));
  // Snake pattern: right, down-left, right, down-right
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const xDir = row % 2 === 0 ? 1 : -1;
    const baseX = 0.5 + (col === 0 ? -0.15 : 0.15) * xDir;
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
