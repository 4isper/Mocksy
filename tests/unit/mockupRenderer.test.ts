import { describe, expect, it } from "vitest";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return { ...initialScene.layers[0]!, id: overrides.id ?? "layer-test", ...overrides };
}

function base(overrides: { layer?: Partial<MediaLayer> } & Partial<EditorScene> = {}): EditorScene {
  const l = layer(overrides.layer ?? {});
  const { layer: _layer, ...sceneOverrides } = overrides;
  return { ...initialScene, layers: [l], activeLayerId: l.id, ...sceneOverrides };
}

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

  it("does not scale the frame by zoom (zoom is applied by AnimationLayer)", () => {
    const scaled = buildSceneCss(base({ layer: { zoom: 1.2 } })).frame.transform;
    const unscaled = buildSceneCss(base({ layer: { zoom: 1 } })).frame.transform;
    expect(scaled).toBe("none");
    expect(unscaled).toBe("none");
  });

  it("establishes a positioning context so media/overlay anchor to the frame", () => {
    // The absolutely-positioned media and overlay skin must inset relative to
    // the frame, not the canvas; otherwise they drift once the frame is
    // contained (and centered) inside the canvas.
    expect(buildSceneCss(base({ frame: "iphone15" })).frame.position).toBe("relative");
    expect(buildSceneCss(base({ frame: "none" })).frame.position).toBe("relative");
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

  it("keeps its own device aspect ratio for CSS-only frames, ignoring the scene", () => {
    const css = buildSceneCss(base({ frame: "iphone", aspectRatio: "16 / 9" })).frame;
    expect(css.aspectRatio).toBe("390 / 844");
  });

  it("sizes a portrait frame by its height so maxHeight never stretches it wide", () => {
    // On a wide (16/9) canvas a fixed width + maxHeight used to clamp the
    // height and stretch the phone into a wide rectangle, distorting the skin.
    const css = buildSceneCss(base({ frame: "iphone15", aspectRatio: "16 / 9" })).frame;
    expect(css.height).toBe("100%");
    expect(css.width).toBe("auto");
  });

  it("sizes a landscape frame by its width on a portrait canvas so it stays contained", () => {
    // A wide frame on a narrow (9/16) canvas must lean on the width limit,
    // otherwise maxWidth clamps the width and breaks the ratio.
    const css = buildSceneCss(base({ frame: "desktop", aspectRatio: "9 / 16" })).frame;
    expect(css.width).toBe("100%");
    expect(css.height).toBe("auto");
  });

  it("still follows the scene aspect ratio for the 'none' frame", () => {
    const css = buildSceneCss(base({ frame: "none", aspectRatio: "16 / 9" })).frame;
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

  it("converts cutout percentages off each skin's own viewBox", () => {
    const macbook = buildSceneCss(base({ frame: "macbook" }));
    expect(macbook.frame.aspectRatio).toBe("1600 / 1040");
    expect(macbook.mediaStyle.left).toBe(`${(44 / 1600) * 100}%`);
    expect(macbook.mediaStyle.top).toBe(`${(34 / 1040) * 100}%`);
    expect(macbook.mediaStyle.width).toBe(`${(1512 / 1600) * 100}%`);
    expect(macbook.mediaStyle.height).toBe(`${(944 / 1040) * 100}%`);
    const imac = buildSceneCss(base({ frame: "imac" }));
    expect(imac.frame.aspectRatio).toBe("1600 / 1420");
    expect(imac.mediaStyle.left).toBe(`${(70 / 1600) * 100}%`);
    expect(imac.mediaStyle.top).toBe(`${(80 / 1420) * 100}%`);
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

  it("pans media via object-position from mediaOffset fields", () => {
    const { mediaStyle } = buildSceneCss(base({ layer: { mediaOffsetX: 0.5, mediaOffsetY: -0.5 } }));
    expect(mediaStyle.objectPosition).toBe("75% 25%");
    const overlay = buildSceneCss(base({ frame: "iphone15", layer: { mediaOffsetX: -1, mediaOffsetY: 1 } }));
    expect(overlay.mediaStyle.objectPosition).toBe("0% 100%");
  });

  it("renders the watch frame as a full circle", () => {
    const { frame } = buildSceneCss(base({ frame: "watch" }));
    expect(frame.borderRadius).toBe("50%");
  });

  it("exposes the background image url and blur for image mode", () => {
    const css = buildSceneCss(
      base({ backgroundMode: "image", backgroundImageUrl: "data:image/png;base64,AAA", backgroundBlur: 12 })
    );
    expect(css.backgroundImage).toBe("data:image/png;base64,AAA");
    expect(css.backgroundBlur).toBe(12);
    // the container shows a neutral fallback so blurred edges have backing
    expect(css.container.background).toBe("#0a0a0f");
  });

  it("keeps backgroundImage null for non-image modes", () => {
    const solid = buildSceneCss(base({ backgroundMode: "solid", backgroundColor: "#09090b" }));
    expect(solid.backgroundImage).toBeNull();
    const gradient = buildSceneCss(base({ backgroundMode: "gradient" }));
    expect(gradient.backgroundImage).toBeNull();
  });

  it("uses object-fit cover by default and contain when set", () => {
    const cover = buildSceneCss(base({ layer: { mediaFit: "cover" } })).mediaStyle.objectFit;
    expect(cover).toBe("cover");
    const contain = buildSceneCss(base({ layer: { mediaFit: "contain" } })).mediaStyle.objectFit;
    expect(contain).toBe("contain");
  });
});
