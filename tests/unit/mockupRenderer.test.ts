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

  it("drops the rectangular CSS shadow for overlay frames (skin carries its own)", () => {
    const overlay = buildSceneCss(base({ frame: "iphone15" }));
    const cssOnly = buildSceneCss(base({ frame: "iphone" }));
    expect(overlay.frame.boxShadow).toBe("none");
    expect(overlay.frame.borderRadius).toBe(0);
    expect(cssOnly.frame.boxShadow).toContain("70px");
    // The body-shaped shadow lives on the frame group via filter, driven by
    // the Shadow control (scene.shadowOpacity).
    expect(overlay.frame.filter).toContain("drop-shadow");
    expect(overlay.frame.filter).toContain(String(overlayShadowOpacity()));
  });

  function overlayShadowOpacity() {
    return base({ frame: "iphone15" }).shadowOpacity;
  }

  it("adopts the overlay skin's aspect ratio for iphone15", () => {
    const overlay = buildSceneCss(base({ frame: "iphone15", aspectRatio: "16 / 9" })).frame;
    expect(overlay.aspectRatio).toBe("390 / 844");
  });

  it("keeps the scene aspect ratio for CSS-only frames", () => {
    const css = buildSceneCss(base({ frame: "iphone", aspectRatio: "16 / 9" })).frame;
    expect(css.aspectRatio).toBe("16 / 9");
  });

  it("insets media to the SVG cutout for overlay frames (frame padding drops to 0)", () => {
    const overlay = buildSceneCss(base({ frame: "iphone15" }));
    const cssOnly = buildSceneCss(base({ frame: "iphone" })).frame;
    expect(overlay.frame.padding).toBe(0);
    expect(overlay.mediaStyle.position).toBe("absolute");
    // Percent-based inset matching the viewBox cutout (14/390, 14/844).
    expect(overlay.mediaStyle.left).toBe(`${(14 / 390) * 100}%`);
    expect(overlay.mediaStyle.top).toBe(`${(14 / 844) * 100}%`);
    expect(overlay.mediaStyle.width).toBe(`${(362 / 390) * 100}%`);
    expect(overlay.mediaStyle.height).toBe(`${(816 / 844) * 100}%`);
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

  it("renders the watch frame as a full circle", () => {
    const { frame } = buildSceneCss(base({ frame: "watch" }));
    expect(frame.borderRadius).toBe("50%");
  });
});
