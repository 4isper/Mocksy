import { describe, expect, it } from "vitest";
import { backgroundPresets } from "@/lib/presets/presets";

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

  it("has unique ids", () => {
    const ids = backgroundPresets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
