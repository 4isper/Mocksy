import { describe, expect, it } from "vitest";
import { DEFAULT_GRID_DIVISIONS, GRID_DIVISION_OPTIONS, snapToGrid } from "@/lib/render/grid";

describe("snapToGrid", () => {
  it("snaps a fraction to the nearest grid line", () => {
    expect(snapToGrid(0.37, 12)).toBe(1 / 3);
    expect(snapToGrid(0.34, 12)).toBe(1 / 3);
    expect(snapToGrid(0.12, 12)).toBe(1 / 12);
    expect(snapToGrid(0.9, 10)).toBe(0.9);
  });

  it("snaps exactly on a line to itself", () => {
    expect(snapToGrid(0.5, 8)).toBe(0.5);
    expect(snapToGrid(0, 6)).toBe(0);
    expect(snapToGrid(1, 6)).toBe(1);
  });

  it("snaps values outside the canvas to the nearest line without clamping", () => {
    expect(snapToGrid(1.23, 12)).toBeCloseTo(1.25, 3);
    expect(snapToGrid(-0.23, 10)).toBeCloseTo(-0.2, 3);
  });

  it("returns the value unchanged when snapping is disabled", () => {
    expect(snapToGrid(0.37, 0)).toBe(0.37);
    expect(snapToGrid(0.37, -1)).toBe(0.37);
  });

  it("defaults to a 12-division grid", () => {
    expect(DEFAULT_GRID_DIVISIONS).toBe(12);
    expect(GRID_DIVISION_OPTIONS).toContain(12);
  });
});
