/** Default number of divisions on each grid axis. */
export const DEFAULT_GRID_DIVISIONS = 12;

/** Grid sizes offered in the preview toolbar, in divisions per axis. */
export const GRID_DIVISION_OPTIONS = [6, 8, 10, 12, 16];

/**
 * Snaps a value to the nearest grid line for the given number of divisions.
 * The value is a fraction of the canvas (e.g. an annotation x/y/w/h), and the
 * caller is responsible for clamping to its own valid range. A divisions < 1
 * (or the default 0) disables snapping and returns the value unchanged.
 */
export function snapToGrid(value: number, divisions: number): number {
  if (divisions < 1 || !Number.isFinite(value)) return value;
  const step = 1 / divisions;
  return Math.round(value / step) * step;
}
