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

  it("normalizes frameInstances array for multi-frame scenes", () => {
    const s = normalizeScene({
      frameInstances: [
        { id: "f1", frame: "iphone15", x: 0, y: 0.5, scale: 0.5, layerId: null }
      ]
    });
    expect(s.frameInstances).toHaveLength(1);
    expect(s.frameInstances[0]!.id).toBe("f1");
    expect(s.frameInstances[0]!.frame).toBe("iphone15");
    expect(s.frameInstances[0]!.x).toBe(0);
    expect(s.frameInstances[0]!.scale).toBe(0.5);
  });

  it("ignores invalid frameInstances entries", () => {
    const s = normalizeScene({
      frameInstances: [null, { frame: "invalid" }, { id: "f2", frame: "iphone", x: 10, y: -5, scale: 0.5 }]
    });
    // Invalid entries fall back to defaults
    expect(s.frameInstances.length).toBeGreaterThan(0);
  });

  it("activeLayerId falls back to first layer id when not a string", () => {
    const s = normalizeScene({ layers: [{ id: "my-layer" }], activeLayerId: 123 });
    expect(s.activeLayerId).toBe("my-layer");
  });

  it("accepts explicit string values for background and watermark fields", () => {
    const s = normalizeScene({
      backgroundColor: "#ff0000",
      gradientFrom: "#00ff00",
      gradientTo: "#0000ff",
      watermarkText: "Custom",
      aspectRatio: "1 / 1"
    });
    expect(s.backgroundColor).toBe("#ff0000");
    expect(s.gradientFrom).toBe("#00ff00");
    expect(s.gradientTo).toBe("#0000ff");
    expect(s.watermarkText).toBe("Custom");
    expect(s.aspectRatio).toBe("1 / 1");
  });

  it("accepts explicit gradient angle", () => {
    const s = normalizeScene({ gradientAngle: 90 });
    expect(s.gradientAngle).toBe(90);
  });

  it("clamps animation duration into range and falls back for invalid input", () => {
    expect(normalizeScene({ animationDurationMs: 6000 }).animationDurationMs).toBe(6000);
    expect(normalizeScene({ animationDurationMs: 99 }).animationDurationMs).toBe(500);
    expect(normalizeScene({ animationDurationMs: 99999 }).animationDurationMs).toBe(20000);
    expect(normalizeScene({ animationDurationMs: Number.NaN }).animationDurationMs).toBe(initialScene.animationDurationMs);
    expect(normalizeScene({}).animationDurationMs).toBe(initialScene.animationDurationMs);
  });

  it("accepts explicit background image URL", () => {
    const s = normalizeScene({ backgroundImageUrl: "data:image/png;base64,abc" });
    expect(s.backgroundImageUrl).toBe("data:image/png;base64,abc");
  });

  it("normalizes background audio fields", () => {
    const s = normalizeScene({
      backgroundAudioUrl: "data:audio/mp3;base64,xyz",
      backgroundAudioName: "song.mp3"
    });
    expect(s.backgroundAudioUrl).toBe("data:audio/mp3;base64,xyz");
    expect(s.backgroundAudioName).toBe("song.mp3");
  });

  it("falls back to null for invalid background audio fields", () => {
    const s = normalizeScene({ backgroundAudioUrl: 42, backgroundAudioName: true });
    expect(s.backgroundAudioUrl).toBeNull();
    expect(s.backgroundAudioName).toBeNull();
  });

  it("fills a fallback layer when layers array is empty", () => {
    const s = normalizeScene({ layers: [], activeLayerId: null });
    expect(s.layers).toHaveLength(1);
    expect(s.layers[0]!.mediaUrl).toBe(initialScene.layers[0]!.mediaUrl);
  });

  it("replaces null entries in layers array with demo layer", () => {
    const s = normalizeScene({ layers: [null, { mediaUrl: "data:image/png;base64,x" }] });
    expect(s.layers).toHaveLength(2);
    expect(s.layers[0]!.mediaUrl).toBe(initialScene.layers[0]!.mediaUrl);
    expect(s.layers[1]!.mediaUrl).toBe("data:image/png;base64,x");
  });

  it("replaces null entries in annotations array with a default annotation", () => {
    const s = normalizeScene({ annotations: [null, { type: "arrow" }] });
    expect(s.annotations).toHaveLength(2);
    expect(s.annotations[0]!.type).toBe("rect");
    expect(s.annotations[1]!.type).toBe("arrow");
  });

  it("generates an id for annotation with empty string id", () => {
    const s = normalizeScene({ annotations: [{ id: "", type: "rect" }] });
    expect(s.annotations[0]!.id.length).toBeGreaterThan(0);
    expect(s.annotations[0]!.id).not.toBe("");
  });
});
