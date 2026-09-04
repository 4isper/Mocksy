import { describe, expect, it } from "vitest";
import type { FrameInstance, LayoutPreset } from "@/lib/types/editor";
import { buildAutoLayout, fitInstancesToCanvas, LAYOUT_PRESETS, layoutFrameGrid } from "@/lib/state/editorHelpers";

describe("buildAutoLayout", () => {
  it("grid layout places frames in rows and columns", () => {
    const instances = buildAutoLayout("iphone", 4, "grid", "16 / 9");
    expect(instances.length).toBe(4);
    // 4 items on 16/9 → cols ≈ round(sqrt(4*1.778)) = 3, rows = 2
    // i=0 and i=1 in first row (same y), i=3 in second row (higher y)
    expect(instances[0]!.x).toBeLessThan(instances[1]!.x);
    expect(instances[0]!.y).toBeLessThan(instances[3]!.y);
    expect(instances[0]!.scale).toBeGreaterThan(0.1);
  });

  it("fan layout places frames along an arc", () => {
    const instances = buildAutoLayout("iphone", 3, "fan", "16 / 9");
    expect(instances.length).toBe(3);
    // Middle frame is roughly centered horizontally
    expect(instances[1]!.x).toBeGreaterThan(0.3);
    expect(instances[1]!.x).toBeLessThan(0.7);
    expect(instances[0]!.x).toBeLessThan(instances[1]!.x);
    expect(instances[1]!.x).toBeLessThan(instances[2]!.x);
    expect(instances[0]!.scale).toBeGreaterThan(0.05);
  });

  it("cascade layout places frames diagonally", () => {
    const instances = buildAutoLayout("iphone", 3, "cascade", "16 / 9");
    expect(instances.length).toBe(3);
    expect(instances[0]!.x).toBeLessThan(instances[1]!.x);
    expect(instances[1]!.x).toBeLessThan(instances[2]!.x);
    expect(instances[0]!.y).toBeLessThan(instances[1]!.y);
    expect(instances[1]!.y).toBeLessThan(instances[2]!.y);
    expect(instances[0]!.scale).toBeGreaterThan(0.05);
  });

  it("masonry layout alternates in two columns", () => {
    const instances = buildAutoLayout("iphone", 4, "masonry", "16 / 9");
    expect(instances.length).toBe(4);
    expect(instances[0]!.x).toBeLessThan(instances[1]!.x); // first column before second
    expect(instances[0]!.y).toBeLessThan(instances[2]!.y); // top before bottom
  });

  it("stack layout overlaps with offset", () => {
    const instances = buildAutoLayout("iphone", 3, "stack", "16 / 9");
    expect(instances.length).toBe(3);
    // Snakes: row0 left/right, row1 right/left
    expect(instances.every((i) => i.x >= 0 && i.x <= 1)).toBe(true);
    expect(instances.every((i) => i.y >= 0 && i.y <= 1)).toBe(true);
  });

  it("returns empty array for count < 1", () => {
    expect(buildAutoLayout("iphone", 0, "grid", "16 / 9")).toEqual([]);
    expect(buildAutoLayout("iphone", -1, "grid", "16 / 9")).toEqual([]);
  });

  it("keeps portrait frames inside the canvas for every preset", () => {
    // Same instance math the renderer uses (computeFrameInstances).
    const canvasW = 756;
    const canvasH = 756 * (9 / 16);
    const instAr = 844 / 390;
    for (const layout of LAYOUT_PRESETS) {
      for (const count of [1, 2, 4]) {
        const instances = buildAutoLayout("iphone", count, layout, "16 / 9");
        for (const inst of instances) {
          const w = inst.scale * canvasW;
          const h = w * instAr;
          const x = inst.x * canvasW - w / 2;
          const y = inst.y * canvasH - h / 2;
          expect(x, `${layout}×${count} left`).toBeGreaterThanOrEqual(-0.01);
          expect(x + w, `${layout}×${count} right`).toBeLessThanOrEqual(canvasW + 0.01);
          expect(y, `${layout}×${count} top`).toBeGreaterThanOrEqual(-0.01);
          expect(y + h, `${layout}×${count} bottom`).toBeLessThanOrEqual(canvasH + 0.01);
        }
      }
    }
  });

  it("grid handles single frame gracefully", () => {
    const instances = buildAutoLayout("iphone", 1, "grid", "16 / 9");
    expect(instances.length).toBe(1);
    expect(instances[0]!.x).toBeGreaterThan(0.2);
    expect(instances[0]!.x).toBeLessThan(0.8);
    expect(instances[0]!.y).toBeGreaterThan(0.2);
    expect(instances[0]!.y).toBeLessThan(0.8);
  });

  it("falls back to the grid preset for an unknown layout", () => {
    const instances = buildAutoLayout("iphone", 2, "diagonal" as LayoutPreset, "16 / 9");
    expect(instances.length).toBe(2);
  });

  it("stack layout keeps two frames from fully overlapping", () => {
    const instances = buildAutoLayout("iphone", 2, "stack", "16 / 9");
    expect(instances.length).toBe(2);
    // With a single row the two frames must be spread horizontally, not stacked
    // on the exact same center (which would hide one behind the other).
    const dx = Math.abs(instances[0]!.x - instances[1]!.x);
    expect(dx).toBeGreaterThan(instances[0]!.scale / 2);
  });

  it("fan layout does not overlap frames at large counts", () => {
    // Before the horizontal-gap cap a count of 8 piled frames on top of each
    // other; adjacent centers must now stay apart by at least a frame width.
    const instances = buildAutoLayout("iphone", 8, "fan", "16 / 9");
    expect(instances.length).toBe(8);
    const halfW = instances[0]!.scale / 2;
    for (let i = 1; i < instances.length; i++) {
      const gap = Math.abs(instances[i]!.x - instances[i - 1]!.x);
      expect(gap, `adjacent fan gap @${i}`).toBeGreaterThan(halfW);
    }
  });

  it("treats a malformed aspect ratio as the default 16/9", () => {
    const instances = buildAutoLayout("iphone", 2, "grid", "16");
    expect(instances.length).toBe(2);
    expect(Number.isFinite(instances[0]!.scale)).toBe(true);
  });
});

describe("layoutFrameGrid", () => {
  it("returns an empty array for count < 1", () => {
    expect(layoutFrameGrid("iphone", 0, "horizontal", "16 / 9")).toEqual([]);
    expect(layoutFrameGrid("iphone", -3, "horizontal", "16 / 9")).toEqual([]);
  });

  it("spaces frames horizontally and centers them vertically", () => {
    const instances = layoutFrameGrid("iphone", 3, "horizontal", "16 / 9");
    expect(instances.length).toBe(3);
    expect(instances[0]!.y).toBeCloseTo(0.5);
    expect(instances[0]!.x).toBeLessThan(instances[1]!.x);
    expect(instances[1]!.x).toBeLessThan(instances[2]!.x);
  });

  it("spaces frames vertically and centers them horizontally", () => {
    const instances = layoutFrameGrid("iphone", 3, "vertical", "16 / 9");
    expect(instances.length).toBe(3);
    expect(instances[0]!.x).toBeCloseTo(0.5);
    expect(instances[0]!.y).toBeLessThan(instances[1]!.y);
    expect(instances[1]!.y).toBeLessThan(instances[2]!.y);
  });

  it("handles a single frame", () => {
    const instances = layoutFrameGrid("iphone", 1, "horizontal", "16 / 9");
    expect(instances.length).toBe(1);
    expect(instances[0]!.x).toBeCloseTo(0.5);
  });
});

describe("fitInstancesToCanvas", () => {
  const makeInst = (over: Partial<FrameInstance> = {}): FrameInstance => ({
    id: `i-${Math.random().toString(36).slice(2)}`,
    frame: "iphone",
    x: 0.1,
    y: 0.1,
    scale: 0.05,
    layerId: null,
    ...over
  });

  it("returns an empty array for no instances", () => {
    expect(fitInstancesToCanvas([], "9 / 16", null)).toEqual([]);
  });

  it("preserves identity and bindings, changing only geometry", () => {
    const before = [makeInst({ id: "a", layerId: "l1" }), makeInst({ id: "b", frame: "ipad", layerId: "l2" })];
    const after = fitInstancesToCanvas(before, "9 / 16", null);
    expect(after.map((i) => i.id)).toEqual(["a", "b"]);
    expect(after.map((i) => i.frame)).toEqual(["iphone", "ipad"]);
    expect(after.map((i) => i.layerId)).toEqual(["l1", "l2"]);
    expect(after[0]).not.toBe(before[0]);
  });

  it("fills the canvas height for phones on a tall aspect", () => {
    // The reported bug: two phones laid out for 16/9 stay tiny after
    // switching to 9/16. Refitting must spread them over the full height.
    const before = [makeInst({ id: "a" }), makeInst({ id: "b" })];
    const after = fitInstancesToCanvas(before, "9 / 16", null);
    const tops = after.map((i) => i.y - (i.scale * (9 / 16) * (844 / 390)) / 2);
    const bottoms = after.map((i) => i.y + (i.scale * (9 / 16) * (844 / 390)) / 2);
    expect(Math.min(...tops)).toBeLessThan(0.1);
    expect(Math.max(...bottoms)).toBeGreaterThan(0.9);
  });

  it("keeps every instance inside the canvas", () => {
    const before = [makeInst({ id: "a" }), makeInst({ id: "b", frame: "ipad" }), makeInst({ id: "c", frame: "macbook" })];
    for (const ratio of ["16 / 9", "1 / 1", "9 / 16"]) {
      for (const inst of fitInstancesToCanvas(before, ratio, null)) {
        expect(inst.x, `x ${ratio}`).toBeGreaterThanOrEqual(0);
        expect(inst.x, `x ${ratio}`).toBeLessThanOrEqual(1);
        expect(inst.y, `y ${ratio}`).toBeGreaterThanOrEqual(0);
        expect(inst.y, `y ${ratio}`).toBeLessThanOrEqual(1);
        expect(Number.isFinite(inst.scale), `scale ${ratio}`).toBe(true);
        expect(inst.scale, `scale ${ratio}`).toBeGreaterThan(0);
      }
    }
  });

  it("handles landscape instances without overflowing", () => {
    const before = [makeInst({ id: "a", orientation: "landscape" }), makeInst({ id: "b", orientation: "landscape" })];
    const after = fitInstancesToCanvas(before, "9 / 16", null);
    for (const inst of after) {
      // Landscape width = scale * nativeAr must fit the (narrow) cell.
      expect(inst.scale * (844 / 390)).toBeLessThanOrEqual(1.01);
      expect(Number.isFinite(inst.scale)).toBe(true);
    }
  });

  it("centers a single frame filling the canvas height", () => {
    const after = fitInstancesToCanvas([makeInst({ id: "a" })], "16 / 9", null);
    expect(after[0]!.x).toBeCloseTo(0.5);
    expect(after[0]!.y).toBeCloseTo(0.5);
    // Portrait phone on 16/9: the width-fraction scale looks small, but the
    // height coverage is what matters.
    const heightFrac = after[0]!.scale * (16 / 9) * (844 / 390);
    expect(heightFrac).toBeGreaterThan(0.9);
  });

  it("treats a malformed aspect ratio as the default 16/9", () => {
    const after = fitInstancesToCanvas([makeInst({ id: "a" })], "16", null);
    expect(Number.isFinite(after[0]!.scale)).toBe(true);
    expect(after[0]!.x).toBeCloseTo(0.5);
  });
});
