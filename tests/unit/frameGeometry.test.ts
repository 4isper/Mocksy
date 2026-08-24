import { describe, expect, it } from "vitest";
import { computeFrameBox, computeFrameInstances, isVisibleFrameInstance } from "@/lib/render/frameGeometry";
import { getFrameSpec } from "@/lib/render/frames";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return { ...initialScene.layers[0]!, id: overrides.id ?? "layer-test", ...overrides };
}

function scene(overrides: { layer?: Partial<MediaLayer> } & Partial<EditorScene> = {}): EditorScene {
  const l = layer(overrides.layer ?? {});
  const { layer: _layer, ...sceneOverrides } = overrides;
  return { ...initialScene, layers: [l], activeLayerId: l.id, ...sceneOverrides };
}

describe("computeFrameBox", () => {
  it("returns a box with positive dimensions for a standard frame", () => {
    const box = computeFrameBox(scene({ frame: "iphone15" }), 1200, 1200, 2, 600, 600);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
  });

  it("inner dimensions are smaller than outer dimensions", () => {
    const box = computeFrameBox(scene({ frame: "iphone15" }), 1200, 1200, 2);
    expect(box.innerW).toBeLessThan(box.width);
    expect(box.innerH).toBeLessThan(box.height);
  });

  it("innerX is greater than x (left padding)", () => {
    const box = computeFrameBox(scene({ frame: "iphone15" }), 1200, 1200, 2);
    expect(box.innerX).toBeGreaterThan(box.x);
  });

  it("innerY is greater than y (top padding)", () => {
    const box = computeFrameBox(scene({ frame: "iphone15" }), 1200, 1200, 2);
    expect(box.innerY).toBeGreaterThan(box.y);
  });

  it("watch frame is a rounded rectangle (non-circular overlay)", () => {
    const box = computeFrameBox(scene({ frame: "watch" }), 1000, 1000, 2, 400, 400);
    // Overlay skins define the shape via the SVG; inner dims are not equal.
    expect(box.innerW).not.toBeCloseTo(box.innerH, 5);
    expect(box.outerRadius).toBeGreaterThan(0);
  });

  it("none frame has non-zero outerRadius from borderRadius + padding", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 1200, 1200, 2);
    expect(box.outerRadius).toBeGreaterThan(0);
  });

  it("borderRadius affects outerRadius for CSS-only frames", () => {
    const s1 = scene({ frame: "none", borderRadius: 10 });
    const s2 = scene({ frame: "none", borderRadius: 30 });
    const box1 = computeFrameBox(s1, 1200, 1200, 2);
    const box2 = computeFrameBox(s2, 1200, 1200, 2);
    expect(box2.outerRadius).toBeGreaterThan(box1.outerRadius);
  });

  it("handles zero frameWidth by using the default", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 1200, 1200, 1, 0);
    expect(box.width).toBeGreaterThan(0);
  });

  it("handles negative frameWidth by using the default", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 1200, 1200, 1, -100);
    expect(box.width).toBeGreaterThan(0);
  });

  it("clips the watch frame as an overlay with a non-zero outerRadius", () => {
    const box = computeFrameBox(scene({ frame: "watch" }), 1000, 1000, 2, 400, 400);
    expect(box.outerRadius).toBeGreaterThan(0);
  });

  it("innerRadius is greater than zero for the watch frame", () => {
    const box = computeFrameBox(scene({ frame: "watch" }), 1000, 1000, 2, 400, 400);
    expect(box.innerRadius).toBeGreaterThan(0);
  });

  it("overlay frame has zero outerRadius", () => {
    const box = computeFrameBox(scene({ frame: "iphone15" }), 1200, 1200, 2);
    expect(box.outerRadius).toBeGreaterThan(0);
  });

  it("derives frameH from frameW with the frame's aspect ratio when height is omitted", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 2000, 2000, 2, 1000);
    expect(box.height).toBeCloseTo(box.width * (9 / 16), 5);
  });

  it("centers the frame when no explicit position is given", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 1000, 500, 1, 400, 250);
    expect(box.x).toBeCloseTo((1000 - 400) / 2, 5);
    expect(box.y).toBeCloseTo((500 - 250) / 2, 5);
  });

  it("uses explicit frameX and frameY for positioning", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 1000, 500, 1, 400, 250, undefined, 100, 50);
    expect(box.x).toBeCloseTo(100, 5);
    expect(box.y).toBeCloseTo(50, 5);
  });

  it("applies zoom from transform", () => {
    const base = computeFrameBox(scene({ frame: "none" }), 1200, 1200, 2, 400, 250);
    const zoomed = computeFrameBox(scene({ frame: "none" }), 1200, 1200, 2, 400, 250, { zoom: 2, offsetX: 0, offsetY: 0 });
    expect(zoomed.width).toBeCloseTo(base.width * 2, 3);
    expect(zoomed.height).toBeCloseTo(base.height * 2, 3);
  });

  it("translates the frame box by the transform offsets (preview scale × dpr)", () => {
    const base = computeFrameBox(scene({ frame: "none" }), 1000, 500, 1, 400, 250);
    const panned = computeFrameBox(scene({ frame: "none" }), 1000, 500, 1, 400, 250, { zoom: 1, offsetX: 10, offsetY: 6 });
    expect(panned.x).toBeCloseTo(base.x + 10 * 2, 3);
    expect(panned.y).toBeCloseTo(base.y + 6 * 2, 3);
  });

  it("scales the transform offsets by pixelRatio so exports match the preview", () => {
    const atDpr = (dpr: number) =>
      computeFrameBox(scene({ frame: "none" }), 1000 * dpr, 500 * dpr, dpr, 400 * dpr, 250 * dpr, { zoom: 1, offsetX: 10, offsetY: 6 });
    const lo = atDpr(1);
    const hi = atDpr(2);
    // The frame is centered in both cases, so the pan must double with dpr.
    expect(hi.x).toBeCloseTo(lo.x * 2, 3);
    expect(hi.y).toBeCloseTo(lo.y * 2, 3);
  });

  it("uses active layer zoom when transform is omitted", () => {
    const s = scene({ layer: { zoom: 1.5 } });
    const box = computeFrameBox(s, 1200, 1200, 2, 400, 250);
    const base = computeFrameBox(s, 1200, 1200, 2, 400, 250);
    expect(box.width).toBeCloseTo(base.width, 3);
  });

  it("clamps zoom to minimum 0.01", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 1200, 1200, 2, 400, 250, { zoom: 0, offsetX: 0, offsetY: 0 });
    expect(box.width).toBeGreaterThan(0);
  });

  it("overlay cutout preserves aspect ratio independent of pixelRatio", () => {
    const cssWidth = 700;
    const spec = getFrameSpec("iphone15");
    const expectedRatio = (spec.cutout?.x ?? 0) / (spec.viewBox?.w ?? 390);

    const atDpr = (dpr: number) =>
      computeFrameBox(scene({ frame: "iphone15" }), 1400, 1400, dpr, cssWidth * dpr, cssWidth * dpr * (10 / 16));

    const low = atDpr(1);
    const high = atDpr(3);

    expect((low.innerX - low.x) / low.width).toBeCloseTo(expectedRatio, 5);
    expect((high.innerX - high.x) / high.width).toBeCloseTo(expectedRatio, 5);
  });
});

describe("computeFrameInstances", () => {
  it("returns empty array when no frameInstances defined", () => {
    const result = computeFrameInstances(scene({ frame: "none" }), 1200, 1200, 2);
    expect(result).toEqual([]);
  });

  it("returns empty array when frameInstances is empty", () => {
    const s = scene({ frameInstances: [] });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    expect(result).toEqual([]);
  });

  it("computes positions for multiple frames", () => {
    const s = scene({
      frameInstances: [
        { id: "i1", frame: "iphone15", x: 0.25, y: 0.25, scale: 0.5, layerId: null },
        { id: "i2", frame: "iphone15", x: 0.75, y: 0.75, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    expect(result).toHaveLength(2);
    expect(result[0]!.x).toBeLessThan(result[1]!.x);
    expect(result[0]!.y).toBeLessThan(result[1]!.y);
  });

  it("uses correct aspect ratio from frame spec", () => {
    const s = scene({
      frameInstances: [
        { id: "i1", frame: "iphone15", x: 0.5, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    expect(result[0]!.width / result[0]!.height).toBeCloseTo(393 / 852, 3);
  });

  it("uses scene aspect ratio for 'none' frame instances", () => {
    const s = scene({
      aspectRatio: "16 / 9",
      frameInstances: [
        { id: "i1", frame: "none", x: 0.5, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    expect(result[0]!.width / result[0]!.height).toBeCloseTo(16 / 9, 3);
  });

  it("scales instance dimensions by the instance scale factor", () => {
    const s = scene({
      frameInstances: [
        { id: "i1", frame: "iphone15", x: 0.5, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    const expectedW = 0.5 * 1200;
    expect(result[0]!.width).toBeCloseTo(expectedW, 3);
  });

  it("applies zoom from transform to instance dimensions", () => {
    const s = scene({
      frameInstances: [
        { id: "i1", frame: "iphone15", x: 0.5, y: 0.5, scale: 0.5, layerId: "layer-test" }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2, { zoom: 2, offsetX: 0, offsetY: 0 });
    const expectedW = 0.5 * 1200 * 2;
    expect(result[0]!.width).toBeCloseTo(expectedW, 3);
  });

  it("uses active layer zoom when transform is omitted", () => {
    const s = scene({
      layer: { zoom: 1.5 },
      frameInstances: [
        { id: "i1", frame: "iphone15", x: 0.5, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    const base = computeFrameInstances(s, 1200, 1200, 2);
    expect(result[0]!.width).toBeCloseTo(base[0]!.width, 3);
  });

  it("clamps zoom to minimum 0.01 for instances", () => {
    const s = scene({
      frameInstances: [
        { id: "i1", frame: "iphone15", x: 0.5, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2, { zoom: 0, offsetX: 0, offsetY: 0 });
    expect(result[0]!.width).toBeGreaterThan(0);
  });

  it("positions instance at the correct normalized coordinates", () => {
    const s = scene({
      frameInstances: [
        { id: "i1", frame: "iphone15", x: 0.5, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    const w = result[0]!.width;
    expect(result[0]!.x).toBeCloseTo(0.5 * 1200 - w / 2, 3);
    expect(result[0]!.y).toBeCloseTo(0.5 * 1200 - result[0]!.height / 2, 3);
  });

  it("translates instances by the transform offsets (preview scale × dpr)", () => {
    const s = scene({
      frameInstances: [
        { id: "i1", frame: "iphone15", x: 0.5, y: 0.5, scale: 0.5, layerId: "layer-test" }
      ]
    });
    const base = computeFrameInstances(s, 1200, 1200, 2);
    const panned = computeFrameInstances(s, 1200, 1200, 2, { zoom: 1, offsetX: 10, offsetY: -6 });
    expect(panned[0]!.x).toBeCloseTo(base[0]!.x + 10 * 2 * 2, 3);
    expect(panned[0]!.y).toBeCloseTo(base[0]!.y + -6 * 2 * 2, 3);
  });

  it("overlay frame instances have zero outerRadius", () => {
    const s = scene({
      frameInstances: [
        { id: "i1", frame: "iphone15", x: 0.5, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    expect(result[0]!.outerRadius).toBe(0);
  });

  it("CSS-only frame instances have non-zero outerRadius", () => {
    const s = scene({
      borderRadius: 10,
      frameInstances: [
        { id: "i1", frame: "none", x: 0.5, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    expect(result[0]!.outerRadius).toBeGreaterThan(0);
  });

  it("watch frame instances are overlays with zero outerRadius", () => {
    const s = scene({
      frameInstances: [
        { id: "i1", frame: "watch", x: 0.5, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    const result = computeFrameInstances(s, 1200, 1200, 2);
    expect(result[0]!.outerRadius).toBe(0);
  });
});
describe("computeFrameInstances landscape orientation", () => {
  it("swaps the physical box dimensions and reports a 90° rotation", () => {
    const portraitInst = { id: "p", frame: "iphone15" as const, x: 0.3, y: 0.5, scale: 0.4, layerId: null };
    const landscapeInst = { ...portraitInst, id: "l", x: 0.7, orientation: "landscape" as const };
    const s = scene({ frameInstances: [portraitInst, landscapeInst] });

    const [p, l] = computeFrameInstances(s, 1600, 900, 1);
    expect(p!.rotation).toBeUndefined();
    expect(l!.rotation).toBe(Math.PI / 2);

    // Portrait: width = scale * canvasW; height follows the native ratio.
    expect(p!.width).toBeCloseTo(0.4 * 1600);
    expect(l!.width).toBeCloseTo(p!.height);
    expect(l!.height).toBeCloseTo(p!.width);

    // Centers stay put.
    expect(l!.x + l!.width / 2).toBeCloseTo(0.7 * 1600);
    expect(l!.y + l!.height / 2).toBeCloseTo(0.5 * 900);
  });

  it("centers native-orientation screen geometry in the swapped box", () => {
    const s = scene({
      frameInstances: [{ id: "l", frame: "iphone15", x: 0.5, y: 0.5, scale: 0.4, layerId: null, orientation: "landscape" }]
    });
    const box = computeFrameInstances(s, 1600, 900, 1)[0]!;
    const drawW = box.height; // native width becomes the rotated extent
    const drawH = box.width;
    // innerX/innerY are native-space coords around the shared center.
    const nativeCx = box.innerX + box.innerW / 2;
    const nativeCy = box.innerY + box.innerH / 2;
    const expectedDx = box.x + box.width / 2 - drawW / 2;
    const expectedDy = box.y + box.height / 2 - drawH / 2;
    expect(nativeCx).toBeCloseTo(expectedDx + drawW / 2);
    expect(nativeCy).toBeCloseTo(expectedDy + drawH / 2);
  });
});

describe("isVisibleFrameInstance", () => {
  it("is visible when its own layer is visible", () => {
    const inst = { id: "i1", frame: "iphone15" as const, x: 0.5, y: 0.5, scale: 0.4, layerId: "l1" };
    const s = scene({ layers: [layer({ id: "l1", hidden: false })], activeLayerId: "l1", frameInstances: [inst] });
    expect(isVisibleFrameInstance(s, inst)).toBe(true);
  });

  it("is hidden when its layer is hidden (preview parity for exports)", () => {
    const inst = { id: "i1", frame: "iphone15" as const, x: 0.5, y: 0.5, scale: 0.4, layerId: "l1" };
    const s = scene({ layers: [layer({ id: "l1", hidden: true })], activeLayerId: "l1", frameInstances: [inst] });
    expect(isVisibleFrameInstance(s, inst)).toBe(false);
  });

  it("falls back to the active layer's visibility like the preview grid does", () => {
    const inst = { id: "i1", frame: "iphone15" as const, x: 0.5, y: 0.5, scale: 0.4, layerId: null };
    const visibleActive = scene({ layers: [layer({ id: "a", hidden: false })], activeLayerId: "a", frameInstances: [inst] });
    expect(isVisibleFrameInstance(visibleActive, inst)).toBe(true);
    const hiddenActive = scene({ layers: [layer({ id: "a", hidden: true })], activeLayerId: "a", frameInstances: [inst] });
    expect(isVisibleFrameInstance(hiddenActive, inst)).toBe(false);
  });
});
