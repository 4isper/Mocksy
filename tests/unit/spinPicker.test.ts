import { describe, expect, it } from "vitest";
import {
  applySpinMedia,
  mulberry32,
  randomSeed,
  sanitizePack,
  spinScene,
  SPIN_STYLE_PRESETS
} from "@/lib/presets/spinPicker";
import { backgroundPresets } from "@/lib/presets/presets";
import { initialScene } from "@/lib/state/editorScene";
import { FRAME_ORDER, ASPECT_RATIOS } from "@/lib/render/frames";

const MEDIA = "data:image/png;base64,iVBORw0KGgo=";

describe("mulberry32", () => {
  it("is deterministic for a fixed seed", () => {
    const a = Array.from({ length: 10 }, () => mulberry32(42)());
    const b = Array.from({ length: 10 }, () => mulberry32(42)());
    expect(a).toEqual(b);
  });

  it("produces values in [0, 1)", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (let i = 0; i < 20; i++) {
        const v = mulberry32(seed)();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it("different seeds produce different sequences (statistically)", () => {
    const s1 = mulberry32(1)();
    const s2 = mulberry32(2)();
    expect(s1).not.toBe(s2);
  });
});

describe("randomSeed", () => {
  it("returns a non-negative integer", () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});

describe("sanitizePack", () => {
  it("drops frames whose ids are not real frames", () => {
    const pack = sanitizePack({ frames: [{ id: "nokia-3310" }, { id: "iphone", weight: 3 }] });
    expect(pack.frames).toEqual([{ id: "iphone", weight: 3 }]);
  });

  it("keeps only valid backgrounds and style presets", () => {
    const pack = sanitizePack({
      backgrounds: [{ id: "sunset" }, { id: "bogus" }],
      styles: [{ id: "glassLight" }, { id: "neon" }]
    });
    expect(pack.backgrounds).toEqual([{ id: "sunset" }]);
    expect(pack.styles).toEqual([{ id: "glassLight" }]);
  });

  it("clamps tilt and shadow ranges to legal bounds", () => {
    const pack = sanitizePack({
      tilt: { min: -100, max: 100 },
      shadow: { min: -1, max: 2 }
    });
    expect(pack.tilt).toEqual({ min: -25, max: 25 });
    expect(pack.shadow).toEqual({ min: 0, max: 1 });
  });

  it("accepts boolean tilt and shadow toggles", () => {
    const pack = sanitizePack({ tilt: false, shadow: true });
    expect(pack.tilt).toBe(false);
    expect(pack.shadow).toBe(true);
  });

  it("coerces invalid weights to the default and omits it", () => {
    const pack = sanitizePack({ frames: [{ id: "iphone", weight: -5 }] });
    expect(pack.frames).toEqual([{ id: "iphone" }]);
  });

  it("returns an empty pack for garbage input", () => {
    expect(sanitizePack(null)).toEqual({});
    expect(sanitizePack("nope")).toEqual({});
    expect(sanitizePack(Array.from({ length: 200 }, () => ({ id: "x" })))).toEqual({});
  });
});

describe("spinScene", () => {
  it("is deterministic for a fixed seed", () => {
    const a = spinScene(initialScene, {}, 123);
    const b = spinScene(initialScene, {}, 123);
    expect(a.scene).toEqual(b.scene);
    expect(a.seed).toBe(123);
  });

  it("only ever picks frames the pack allows", () => {
    for (let seed = 0; seed < 30; seed++) {
      const { scene } = spinScene(initialScene, { frames: [{ id: "iphone" }, { id: "macbook" }] }, seed);
      expect(["iphone", "macbook"]).toContain(scene.frame);
    }
  });

  it("picks backgrounds from the pack whitelist", () => {
    for (let seed = 0; seed < 30; seed++) {
      const { scene } = spinScene(initialScene, { backgrounds: [{ id: "zinc" }, { id: "sunset" }] }, seed);
      expect(["#09090b", "#f97316"]).toContain(scene.backgroundColor);
    }
  });

  it("picks styles from the pack whitelist", () => {
    for (let seed = 0; seed < 30; seed++) {
      const { scene } = spinScene(initialScene, { styles: [{ id: "glassDark" }, { id: "outline" }] }, seed);
      expect(["glassDark", "outline"]).toContain(scene.stylePreset);
    }
  });

  it("disables tilt when the pack says so", () => {
    const { scene } = spinScene(initialScene, { tilt: false }, 7);
    expect(scene.tiltX).toBe(0);
    expect(scene.tiltY).toBe(0);
  });

  it("honours an explicit tilt range", () => {
    const { scene } = spinScene(initialScene, { tilt: { min: 5, max: 5 } }, 7);
    expect([scene.tiltX, scene.tiltY].every((v) => v === 5)).toBe(true);
  });

  it("honours an explicit shadow range", () => {
    const { scene } = spinScene(initialScene, { shadow: { min: 0.1, max: 0.1 } }, 7);
    expect(scene.shadowOpacity).toBe(0.1);
  });

  it("picks border radius from the pack list", () => {
    for (let seed = 0; seed < 20; seed++) {
      const { scene } = spinScene(initialScene, { borderRadius: [12, 24] }, seed);
      expect([12, 24]).toContain(scene.borderRadius);
    }
  });

  it("picks aspect ratio from the pack list", () => {
    for (let seed = 0; seed < 20; seed++) {
      const { scene } = spinScene(initialScene, { aspectRatio: ["1 / 1", "9 / 16"] }, seed);
      expect(["1 / 1", "9 / 16"]).toContain(scene.aspectRatio);
    }
  });

  it("clears frame instances and annotations on a fresh spin", () => {
    const base = { ...initialScene, frameInstances: [{ id: "f1", frame: "iphone" as const, x: 0, y: 0, scale: 1, layerId: null }], annotations: [{ id: "a", type: "text" as const, x: 0, y: 0, w: 0.1, h: 0.1, text: "x", color: "#fff", fontSize: 12, strokeWidth: 0 }] };
    const { scene } = spinScene(base, {}, 1);
    expect(scene.frameInstances).toEqual([]);
    expect(scene.annotations).toEqual([]);
  });

  it("with an empty pack yields a normalized, valid scene", () => {
    const { scene } = spinScene(initialScene, {}, 5);
    expect(FRAME_ORDER).toContain(scene.frame);
    expect(scene.layers.length).toBeGreaterThan(0);
    expect(scene.aspectRatio).toMatch(/^\d+ \/ \d+$/);
  });
});

describe("applySpinMedia", () => {
  it("replaces layers with a single media layer carrying the data URL", () => {
    const base = spinScene(initialScene, { frames: [{ id: "iphone" }] }, 1).scene;
    const next = applySpinMedia(base, MEDIA, "image");
    expect(next.layers).toHaveLength(1);
    expect(next.layers[0]?.mediaUrl).toBe(MEDIA);
    expect(next.layers[0]?.mediaType).toBe("image");
    expect(next.activeLayerId).toBe(next.layers[0]?.id);
  });

  it("labels video media as video", () => {
    const base = spinScene(initialScene, {}, 1).scene;
    const next = applySpinMedia(base, "data:video/mp4;base64,AAAA", "video");
    expect(next.layers[0]?.mediaType).toBe("video");
  });

  it("stays a valid scene through normalizeScene", () => {
    const base = spinScene(initialScene, {}, 2).scene;
    const next = applySpinMedia(base, MEDIA, "image");
    expect(next.layers[0]?.zoom).toBe(1);
    expect(FRAME_ORDER).toContain(next.frame);
  });
});

describe("spinScene pack pools stay in sync with the app", () => {
  it("style preset pool matches the editor's StylePreset union", () => {
    expect(SPIN_STYLE_PRESETS).toEqual(["default", "glassLight", "glassDark", "outline"]);
  });

  it("background ids reference real presets", () => {
    const ids = new Set(backgroundPresets.map((p) => p.id));
    expect(ids.has("sunset")).toBe(true);
    expect(ids.has("zinc")).toBe(true);
  });

  it("aspect ratios are drawn from the editor list", () => {
    expect(ASPECT_RATIOS).toContain("16 / 9");
    expect(ASPECT_RATIOS).toContain("9 / 16");
  });
});