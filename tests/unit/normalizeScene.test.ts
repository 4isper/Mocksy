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

  it("clamps tilt into ±25° and rejects NaN", () => {
    const s = normalizeScene({ tiltX: 99, tiltY: -99 });
    expect(s.tiltX).toBe(25);
    expect(s.tiltY).toBe(-25);
    const nan = normalizeScene({ tiltX: Number.NaN, tiltY: Number.NaN });
    expect(nan.tiltX).toBe(initialScene.tiltX);
    expect(nan.tiltY).toBe(initialScene.tiltY);
    expect(normalizeScene({}).tiltX).toBe(0);
    expect(normalizeScene({}).tiltY).toBe(0);
  });

  it("clamps media offset into [-1, 1] and falls back for NaN", () => {
    const s = normalizeScene({ layers: [{ mediaOffsetX: 5, mediaOffsetY: Number.NaN }] });
    expect(s.layers[0]!.mediaOffsetX).toBe(1);
    expect(s.layers[0]!.mediaOffsetY).toBe(initialScene.layers[0]!.mediaOffsetY);
  });

  it("clamps rotation into [-180, 180] and falls back for NaN", () => {
    const s = normalizeScene({ layers: [{ rotation: 360, mediaOffsetX: Number.NaN }] });
    expect(s.layers[0]!.rotation).toBe(180);
    expect(s.layers[0]!.mediaOffsetX).toBe(initialScene.layers[0]!.mediaOffsetX);
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

  it("keeps a valid watermark logo url and ignores non-strings", () => {
    expect(normalizeScene({ watermarkImageUrl: "data:image/png;base64,LOGO" }).watermarkImageUrl).toBe("data:image/png;base64,LOGO");
    expect(normalizeScene({ watermarkImageUrl: 42 }).watermarkImageUrl).toBe(initialScene.watermarkImageUrl);
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

  it("normalizes the annotation animated flag to a boolean", () => {
    const s = normalizeScene({
      annotations: [
        { type: "text", x: 0.1, y: 0.1, w: 0.2, h: 0, text: "Hi", color: "#fff", fontSize: 40, strokeWidth: 2, animated: true },
        { type: "rect", x: 0.1, y: 0.1, w: 0.2, h: 0.2, color: "#fff", strokeWidth: 2, animated: "yes" }
      ]
    });
    expect(s.annotations[0]!.animated).toBe(true);
    expect(s.annotations[1]!.animated).toBe(false);
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

  it("normalizes layer filters with defaults and clamping", () => {
    const s = normalizeScene({ layers: [{ brightness: 150, contrast: 80, saturate: 20, blur: 4, grayscale: 50 }] });
    expect(s.layers[0]).toMatchObject({ brightness: 150, contrast: 80, saturate: 20, blur: 4, grayscale: 50 });
    const clamped = normalizeScene({ layers: [{ brightness: 999, contrast: -5, saturate: 300, blur: 99, grayscale: 200 }] });
    expect(clamped.layers[0]).toMatchObject({ brightness: 200, contrast: 0, saturate: 200, blur: 20, grayscale: 100 });
    const nan = normalizeScene({ layers: [{ brightness: Number.NaN, contrast: Number.NaN, saturate: Number.NaN, blur: Number.NaN, grayscale: Number.NaN }] });
    expect(nan.layers[0]).toMatchObject({ brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0 });
    expect(normalizeScene({}).layers[0]).toMatchObject({ brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0 });
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

  it("normalizes screenGlare and floorReflection flags", () => {
    const s = normalizeScene({ screenGlare: true, floorReflection: true });
    expect(s.screenGlare).toBe(true);
    expect(s.floorReflection).toBe(true);
    const d = normalizeScene({});
    expect(d.screenGlare).toBe(false);
    expect(d.floorReflection).toBe(false);
    // Truthy-but-not-true values are rejected (strict boolean).
    expect(normalizeScene({ screenGlare: "yes" }).screenGlare).toBe(false);
  });

  it("normalizes frame instance orientation (valid kept, invalid dropped)", () => {
    const s = normalizeScene({
      frameInstances: [
        { id: "f1", frame: "iphone15", x: 0.2, y: 0.5, scale: 0.4, layerId: null, orientation: "landscape" },
        { id: "f2", frame: "iphone15", x: 0.8, y: 0.5, scale: 0.4, layerId: null, orientation: "sideways" }
      ]
    });
    expect(s.frameInstances[0]!.orientation).toBe("landscape");
    // Invalid values fall back to portrait (undefined = absent).
    expect(s.frameInstances[1]!.orientation).toBeUndefined();
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

  it("keeps valid animation easing and falls back for invalid ones", () => {
    expect(normalizeScene({ layers: [{ animationEasing: "bounce" }] }).layers[0]!.animationEasing).toBe("bounce");
    expect(normalizeScene({ layers: [{ animationEasing: "spring" }] }).layers[0]!.animationEasing).toBe("spring");
    expect(normalizeScene({ layers: [{ animationEasing: "bogus" }] }).layers[0]!.animationEasing).toBe("easeInOut");
    expect(normalizeScene({ layers: [{}] }).layers[0]!.animationEasing).toBe("easeInOut");
  });

  it("normalizes text annotation typography with defaults for missing values", () => {
    const s = normalizeScene({
      annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.2, h: 0.1, text: "Hi", color: "#fff", fontSize: 24, strokeWidth: 0 }]
    });
    expect(s.annotations[0]).toMatchObject({ fontWeight: "bold", fontStyle: "normal", textAlign: "left" });
    const styled = normalizeScene({
      annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.2, h: 0.1, text: "Hi", color: "#fff", fontSize: 24, strokeWidth: 0, fontWeight: "normal", fontStyle: "italic", textAlign: "center", fontFamily: "Georgia" }]
    });
    expect(styled.annotations[0]).toMatchObject({ fontWeight: "normal", fontStyle: "italic", textAlign: "center", fontFamily: "Georgia" });
    const bogus = normalizeScene({
      annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.2, h: 0.1, text: "Hi", color: "#fff", fontSize: 24, strokeWidth: 0, fontWeight: "heavy", fontStyle: "underlined", textAlign: "justify" }]
    });
    expect(bogus.annotations[0]).toMatchObject({ fontWeight: "bold", fontStyle: "normal", textAlign: "left" });
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

  it("keeps a cleared layer empty instead of resurrecting the demo", () => {
    const s = normalizeScene({ layers: [{ mediaUrl: null, mediaType: "none" as const, mediaName: null }] });
    expect(s.layers).toHaveLength(1);
    expect(s.layers[0]!.mediaUrl).toBeNull();
    expect(s.layers[0]!.mediaType).toBe("none");
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

  it("accepts pattern background mode with a valid pattern id", () => {
    const s = normalizeScene({ backgroundMode: "pattern", patternId: "dots" });
    expect(s.backgroundMode).toBe("pattern");
    expect(s.patternId).toBe("dots");
  });

  it("accepts the plus, cross and triangle pattern ids", () => {
    for (const id of ["plus", "cross", "triangle"]) {
      const s = normalizeScene({ backgroundMode: "pattern", patternId: id });
      expect(s.patternId).toBe(id);
    }
  });

  it("rejects unknown pattern ids and gradient types", () => {
    const s = normalizeScene({ backgroundMode: "pattern", patternId: "waves", gradientType: "cone" });
    expect(s.patternId).toBe(initialScene.patternId);
    expect(s.gradientType).toBe(initialScene.gradientType);
  });

  it("normalizes gradient type and middle stop", () => {
    const s = normalizeScene({ gradientType: "radial", gradientVia: "#0ea5e9" });
    expect(s.gradientType).toBe("radial");
    expect(s.gradientVia).toBe("#0ea5e9");
    const missing = normalizeScene({ gradientType: "radial" });
    expect(missing.gradientVia).toBeNull();
  });

  it("normalizes circle annotations", () => {
    const s = normalizeScene({
      annotations: [{ id: "a1", type: "circle", x: 0.2, y: 0.2, w: 0.3, h: 0.3, text: "", color: "#f00", strokeWidth: 4, fontSize: 0 }]
    });
    expect(s.annotations[0]!.type).toBe("circle");
    const bad = normalizeScene({ annotations: [{ type: "squiggle" }] });
    expect(bad.annotations[0]!.type).toBe("rect");
  });

  it("normalizes text background fields with defaults and clamping", () => {
    const styled = normalizeScene({
      annotations: [{ id: "a1", type: "text", x: 0.1, y: 0.1, w: 0.3, h: 0, text: "Hi", color: "#fff", fontSize: 24, strokeWidth: 0, bgColor: "rgba(0,0,0,0.5)", bgPadding: 12, bgRadius: 4 }]
    });
    expect(styled.annotations[0]).toMatchObject({ bgColor: "rgba(0,0,0,0.5)", bgPadding: 12, bgRadius: 4 });
    const plain = normalizeScene({
      annotations: [{ id: "a2", type: "text", x: 0, y: 0, w: 0.1, h: 0, text: "Hi", color: "#fff", fontSize: 24, strokeWidth: 0 }]
    });
    expect(plain.annotations[0]!.bgColor).toBeNull();
    expect(plain.annotations[0]!.bgPadding).toBe(0);
    expect(plain.annotations[0]!.bgRadius).toBe(0);
    const clamped = normalizeScene({
      annotations: [{ id: "a3", type: "text", x: 0, y: 0, w: 0.1, h: 0, text: "Hi", color: "#fff", fontSize: 24, strokeWidth: 0, bgPadding: 999, bgRadius: -5 }]
    });
    expect(clamped.annotations[0]!.bgPadding).toBe(100);
    expect(clamped.annotations[0]!.bgRadius).toBe(0);
  });

  it("normalizes the screen chrome and falls back for invalid fields", () => {
    const s = normalizeScene({
      screen: { enabled: true, style: "home", theme: "light", time: "10:30", date: "Friday, March 1" }
    });
    expect(s.screen).toMatchObject({ enabled: true, style: "home", theme: "light", time: "10:30", date: "Friday, March 1" });
    // flags default to enabled
    expect(s.screen.showStatusBar).toBe(true);
    expect(s.screen.showDock).toBe(true);
    const bad = normalizeScene({ screen: { enabled: "yes", style: "bogus", theme: "sepia", time: 42, date: null } });
    expect(bad.screen.enabled).toBe(false);
    expect(bad.screen.style).toBe(initialScene.screen.style);
    expect(bad.screen.theme).toBe(initialScene.screen.theme);
    expect(bad.screen.time).toBe(initialScene.screen.time);
    expect(bad.screen.date).toBe(initialScene.screen.date);
    // non-object screen falls back entirely (with an os derived from the frame)
    expect(normalizeScene({ screen: "nope" }).screen).toMatchObject(initialScene.screen);
    expect(normalizeScene({ screen: "nope" }).screen.os).toBe("ios");
  });

  it("honors explicit false screen flags", () => {
    const s = normalizeScene({ screen: { showStatusBar: false, showClock: false, showHomeIndicator: false } });
    expect(s.screen.showStatusBar).toBe(false);
    expect(s.screen.showClock).toBe(false);
    expect(s.screen.showHomeIndicator).toBe(false);
  });

  it("derives the chrome os from the frame", () => {
    expect(normalizeScene({ frame: "pixel8pro" }).screen.os).toBe("android");
    expect(normalizeScene({ frame: "desktop" }).screen.os).toBe("desktop");
    expect(normalizeScene({ frame: "iphone16pro" }).screen.os).toBe("ios");
  });

  it("respects an explicit chrome os over the frame default", () => {
    expect(normalizeScene({ frame: "pixel8pro", screen: { os: "ios" } }).screen.os).toBe("ios");
  });

  it("normalizes browserUrl and falls back for invalid values", () => {
    expect(normalizeScene({ browserUrl: "example.com" }).browserUrl).toBe("example.com");
    expect(normalizeScene({}).browserUrl).toBe(initialScene.browserUrl);
    expect(normalizeScene({ browserUrl: "" }).browserUrl).toBe(initialScene.browserUrl);
    expect(normalizeScene({ browserUrl: 42 }).browserUrl).toBe(initialScene.browserUrl);
    // Hostile payloads can't bloat the scene with an unbounded string.
    const huge = normalizeScene({ browserUrl: "a".repeat(5000) });
    expect(huge.browserUrl.length).toBe(200);
  });

  it("defaults browserChromeTheme to light and accepts dark", () => {
    expect(normalizeScene({}).browserChromeTheme).toBe("light");
    expect(normalizeScene({ browserChromeTheme: "dark" }).browserChromeTheme).toBe("dark");
    expect(normalizeScene({ browserChromeTheme: "bogus" }).browserChromeTheme).toBe("light");
  });

  it("caps oversized layers collection to avoid freezing on hostile payloads", () => {
    const huge = { layers: Array.from({ length: 5000 }, (_, i) => ({ id: `l${i}`, mediaUrl: "x" })) };
    const s = normalizeScene(huge);
    expect(s.layers.length).toBe(200);
  });

  it("caps oversized annotations collection", () => {
    const huge = { annotations: Array.from({ length: 5000 }, (_, i) => ({ id: `a${i}`, type: "text", x: 0, y: 0, w: 0.1, h: 0, text: "t", color: "#fff", fontSize: 24, strokeWidth: 0 })) };
    const s = normalizeScene(huge);
    expect(s.annotations.length).toBe(500);
  });

  it("caps oversized frame instances collection", () => {
    const huge = { frameInstances: Array.from({ length: 5000 }, (_, i) => ({ id: `f${i}`, frame: "iphone" })) };
    const s = normalizeScene(huge);
    expect(s.frameInstances.length).toBe(100);
  });

  it("keeps all items when collections are within the cap", () => {
    const s = normalizeScene({ layers: Array.from({ length: 5 }, (_, i) => ({ id: `l${i}` })) });
    expect(s.layers.length).toBe(5);
  });
});
