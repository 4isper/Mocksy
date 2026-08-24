import { describe, expect, it } from "vitest";
import { ALL_FRAMES, customFrameSpec, getFrameSpec } from "@/lib/render/frames";
import {
  UnsupportedFrameError,
  isSvgFile,
  loadCustomFrameFromFile,
  parseSvgViewBox
} from "@/lib/media/customFrame";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { initialScene } from "@/lib/state/editorStore";
import type { CustomFrame } from "@/lib/types/editor";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
  <rect width="400" height="600" fill="none" stroke="#000" stroke-width="20"/>
  <rect x="40" y="60" width="320" height="480" fill="#fff"/>
</svg>`;

describe("parseSvgViewBox", () => {
  it("parses the width/height from a viewBox", () => {
    expect(parseSvgViewBox('<svg viewBox="0 0 400 600"></svg>')).toEqual({ w: 400, h: 600 });
  });

  it("handles a negative min-x/min-y viewBox", () => {
    expect(parseSvgViewBox('<svg viewBox="-10 -20 300 450"></svg>')).toEqual({ w: 300, h: 450 });
  });

  it("tolerates comma or whitespace separators", () => {
    expect(parseSvgViewBox('<svg viewBox="0,0,800,1000"></svg>')).toEqual({ w: 800, h: 1000 });
  });

  it("falls back to a default canvas when the SVG has no valid viewBox", () => {
    expect(parseSvgViewBox("<svg width='400'></svg>")).toEqual({ w: 800, h: 600 });
    expect(parseSvgViewBox('<svg viewBox="0 0 0 0"></svg>')).toEqual({ w: 800, h: 600 });
  });
});

describe("isSvgFile", () => {
  it("recognizes SVG files by MIME type or extension", () => {
    const byMime = new File(["<svg/>"], "skin.svg", { type: "image/svg+xml" });
    const byName = new File(["<svg/>"], "skin.svg", { type: "text/plain" });
    expect(isSvgFile(byMime)).toBe(true);
    expect(isSvgFile(byName)).toBe(true);
  });

  it("rejects non-SVG files", () => {
    const png = new File([""], "shot.png", { type: "image/png" });
    expect(isSvgFile(png)).toBe(false);
  });
});

describe("loadCustomFrameFromFile", () => {
  it("builds a CustomFrame with a data URL asset and a full-viewBox cutout", async () => {
    const file = new File([SAMPLE_SVG], "device.svg", { type: "image/svg+xml" });
    const frame = await loadCustomFrameFromFile(file);
    expect(frame.name).toBe("device.svg");
    expect(frame.asset).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(frame.viewBox).toEqual({ w: 400, h: 600 });
    expect(frame.cutout).toEqual({ x: 0, y: 0, w: 400, h: 600, rx: 0 });
  });

  it("rejects non-SVG files", async () => {
    const png = new File([""], "shot.png", { type: "image/png" });
    await expect(loadCustomFrameFromFile(png)).rejects.toBeInstanceOf(UnsupportedFrameError);
  });
});

describe("custom frame specs", () => {
  const frame: CustomFrame = {
    id: "custom-1",
    asset: "data:image/svg+xml;base64,c3Zn",
    name: "phone.svg",
    viewBox: { w: 500, h: 1000 },
    cutout: { x: 10, y: 10, w: 480, h: 980, rx: 20 }
  };

  it("getFrameSpec resolves the custom frame spec when a payload is attached", () => {
    const spec = getFrameSpec("custom", frame);
    expect(spec.isOverlay).toBe(true);
    expect(spec.asset).toBe(frame.asset);
    expect(spec.aspectRatio).toBe("500 / 1000");
    expect(spec.cutout).toEqual(frame.cutout);
    expect(spec.viewBox).toEqual({ w: 500, h: 1000 });
  });

  it("customFrameSpec exposes the skin's viewBox-derived aspect ratio", () => {
    expect(customFrameSpec(frame).aspectRatio).toBe("500 / 1000");
  });

  it("falls back to the none spec when custom has no payload", () => {
    const spec = getFrameSpec("custom", null);
    expect(spec).toEqual(getFrameSpec("none"));
    expect(spec.isOverlay).toBe(false);
  });

  it("registers custom in ALL_FRAMES", () => {
    expect(ALL_FRAMES).toContain("custom");
  });
});

describe("normalizeScene with custom frames", () => {
  const frame: CustomFrame = {
    id: "custom-9",
    asset: "data:image/svg+xml;base64,c3Zn",
    name: "skin.svg",
    viewBox: { w: 200, h: 400 },
    cutout: { x: 0, y: 0, w: 200, h: 400, rx: 0 }
  };

  it("keeps frame custom when a valid customFrame payload survives", () => {
    const scene = normalizeScene({ ...initialScene, frame: "custom", customFrame: frame });
    expect(scene.frame).toBe("custom");
    expect(scene.customFrame).toEqual(frame);
  });

  it("drops invalid customFrame payloads", () => {
    const scene = normalizeScene({ ...initialScene, frame: "custom", customFrame: { asset: 42 } });
    expect(scene.customFrame).toBeNull();
  });

  it("falls back to the default frame when custom has no payload", () => {
    const scene = normalizeScene({ ...initialScene, frame: "custom", customFrame: null });
    expect(scene.frame).toBe(initialScene.frame);
    expect(scene.customFrame).toBeNull();
  });
});
