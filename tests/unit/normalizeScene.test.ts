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
    const s = normalizeScene({ zoom: 99, shadowOpacity: -5, borderRadius: Number.NaN });
    expect(s.zoom).toBe(3);
    expect(s.shadowOpacity).toBe(0);
    expect(s.borderRadius).toBe(initialScene.borderRadius);
  });

  it("coerces numeric strings and drops values outside range", () => {
    const s = normalizeScene({ zoom: "1.5", shadowOpacity: "2" });
    expect(s.zoom).toBe(1.5);
    expect(s.shadowOpacity).toBe(1);
  });

  it("restores a valid subset without losing defaults", () => {
    const s = normalizeScene({ mediaUrl: "x.png", mediaType: "image", frame: "iphone16pro" });
    expect(s.mediaUrl).toBe("x.png");
    expect(s.mediaType).toBe("image");
    expect(s.frame).toBe("iphone16pro");
    expect(s.zoom).toBe(initialScene.zoom);
    expect(s.watermarkText).toBe(initialScene.watermarkText);
  });

  it("treats missing boolean flags as enabled", () => {
    const s = normalizeScene({ videoMuted: false, watermarkEnabled: true });
    expect(s.videoMuted).toBe(false);
    expect(s.watermarkEnabled).toBe(true);
    expect(s.videoLoop).toBe(true);
  });
});
