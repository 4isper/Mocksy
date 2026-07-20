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

  it("accepts image background mode, url and blur within range", () => {
    const s = normalizeScene({
      backgroundMode: "image",
      backgroundImageUrl: "data:image/png;base64,AAA",
      backgroundBlur: 15
    });
    expect(s.backgroundMode).toBe("image");
    expect(s.backgroundImageUrl).toBe("data:image/png;base64,AAA");
    expect(s.backgroundBlur).toBe(15);
  });

  it("clamps background blur into [0, 40] and ignores non-string urls", () => {
    const s = normalizeScene({ backgroundMode: "image", backgroundBlur: 999, backgroundImageUrl: 42 });
    expect(s.backgroundBlur).toBe(40);
    expect(s.backgroundImageUrl).toBe(initialScene.backgroundImageUrl);
  });

  it("falls back to the default blur for a non-numeric value", () => {
    const s = normalizeScene({ backgroundMode: "image", backgroundBlur: "not-a-number" });
    expect(s.backgroundBlur).toBe(initialScene.backgroundBlur);
  });

  it("normalizes a annotations array with clamping", () => {
    const s = normalizeScene({
      annotations: [
        { type: "text", x: 0.2, y: 0.2, w: 0.3, h: 0, text: "Hi", color: "#fff", fontSize: 40, strokeWidth: 0 },
        { type: "arrow", x: 5, y: 5, w: 0.1, h: 0.1, color: "#f00", strokeWidth: 99 }
      ]
    });
    expect(s.annotations).toHaveLength(2);
    expect(s.annotations[0]!.type).toBe("text");
    expect(s.annotations[0]!.text).toBe("Hi");
    expect(s.annotations[0]!.x).toBe(0.2);
    // out-of-range coordinates clamp into [-1, 2]
    expect(s.annotations[1]!.x).toBe(2);
    expect(s.annotations[1]!.y).toBe(2);
    // strokeWidth clamps into [0, 40]
    expect(s.annotations[1]!.strokeWidth).toBe(40);
  });

  it("returns an empty annotations list for malformed input", () => {
    const s = normalizeScene({ annotations: "nope" });
    expect(s.annotations).toEqual([]);
  });

  it("normalizes mediaFit into cover/contain and falls back for invalid", () => {
    const contain = normalizeScene({ layers: [{ mediaFit: "contain" }] });
    expect(contain.layers[0]!.mediaFit).toBe("contain");
    const bad = normalizeScene({ layers: [{ mediaFit: "stretch" }] });
    expect(bad.layers[0]!.mediaFit).toBe(initialScene.layers[0]!.mediaFit);
  });
});
