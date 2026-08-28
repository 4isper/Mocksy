import { describe, expect, it } from "vitest";
import {
  EXPORT_BASE_WIDTH,
  fitRatioForCustomSize,
  intrinsicExportSize,
  resolveSpinRenderSize,
  sceneAspectRatio
} from "@/lib/export/exportSize";
import { singleFrameCssSize } from "@/lib/render/frameGeometry";
import type { EditorScene } from "@/lib/types/editor";
import { initialScene, makeDemoScene } from "@/lib/state/editorStore";

function sceneWith(overrides: Partial<EditorScene>): EditorScene {
  return { ...makeDemoScene(), ...overrides };
}

describe("sceneAspectRatio", () => {
  it("parses the scene aspect ratio", () => {
    expect(sceneAspectRatio(sceneWith({ aspectRatio: "16 / 9" }))).toBeCloseTo(16 / 9, 10);
    expect(sceneAspectRatio(sceneWith({ aspectRatio: "1 / 1" }))).toBe(1);
    expect(sceneAspectRatio(sceneWith({ aspectRatio: "9 / 16" }))).toBeCloseTo(9 / 16, 10);
  });
});

describe("intrinsicExportSize", () => {
  it("anchors width to the base constant regardless of any viewport", () => {
    const size = intrinsicExportSize(initialScene, 1);
    expect(size.width).toBe(EXPORT_BASE_WIDTH);
  });

  it("derives height from the scene aspect ratio", () => {
    expect(intrinsicExportSize(sceneWith({ aspectRatio: "16 / 9" }), 1)).toEqual({
      width: EXPORT_BASE_WIDTH,
      height: 450
    });
    expect(intrinsicExportSize(sceneWith({ aspectRatio: "9 / 16" }), 1).height).toBe(Math.round(EXPORT_BASE_WIDTH * 16 / 9));
  });

  it("scales linearly as a quality multiplier", () => {
    const one = intrinsicExportSize(initialScene, 1);
    const four = intrinsicExportSize(initialScene, 4);
    expect(four.width).toBe(one.width * 4);
    expect(four.height).toBe(one.height * 4);
  });
});

describe("fitRatioForCustomSize", () => {
  it("fits the base artboard inside the custom box", () => {
    const ratio = fitRatioForCustomSize(sceneWith({ aspectRatio: "16 / 9" }), { width: 1920, height: 1080 });
    // Base is 800×450; both axes fit with the same factor.
    expect(ratio).toBeCloseTo(1920 / EXPORT_BASE_WIDTH, 6);
    expect(1920 / (EXPORT_BASE_WIDTH * ratio)).toBeCloseTo(1, 6);
  });

  it("is limited by the tighter axis when aspects differ", () => {
    const ratio = fitRatioForCustomSize(sceneWith({ aspectRatio: "9 / 16" }), { width: 1920, height: 1080 });
    expect(ratio).toBeCloseTo(1080 / intrinsicExportSize(sceneWith({ aspectRatio: "9 / 16" })).height, 6);
  });
});

describe("resolveSpinRenderSize", () => {
  it("anchors to the intrinsic artboard at the default scale 2", () => {
    const size = resolveSpinRenderSize(sceneWith({ aspectRatio: "16 / 9" }));
    expect(size).toEqual({ width: EXPORT_BASE_WIDTH * 2, height: 450 * 2 });
  });

  it("applies an explicit scale", () => {
    const size = resolveSpinRenderSize(sceneWith({ aspectRatio: "1 / 1" }), { scale: 3 });
    expect(size).toEqual({ width: EXPORT_BASE_WIDTH * 3, height: EXPORT_BASE_WIDTH * 3 });
  });

  it("caps scale at 4 and floors at 1", () => {
    expect(resolveSpinRenderSize(sceneWith({ aspectRatio: "1 / 1" }), { scale: 99 }).width).toBe(EXPORT_BASE_WIDTH * 4);
    expect(resolveSpinRenderSize(sceneWith({ aspectRatio: "1 / 1" }), { scale: 0 }).width).toBe(EXPORT_BASE_WIDTH);
  });

  it("explicit width/height win over scale and clamp to 8192", () => {
    const size = resolveSpinRenderSize(sceneWith({ aspectRatio: "16 / 9" }), { scale: 1, width: 1920, height: 1080 });
    expect(size).toEqual({ width: 1920, height: 1080 });
    const clamped = resolveSpinRenderSize(sceneWith({ aspectRatio: "16 / 9" }), { width: 99999, height: 99999 });
    expect(clamped.width).toBe(8192);
    expect(clamped.height).toBe(8192);
  });

  it("ignores a partial width/height and falls back to scale", () => {
    const size = resolveSpinRenderSize(sceneWith({ aspectRatio: "16 / 9" }), { width: 1920 });
    expect(size.width).toBe(EXPORT_BASE_WIDTH * 2);
  });
});

describe("singleFrameCssSize", () => {
  it("fills the canvas for the frameless scene", () => {
    const size = singleFrameCssSize(sceneWith({ frame: "none", aspectRatio: "4 / 3" }), 800, 600);
    expect(size.w).toBeCloseTo(800, 6);
    expect(size.h).toBeCloseTo(600, 6);
  });

  it("contains a portrait phone by height in a landscape canvas", () => {
    // Phone AR ≈ 0.46; canvas 16/9 → the limiting axis is height.
    const size = singleFrameCssSize(sceneWith({ frame: "iphone" }), 1600, 900);
    expect(size.h).toBeCloseTo(900, 6);
    expect(size.w / size.h).toBeLessThan(1);
  });

  it("contains a landscape device by width in a portrait canvas", () => {
    const size = singleFrameCssSize(sceneWith({ frame: "macbook", aspectRatio: "9 / 16" }), 900, 1600);
    expect(size.w).toBeCloseTo(900, 6);
    expect(size.w / size.h).toBeGreaterThan(1);
  });
});
