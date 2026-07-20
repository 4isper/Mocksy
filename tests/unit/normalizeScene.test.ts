import { describe, expect, it } from "vitest";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { initialScene } from "@/lib/state/editorStore";

describe("normalizeScene", () => {
  it("returns the initial scene for null/non-object input", () => {
    expect(normalizeScene(null)).toEqual(initialScene);
    expect(normalizeScene("garbage")).toEqual(initialScene);
    expect(normalizeScene(42)).toEqual(initialScene);
  });

  it("keeps valid enum values and falls back for invalid ones", () => {
    const s = normalizeScene({ frame: "watch", stylePreset: "glassDark", backgroundMode: "bogus" });
    expect(s.frame).toBe("watch");
    expect(s.stylePreset).toBe("glassDark");
    expect(s.backgroundMode).toBe(initialScene.backgroundMode);
  });

  it("clamps numbers into range and rejects NaN", () => {
    const s = normalizeScene({ layers: [{ zoom: 99 }], shadowOpacity: -5, borderRadius: Number.NaN });
    expect(s.layers[0]!.zoom).toBe(3);
    expect(s.shadowOpacity).toBe(0);
    expect(s.borderRadius).toBe(initialScene.borderRadius);
  });

  it("clamps media offset into [-1, 1] and falls back for NaN", () => {
    const s = normalizeScene({ layers: [{ mediaOffsetX: 5, mediaOffsetY: Number.NaN }] });
    expect(s.layers[0]!.mediaOffsetX).toBe(1);
    expect(s.layers[0]!.mediaOffsetY).toBe(initialScene.layers[0]!.mediaOffsetY);
  });

  it("coerces numeric strings and drops values outside range", () => {
    const s = normalizeScene({ layers: [{ zoom: "1.5" }], shadowOpacity: "2" });
    expect(s.layers[0]!.zoom).toBe(1.5);
    expect(s.shadowOpacity).toBe(1);
  });

  it("migrates a legacy single-media payload into one layer", () => {
    const s = normalizeScene({ mediaUrl: "x.png", mediaType: "image", frame: "iphone16pro" });
    expect(s.layers).toHaveLength(1);
    expect(s.layers[0]!.mediaUrl).toBe("x.png");
    expect(s.layers[0]!.mediaType).toBe("image");
    expect(s.frame).toBe("iphone16pro");
    expect(s.layers[0]!.zoom).toBe(initialScene.layers[0]!.zoom);
    expect(s.watermarkText).toBe(initialScene.watermarkText);
  });

  it("treats missing boolean flags as enabled", () => {
    const s = normalizeScene({ layers: [{ videoMuted: false }], watermarkEnabled: true });
    expect(s.layers[0]!.videoMuted).toBe(false);
    expect(s.watermarkEnabled).toBe(true);
    expect(s.layers[0]!.videoLoop).toBe(true);
  });
});
