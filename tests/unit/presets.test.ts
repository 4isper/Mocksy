import { describe, expect, it } from "vitest";
import { applySceneStylePreset, backgroundPresets, sceneStylePresets } from "@/lib/presets/presets";
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
