/**
 * Persisted, mouse-resizable widths for the two editor side panels.
 *
 * The widths live as `--panel-left-w` / `--panel-right-w` CSS custom
 * properties on the `.editor-grid` element (see PanelResizeHandles), so all
 * layout math stays in CSS. This module holds the pure bits: clamping rules,
 * localStorage (de)serialization — kept dependency-free for unit tests.
 */

export type PanelSide = "left" | "right";

export interface PanelWidths {
  left: number;
  right: number;
}

export const PANEL_WIDTH_DEFAULTS: PanelWidths = { left: 280, right: 310 };

/** Absolute bounds per panel, mirroring what the layout can visually take. */
export const PANEL_WIDTH_LIMITS: Record<PanelSide, { min: number; max: number }> = {
  left: { min: 232, max: 440 },
  right: { min: 256, max: 480 }
};

/** The preview column never shrinks below this, even on wide panels. */
export const MIN_CANVAS_W = 360;

const STORAGE_KEY = "mocksy-panel-widths";

function absClamp(side: PanelSide, width: number): number {
  const { min, max } = PANEL_WIDTH_LIMITS[side];
  return Math.round(Math.min(max, Math.max(min, width)));
}

/**
 * Clamps a desired panel width against its absolute bounds and the space
 * actually available in the grid: the other panel keeps at least its own
 * minimum and the canvas keeps MIN_CANVAS_W.
 */
export function clampPanelWidth(
  side: PanelSide,
  width: number,
  gridWidth: number,
  otherWidth: number,
  gap: number
): number {
  if (!Number.isFinite(width)) return PANEL_WIDTH_DEFAULTS[side];
  const otherMin = side === "left" ? PANEL_WIDTH_LIMITS.right.min : PANEL_WIDTH_LIMITS.left.min;
  const dynamicMax = gridWidth - gap * 2 - Math.max(otherMin, otherWidth) - MIN_CANVAS_W;
  // The dynamic cap can dip below the absolute minimum on very small grids;
  // the panel minimum always wins in that case.
  const cappedMax = Math.max(PANEL_WIDTH_LIMITS[side].min, Math.min(PANEL_WIDTH_LIMITS[side].max, dynamicMax));
  return Math.round(Math.min(cappedMax, Math.max(PANEL_WIDTH_LIMITS[side].min, width)));
}

/** Reads persisted widths; corrupt or out-of-range entries are dropped. */
export function loadPanelWidths(storage: Pick<Storage, "getItem">): Partial<PanelWidths> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Partial<PanelWidths> = {};
    for (const side of ["left", "right"] as const) {
      const value = (parsed as Record<string, unknown>)[side];
      if (typeof value === "number" && Number.isFinite(value)) {
        out[side] = absClamp(side, value);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Persists widths; storage failures (quota, privacy mode) are non-fatal. */
export function savePanelWidths(storage: Pick<Storage, "setItem">, widths: PanelWidths): void {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        left: absClamp("left", widths.left),
        right: absClamp("right", widths.right)
      })
    );
  } catch {
    // Storage unavailable/full — resizing still works, just isn't remembered.
  }
}
