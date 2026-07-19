import { describe, expect, it } from "vitest";
import { computeFrameBox } from "@/lib/export/renderMockup";
import { getFrameSpec } from "@/lib/render/frames";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

const scene = (overrides: Partial<EditorScene> = {}): EditorScene => ({
  ...initialScene,
  ...overrides
});

// For CSS-only frames the media is inset by `frameStyle.padding` (CSS px)
// inside a frame of `offsetWidth` (CSS px). The exported canvas gets
// frameWidth in device px (offsetWidth * pixelRatio), so the inset ratio must
// stay spec.padding / offsetWidth regardless of pixelRatio. Overlay skins use
// a viewBox-based cutout ratio (cutout.x / 390) instead, which must also be
// pixelRatio-independent.
describe("computeFrameBox geometry", () => {
  it("keeps the media inset ratio independent of pixelRatio (overlay cutout)", () => {
    const cssWidth = 700;
    const spec = getFrameSpec("iphone15");
    const expectedRatio = (spec.cutout?.x ?? 0) / 390;

    const atDpr = (dpr: number) =>
      computeFrameBox(scene({ frame: "iphone15" }), 1400, 1400, dpr, cssWidth * dpr, cssWidth * dpr * (10 / 16));

    const low = atDpr(1);
    const high = atDpr(3);

    const ratioLow = low.pad / low.width;
    const ratioHigh = high.pad / high.width;

    expect(ratioLow).toBeCloseTo(expectedRatio, 5);
    expect(ratioHigh).toBeCloseTo(expectedRatio, 5);
    expect(ratioHigh).toBeCloseTo(ratioLow, 5);
  });

  it("matches the CSS preview inset ratio for a CSS-only frame", () => {
    const cssWidth = 640;
    const spec = getFrameSpec("iphone");
    const box = computeFrameBox(scene({ frame: "iphone" }), 1280, 1280, 2, cssWidth * 2, cssWidth * 2 * (10 / 16));
    expect(box.pad / box.width).toBeCloseTo(spec.padding / cssWidth, 5);
  });

  it("applies zoom to the frame size but preserves the inset ratio", () => {
    const cssWidth = 600;
    const base = computeFrameBox(scene({ frame: "desktop" }), 1200, 1200, 2, cssWidth * 2, cssWidth * 2 * (10 / 16), undefined, undefined, undefined);
    const zoomed = computeFrameBox(
      scene({ frame: "desktop", zoom: 1.5 }),
      1200,
      1200,
      2,
      cssWidth * 2,
      cssWidth * 2 * (10 / 16)
    );
    expect(zoomed.width).toBeCloseTo(base.width * 1.5, 3);
    expect(zoomed.pad / zoomed.width).toBeCloseTo(base.pad / base.width, 5);
  });

  it("derives frameH from frameW with a 16:10 ratio when height is omitted", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 2000, 2000, 2, 1000);
    expect(box.height).toBeCloseTo(box.width * (10 / 16), 5);
  });

  it("clips the watch frame to a full circle", () => {
    const box = computeFrameBox(scene({ frame: "watch" }), 1000, 1000, 2, 400, 400);
    expect(box.outerRadius).toBeCloseTo(200, 3);
    expect(box.innerRadius).toBeCloseTo((400 - 2 * (18 * 2)) / 2, 3);
  });

  it("centers the frame when no explicit position is given", () => {
    const box = computeFrameBox(scene({ frame: "none" }), 1000, 500, 1, 400, 250);
    expect(box.x).toBeCloseTo((1000 - 400) / 2, 5);
    expect(box.y).toBeCloseTo((500 - 250) / 2, 5);
  });
});
