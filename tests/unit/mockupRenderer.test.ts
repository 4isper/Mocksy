import { describe, expect, it } from "vitest";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

const base = (overrides: Partial<EditorScene> = {}): EditorScene => ({
  ...initialScene,
  ...overrides
});

describe("buildSceneCss", () => {
  it("applies a solid background when mode is solid", () => {
    const { container } = buildSceneCss(base({ backgroundMode: "solid", backgroundColor: "#09090b" }));
    expect(container.background).toBe("#09090b");
  });

  it("applies a gradient background when mode is gradient", () => {
    const { container } = buildSceneCss(
      base({ backgroundMode: "gradient", gradientFrom: "#1d4ed8", gradientTo: "#7c3aed" })
    );
    expect(container.background).toContain("linear-gradient(120deg, #1d4ed8, #7c3aed)");
  });

  it("applies transparent background when mode is transparent", () => {
    const { container } = buildSceneCss(base({ backgroundMode: "transparent" }));
    expect(container.background).toBe("transparent");
  });

  it("scales the frame by zoom", () => {
    const scaled = buildSceneCss(base({ zoom: 1.2 })).frame.transform;
    const unscaled = buildSceneCss(base({ zoom: 1 })).frame.transform;
    expect(scaled).toContain("scale(1.2)");
    expect(unscaled).toContain("scale(1)");
  });

  it("uses overlay asset for iphone15 and omits frame border", () => {
    const css = buildSceneCss(base({ frame: "iphone15" }));
    expect(css.frameOverlay).toMatch(/iphone15\.svg$/);
    expect(css.frame.border).toBe("none");
    expect(css.frame.backdropFilter).toBe("none");
  });

  it("applies padding to overlay frames so media sits inside the SVG screen cutout", () => {
    const overlay = buildSceneCss(base({ frame: "iphone15" })).frame;
    const cssOnly = buildSceneCss(base({ frame: "iphone" })).frame;
    expect(overlay.padding).toBe(14);
    expect(cssOnly.padding).toBe(18);
  });

  it("draws a CSS border for outline frames", () => {
    const { frame } = buildSceneCss(base({ frame: "none", stylePreset: "outline" }));
    expect(frame.border).toContain("solid");
    expect(frame.padding).toBeDefined();
  });

  it("applies blur backdrop for glass styles on non-overlay frames", () => {
    const { frame } = buildSceneCss(base({ frame: "iphone", stylePreset: "glassLight" }));
    expect(frame.backdropFilter).toBe("blur(10px)");
  });

  it("exposes the spec screen radius", () => {
    const { screenRadius } = buildSceneCss(base({ frame: "iphone16pro" }));
    expect(screenRadius).toBe(48);
  });
});
