import { describe, expect, it } from "vitest";
import { alignFrameInstances, distributeFrameInstances } from "@/lib/state/frameAlign";
import type { FrameInstance } from "@/lib/types/editor";

function inst(id: string, x: number, y: number, scale = 0.25): FrameInstance {
  return { id, frame: "none", x, y, scale, layerId: null };
}

describe("alignFrameInstances", () => {
  it("returns the input untouched with fewer than 2 instances", () => {
    const instances = [inst("a", 0.3, 0.4)];
    expect(alignFrameInstances(instances, "left")).toBe(instances);
  });

  it("aligns left edges of mixed-size instances", () => {
    // "none" frames follow the scene ratio (16/9), so size.w === scale.
    const aligned = alignFrameInstances([inst("a", 0.4, 0.5), inst("b", 0.2, 0.5, 0.1)], "left");
    // min left edge = 0.2 - 0.05 = 0.15
    expect(aligned[0]!.x).toBeCloseTo(0.15 + 0.125, 6);
    expect(aligned[1]!.x).toBeCloseTo(0.15 + 0.05, 6);
  });

  it("aligns right edges on the group bounding box", () => {
    const aligned = alignFrameInstances([inst("a", 0.3, 0.5), inst("b", 0.7, 0.5)], "right");
    // max right edge = 0.7 + 0.125 = 0.825
    for (const i of aligned) expect(i.x).toBeCloseTo(0.825 - 0.125, 6);
  });

  it("centers instances horizontally on the shared middle line", () => {
    const aligned = alignFrameInstances([inst("a", 0.1, 0.5), inst("b", 0.9, 0.5)], "centerX");
    for (const i of aligned) expect(i.x).toBeCloseTo(0.5, 6);
  });

  it("aligns top edges of mixed-size instances", () => {
    const a = inst("a", 0.5, 0.4);        // h = 0.25 → top edge 0.275
    const b = inst("b", 0.5, 0.8, 0.1);   // h = 0.1  → top edge 0.75
    const aligned = alignFrameInstances([a, b], "top");
    // min top edge = 0.275
    expect(aligned[0]!.y).toBeCloseTo(0.4, 6);
    expect(aligned[1]!.y).toBeCloseTo(0.325, 6);
  });

  it("honors landscape orientation when computing boxes", () => {
    const portrait = inst("a", 0.5, 0.5);
    const landscape: FrameInstance = { ...inst("b", 0.5, 0.5), orientation: "landscape" };
    const aligned = alignFrameInstances([portrait, landscape], "centerX");
    expect(aligned[0]!.x).toBeCloseTo(0.5, 6);
    expect(aligned[1]!.x).toBeCloseTo(0.5, 6);
  });

  it("does not mutate the input array", () => {
    const instances = [inst("a", 0.2, 0.5), inst("b", 0.8, 0.5)];
    const snapshot = instances.map((i) => ({ ...i }));
    alignFrameInstances(instances, "right");
    expect(instances).toEqual(snapshot);
  });
});

describe("distributeFrameInstances", () => {
  it("returns the input untouched with fewer than 3 instances", () => {
    const instances = [inst("a", 0.2, 0.5), inst("b", 0.8, 0.5)];
    expect(distributeFrameInstances(instances, "horizontal")).toBe(instances);
  });

  it("equalizes horizontal gaps while keeping the extremes fixed", () => {
    const first = inst("a", 0.125, 0.5); // left edge at 0
    const middle = inst("b", 0.6, 0.5);
    const last = inst("c", 0.875, 0.5);  // right edge at 1
    const distributed = distributeFrameInstances([first, middle, last], "horizontal");
    // span = 1 - 3*0.25 = 0.25 total gap → gap = 0.125 between boxes.
    const xs = distributed.map((i) => i.x);
    expect(xs[0]).toBeCloseTo(0.125, 6);
    expect(xs[1]).toBeCloseTo(0.5, 6);
    expect(xs[2]).toBeCloseTo(0.875, 6);
  });

  it("sorts by position before distributing", () => {
    const a = inst("a", 0.875, 0.5);
    const b = inst("b", 0.5, 0.5);
    const c = inst("c", 0.125, 0.5);
    const distributed = distributeFrameInstances([a, b, c], "horizontal");
    // Same result regardless of input order: b stays centered.
    expect(distributed[1]!.x).toBeCloseTo(0.5, 6);
  });

  it("distributes vertically without touching x", () => {
    const a = inst("a", 0.3, 0.2);
    const b = inst("b", 0.7, 0.9);
    const c = inst("c", 0.5, 0.5);
    const distributed = distributeFrameInstances([a, b, c], "vertical");
    for (const [before, after] of [[a, distributed[0]], [b, distributed[1]], [c, distributed[2]]] as const) {
      expect(after!.x).toBe(before.x);
    }
  });
});
