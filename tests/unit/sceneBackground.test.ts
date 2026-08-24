import { describe, expect, it } from "vitest";
import { buildCssBackground } from "@/lib/render/sceneBackground";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

function base(overrides: Partial<EditorScene> = {}): EditorScene {
  return { ...initialScene, ...overrides };
}

describe("buildCssBackground", () => {
  it("returns the solid color for solid mode", () => {
    expect(buildCssBackground(base({ backgroundMode: "solid", backgroundColor: "#09090b" }))).toEqual({
      background: "#09090b"
    });
  });

  it("builds a linear gradient with a middle stop", () => {
    const bg = buildCssBackground(
      base({ backgroundMode: "gradient", gradientType: "linear", gradientFrom: "#1d4ed8", gradientVia: "#0ea5e9", gradientTo: "#7c3aed", gradientAngle: 90 })
    );
    expect(bg.background).toBe("linear-gradient(90deg, #1d4ed8, #0ea5e9, #7c3aed)");
  });

  it("builds a radial gradient with a middle stop", () => {
    const bg = buildCssBackground(
      base({ backgroundMode: "gradient", gradientType: "radial", gradientFrom: "#000000", gradientVia: "#111111", gradientTo: "#ffffff" })
    );
    expect(bg.background).toBe("radial-gradient(circle at center, #000000, #111111, #ffffff)");
  });

  it("uses a neutral fallback for image mode (the photo is a separate layer)", () => {
    expect(buildCssBackground(base({ backgroundMode: "image" }))).toEqual({ background: "#0a0a0f" });
  });

  it("renders a dot pattern with a tiled size", () => {
    const bg = buildCssBackground(base({ backgroundMode: "pattern", patternId: "dots" }));
    expect(bg.background).toContain("radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)");
    expect(bg.backgroundSize).toBe("20px 20px");
  });

  it("renders grid and diagonal patterns as repeating gradients", () => {
    const grid = buildCssBackground(base({ backgroundMode: "pattern", patternId: "grid" }));
    expect(grid.background).toContain("repeating-linear-gradient(0deg");
    expect(grid.backgroundSize).toBe("cover");
    const diagonal = buildCssBackground(base({ backgroundMode: "pattern", patternId: "diagonal" }));
    expect(diagonal.background).toContain("repeating-linear-gradient(45deg");
  });

  it("renders noise/plus/cross/triangle patterns as tiled SVG data URLs", () => {
    for (const id of ["noise", "plus", "cross", "triangle"] as const) {
      const bg = buildCssBackground(base({ backgroundMode: "pattern", patternId: id }));
      expect(bg.background).toContain("data:image/svg+xml");
    }
    // The 20x20 glyphs tile; the 100x100 noise decal stretches to cover.
    expect(buildCssBackground(base({ backgroundMode: "pattern", patternId: "plus" })).backgroundSize).toBe("20px 20px");
    expect(buildCssBackground(base({ backgroundMode: "pattern", patternId: "noise" })).backgroundSize).toBe("cover");
  });

  it("falls back to transparent for an unknown pattern id", () => {
    const bg = buildCssBackground(base({ backgroundMode: "pattern", patternId: "bogus" as never }));
    expect(bg.background).toBe("transparent");
  });

  it("falls back to transparent for an unknown background mode", () => {
    expect(buildCssBackground(base({ backgroundMode: "transparent" }))).toEqual({ background: "transparent" });
  });
});
