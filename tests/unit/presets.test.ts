import { describe, expect, it } from "vitest";
import { applySceneStylePreset, backgroundPresets, randomSceneStyle, sceneStylePresets } from "@/lib/presets/presets";
import { SOCIAL_PRESETS, parseAspectRatio } from "@/lib/presets/socialPresets";
import { initialScene } from "@/lib/state/editorStore";

describe("backgroundPresets", () => {
  it("exposes a transparent, solids and gradients", () => {
    const kinds = backgroundPresets.map((p) => p.kind);
    expect(kinds).toContain("transparent");
    expect(kinds.filter((k) => k === "solid").length).toBeGreaterThan(0);
    expect(kinds.filter((k) => k === "gradient").length).toBeGreaterThan(0);
  });

  it("gradient presets carry both color stops", () => {
    const gradients = backgroundPresets.filter((p) => p.kind === "gradient");
    for (const preset of gradients) {
      expect(preset.gradientFrom).toBeTruthy();
      expect(preset.gradientTo).toBeTruthy();
    }
  });

  it("exposes pattern presets with a patternId", () => {
    const patterns = backgroundPresets.filter((p) => p.kind === "pattern");
    expect(patterns.length).toBeGreaterThan(0);
    for (const preset of patterns) {
      expect(preset.patternId).toBeTruthy();
    }
  });

  it("has unique ids", () => {
    const ids = backgroundPresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("sceneStylePresets", () => {
  it("has unique ids", () => {
    const ids = sceneStylePresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset carries a full appearance definition", () => {
    for (const preset of sceneStylePresets) {
      expect(preset.frame).toBeTruthy();
      expect(preset.stylePreset).toBeTruthy();
      expect(preset.backgroundMode).toBeTruthy();
      expect(preset.gradientFrom).toBeTruthy();
      expect(preset.gradientTo).toBeTruthy();
      expect(typeof preset.shadowOpacity).toBe("number");
      expect(typeof preset.borderRadius).toBe("number");
    }
  });

  it("applySceneStylePreset returns only appearance fields", () => {
    const preset = sceneStylePresets[0]!;
    const patch = applySceneStylePreset(preset);
    expect(patch.frame).toBe(preset.frame);
    expect(patch.backgroundMode).toBe(preset.backgroundMode);
    expect(patch.watermarkEnabled).toBe(preset.watermarkEnabled);
    // Media layers and aspect ratio must stay out of the patch so applying it
    // never disturbs the user's uploaded media.
    expect("layers" in patch).toBe(false);
    expect("activeLayerId" in patch).toBe(false);
    expect("aspectRatio" in patch).toBe(false);
  });

  it("applying a preset to a scene does not touch its layers", () => {
    const preset = sceneStylePresets.find((p) => p.id === "bold-gradient") ?? sceneStylePresets[0]!;
    const scene = structuredClone(initialScene);
    const patch = applySceneStylePreset(preset);
    const next = { ...scene, ...patch };
    expect(next.layers).toEqual(scene.layers);
    expect(next.frame).toBe(preset.frame);
    expect(next.watermarkEnabled).toBe(preset.watermarkEnabled);
  });
});

describe("randomSceneStyle", () => {
  it("produces a valid appearance patch for any RNG sequence", () => {
    let seed = 42;
    const rand = () => {
      // Deterministic LCG so the test covers many distinct outcomes.
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 200; i++) {
      const patch = randomSceneStyle(rand);
      expect(["default", "glassLight", "glassDark", "outline"]).toContain(patch.stylePreset);
      expect(["solid", "gradient", "pattern"]).toContain(patch.backgroundMode);
      if (patch.backgroundMode === "gradient") {
        expect(patch.gradientFrom).toMatch(/^#/);
        expect(patch.gradientTo).toMatch(/^#/);
        expect(patch.gradientAngle).toBeGreaterThanOrEqual(0);
        expect(patch.gradientAngle).toBeLessThan(360);
      }
      if (patch.backgroundMode === "solid") {
        expect(patch.backgroundColor).toMatch(/^#/);
      }
      if (patch.backgroundMode === "pattern") {
        expect(["dots", "grid", "diagonal", "noise", "plus", "cross", "triangle"]).toContain(patch.patternId);
      }
      expect(patch.shadowOpacity!).toBeGreaterThanOrEqual(0.2);
      expect(patch.shadowOpacity!).toBeLessThanOrEqual(0.6);
    }
  });

  it("never touches media layers, frame, watermark or annotations", () => {
    const patch = randomSceneStyle(() => 0.99);
    expect("layers" in patch).toBe(false);
    expect("frame" in patch).toBe(false);
    expect("watermarkEnabled" in patch).toBe(false);
    expect("annotations" in patch).toBe(false);
    expect("aspectRatio" in patch).toBe(false);
  });

  it("is deterministic for a fixed RNG", () => {
    const rand = () => 0.3;
    expect(randomSceneStyle(rand)).toEqual(randomSceneStyle(rand));
  });
});

describe("SOCIAL_PRESETS", () => {
  it("has unique ids", () => {
    const ids = SOCIAL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers portrait, square and landscape formats", () => {
    const ratios = SOCIAL_PRESETS.map((p) => parseAspectRatio(p.aspectRatio)!.w / parseAspectRatio(p.aspectRatio)!.h);
    expect(ratios).toContain(1);
    expect(ratios.some((r) => r < 1)).toBe(true);
    expect(ratios.some((r) => r > 1)).toBe(true);
  });

  it("every preset carries positive export dimensions matching its aspect ratio", () => {
    for (const preset of SOCIAL_PRESETS) {
      const parsed = parseAspectRatio(preset.aspectRatio);
      expect(parsed).not.toBeNull();
      const { w, h } = parsed!;
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(Math.abs(preset.width / preset.height - w / h)).toBeLessThan(0.01);
    }
  });

  it("parseAspectRatio handles malformed input", () => {
    expect(parseAspectRatio("16 / 9")).toEqual({ w: 16, h: 9 });
    expect(parseAspectRatio("garbage")).toBeNull();
    expect(parseAspectRatio("1 / 0")).toBeNull();
    expect(parseAspectRatio("1")).toBeNull();
  });
});
