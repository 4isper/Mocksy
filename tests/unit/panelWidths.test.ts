import { describe, expect, it } from "vitest";
import {
  MIN_CANVAS_W,
  PANEL_WIDTH_DEFAULTS,
  PANEL_WIDTH_LIMITS,
  clampPanelWidth,
  loadPanelWidths,
  savePanelWidths
} from "@/lib/state/panelWidths";

describe("clampPanelWidth", () => {
  it("keeps widths within absolute per-side bounds", () => {
    expect(clampPanelWidth("left", 100, 2000, 310, 14)).toBe(PANEL_WIDTH_LIMITS.left.min);
    expect(clampPanelWidth("left", 900, 2000, 310, 14)).toBe(PANEL_WIDTH_LIMITS.left.max);
    expect(clampPanelWidth("right", 100, 2000, 280, 14)).toBe(PANEL_WIDTH_LIMITS.right.min);
    expect(clampPanelWidth("right", 900, 2000, 280, 14)).toBe(PANEL_WIDTH_LIMITS.right.max);
  });

  it("reserves canvas and other-panel space on wide grids", () => {
    // 2000px grid: other panel (280) + gaps + min canvas cap the left panel.
    const clamped = clampPanelWidth("left", 440, 2000, 280, 14);
    expect(clamped).toBeLessThanOrEqual(2000 - 28 - 280 - MIN_CANVAS_W);
  });

  it("never returns less than the panel minimum, even on tiny grids", () => {
    expect(clampPanelWidth("left", 300, 500, 400, 10)).toBe(PANEL_WIDTH_LIMITS.left.min);
    expect(clampPanelWidth("right", 300, 400, 400, 10)).toBe(PANEL_WIDTH_LIMITS.right.min);
  });

  it("rounds to whole pixels and falls back to the default for NaN", () => {
    expect(clampPanelWidth("left", 280.6, 2000, 310, 14)).toBe(281);
    expect(clampPanelWidth("left", Number.NaN, 2000, 310, 14)).toBe(PANEL_WIDTH_DEFAULTS.left);
  });
});

describe("loadPanelWidths", () => {
  it("reads valid persisted values", () => {
    const storage = { getItem: () => JSON.stringify({ left: 320, right: 380 }) };
    expect(loadPanelWidths(storage)).toEqual({ left: 320, right: 380 });
  });

  it("clamps out-of-range persisted values instead of rejecting them", () => {
    const storage = { getItem: () => JSON.stringify({ left: 50, right: 9999 }) };
    expect(loadPanelWidths(storage)).toEqual({
      left: PANEL_WIDTH_LIMITS.left.min,
      right: PANEL_WIDTH_LIMITS.right.max
    });
  });

  it("drops non-numeric entries and keeps the rest", () => {
    const storage = { getItem: () => JSON.stringify({ left: "wide", right: 360 }) };
    expect(loadPanelWidths(storage)).toEqual({ right: 360 });
  });

  it("returns empty for corrupt JSON, wrong shapes or missing keys", () => {
    expect(loadPanelWidths({ getItem: () => "{oops" })).toEqual({});
    expect(loadPanelWidths({ getItem: () => "42" })).toEqual({});
    expect(loadPanelWidths({ getItem: () => JSON.stringify({ side: 1 }) })).toEqual({});
    expect(loadPanelWidths({ getItem: () => null })).toEqual({});
  });
});

describe("savePanelWidths", () => {
  it("writes clamped JSON", () => {
    let written = "";
    const storage = { setItem: (_k: string, v: string) => { written = v; } };
    savePanelWidths(storage, { left: 10000, right: 350.4 });
    expect(JSON.parse(written)).toEqual({ left: PANEL_WIDTH_LIMITS.left.max, right: 350 });
  });

  it("swallows storage failures", () => {
    const storage = { setItem: () => { throw new Error("quota"); } };
    expect(() => savePanelWidths(storage, { left: 300, right: 320 })).not.toThrow();
  });
});
