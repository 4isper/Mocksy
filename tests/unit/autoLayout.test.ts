import { describe, expect, it } from "vitest";
import { buildAutoLayout, LAYOUT_PRESETS } from "@/lib/state/editorHelpers";

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
});
