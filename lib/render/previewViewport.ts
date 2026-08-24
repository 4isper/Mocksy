/**
 * Pure math behind the preview canvas' view transform (zoom + pan). The zoom
 * layer maps a content point p to screen offset q = pan + scale·p relative to
 * the canvas center, so these helpers stay renderer-agnostic and trivially
 * testable. View state only — never persisted or part of undo history.
 */

export const PREVIEW_ZOOM_MIN = 0.25;
export const PREVIEW_ZOOM_MAX = 4;

/** Log-scale slider resolution (0–100 maps onto MIN…MAX). */
export const ZOOM_SLIDER_MAX = 100;

/** Wheel sensitivity: one mouse-wheel notch (~100px deltaY) lands roughly one
 *  zoom stop away, while small trackpad deltas scroll smoothly. */
const WHEEL_ZOOM_SPEED = 0.0022;

/** Values the zoom snaps to when a gesture lands nearby, so wheel/slider
 *  interactions settle on crisp 50% / 100% / 200%-style levels. */
const ZOOM_STOPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];

/** Relative (log-space) distance under which a zoom result snaps to a stop. */
const SNAP_TOLERANCE = 0.07;

export interface Point {
  x: number;
  y: number;
}

/** "fit" behaves as exactly 1× because the canvas element is already sized to
 *  fit its container; numeric zooms pass through. */
export function resolveZoomScale(zoom: number | "fit"): number {
  return zoom === "fit" ? 1 : zoom;
}

export function clampZoom(zoom: number): number {
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, zoom));
}

/** Wheel/trackpad deltaY → multiplicative zoom factor (>1 zooms in). Normalizes
 *  line/page delta modes to pixel-equivalents first. */
export function zoomFactorFromDelta(deltaY: number, deltaMode: number = 0): number {
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1;
  const delta = deltaY * unit;
  if (delta === 0) return 1;
  return Math.exp(-delta * WHEEL_ZOOM_SPEED);
}

/** Snaps to a familiar stop when within tolerance, otherwise clamps only. */
export function snapZoom(zoom: number): number {
  const z = clampZoom(zoom);
  let best = z;
  let bestDistance = Infinity;
  for (const stop of ZOOM_STOPS) {
    const distance = Math.abs(Math.log(z / stop));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = stop;
    }
  }
  return bestDistance <= SNAP_TOLERANCE ? best : z;
}

/** Applies a multiplicative zoom step, clamped to the supported range and
 *  (by default) snapped to familiar stops; cleans up float dust around 1×. */
export function nextZoom(current: number, factor: number, snap = true): number {
  const raw = clampZoom(current * factor);
  const result = snap ? snapZoom(raw) : raw;
  return Math.abs(result - 1) < 0.002 ? 1 : result;
}

/** Fixed-point zoom: moves the pan so the content point under `anchor`
 *  (viewport-center-relative, like the pan) stays put while rescaling. */
export function panForZoom(pan: Point, anchor: Point, prevScale: number, nextScale: number): Point {
  const k = nextScale / prevScale;
  return {
    x: anchor.x + (pan.x - anchor.x) * k,
    y: anchor.y + (pan.y - anchor.y) * k
  };
}

/** Constrains panning to the real overflow: at or below fit the whole content
 *  is visible so it stays glued to center; above fit it can be dragged just
 *  far enough to reach every edge and no further. Normalizes -0 to 0. */
export function clampPan(pan: Point, scale: number, width: number, height: number): Point {
  const maxX = Math.max((width * scale - width) / 2, 0);
  const maxY = Math.max((height * scale - height) / 2, 0);
  const x = Math.min(maxX, Math.max(-maxX, pan.x));
  const y = Math.min(maxY, Math.max(-maxY, pan.y));
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

/** Keyboard / ± button zoom step anchored at the viewport center, where no
 *  cursor position is known. Returns the full next view state. */
export function zoomAroundCenter(
  zoom: number | "fit",
  factor: number,
  pan: Point
): { zoom: number; pan: Point } {
  const prev = resolveZoomScale(zoom);
  const next = nextZoom(prev, factor);
  return { zoom: next, pan: panForZoom(pan, { x: 0, y: 0 }, prev, next) };
}

/** Logarithmic slider ↔ zoom conversions so 50%→100% travels as far as
 *  100%→200%. Slider runs 0…ZOOM_SLIDER_MAX. */
export function zoomToSlider(zoom: number): number {
  const z = clampZoom(zoom);
  return Math.round((Math.log(z / PREVIEW_ZOOM_MIN) / Math.log(PREVIEW_ZOOM_MAX / PREVIEW_ZOOM_MIN)) * ZOOM_SLIDER_MAX);
}

export function sliderToZoom(value: number): number {
  const t = Math.min(ZOOM_SLIDER_MAX, Math.max(0, value)) / ZOOM_SLIDER_MAX;
  return PREVIEW_ZOOM_MIN * Math.exp(t * Math.log(PREVIEW_ZOOM_MAX / PREVIEW_ZOOM_MIN));
}

/** Discrete step for the ± buttons: one familiar stop at a time. */
export function stepZoomDirection(current: number, direction: 1 | -1): number {
  const z = clampZoom(current);
  if (direction > 0) {
    const stop = ZOOM_STOPS.find((s) => s > z + 1e-9);
    return stop ?? PREVIEW_ZOOM_MAX;
  }
  const previous = [...ZOOM_STOPS].reverse().find((s) => s < z - 1e-9);
  return previous ?? PREVIEW_ZOOM_MIN;
}
