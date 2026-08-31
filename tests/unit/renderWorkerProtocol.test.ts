import { describe, expect, it } from "vitest";
import {
  OVERLAY_KEY_PREFIX,
  buildRenderWorkerPayload,
  canRenderSceneInWorker,
  isSvgAssetUrl,
  isSvgMimeType
} from "@/lib/render/renderWorkerProtocol";
import { initialScene } from "@/lib/state/editorScene";

describe("isSvgMimeType", () => {
  it("flags SVG payloads that createImageBitmap cannot rasterize", () => {
    expect(isSvgMimeType("image/svg+xml")).toBe(true);
    expect(isSvgMimeType("image/svg")).toBe(true);
    expect(isSvgMimeType("image/svg-foo+xml")).toBe(true);
    expect(isSvgMimeType("image/png")).toBe(false);
    expect(isSvgMimeType("image/webp")).toBe(false);
    expect(isSvgMimeType("video/mp4")).toBe(false);
    expect(isSvgMimeType("")).toBe(false);
  });
});

describe("isSvgAssetUrl", () => {
  it("detects device-skin paths and inline data: SVGs", () => {
    expect(isSvgAssetUrl("/devices/iphone15.svg")).toBe(true);
    expect(isSvgAssetUrl("https://cdn.test/skin.SVG?v=2")).toBe(true);
    expect(isSvgAssetUrl("data:image/svg+xml;base64,PHN2Zy8+")).toBe(true);
    expect(isSvgAssetUrl("data:image/svg;utf8,<svg/>")).toBe(true);
    expect(isSvgAssetUrl("data:image/png;base64,AAA")).toBe(false);
    expect(isSvgAssetUrl("/media/photo.png")).toBe(false);
    expect(isSvgAssetUrl("https://cdn.test/clip.mp4")).toBe(false);
  });
});

const baseScene = () => ({
  ...initialScene,
  layers: [
    { ...initialScene.layers[0]!, id: "l1", mediaUrl: "data:image/png;base64,AAA" },
    { ...initialScene.layers[0]!, id: "l2", mediaUrl: "data:image/png;base64,BBB" }
  ],
  activeLayerId: "l1"
});

describe("canRenderSceneInWorker", () => {
  it("accepts image-only scenes", () => {
    expect(canRenderSceneInWorker(baseScene())).toBe(true);
  });

  it("rejects video media and empty/hidden active layers", () => {
    const video = baseScene();
    video.layers[0] = { ...video.layers[0]!, mediaType: "video" as never };
    expect(canRenderSceneInWorker(video)).toBe(false);

    const videoOnSecondLayer = baseScene();
    videoOnSecondLayer.layers[1] = { ...videoOnSecondLayer.layers[1]!, mediaType: "video" as never };
    expect(canRenderSceneInWorker(videoOnSecondLayer)).toBe(false);

    // A hidden active layer still renders the other visible layers, so the
    // worker path remains viable — only video layers force the main-thread
    // path (an all-hidden scene has nothing to decode).
    const hidden = baseScene();
    hidden.layers[0] = { ...hidden.layers[0]!, hidden: true };
    expect(canRenderSceneInWorker(hidden)).toBe(true);
  });

  it("rejects multi-frame scenes whose instance layers are not all renderable", () => {
    const s = baseScene();
    s.layers = [...s.layers, { ...s.layers[0]!, id: "l3", mediaType: "video" as never }];
    s.frameInstances = [
      { id: "f1", frame: "iphone16pro", x: 0.25, y: 0.5, scale: 0.4, layerId: "l1" },
      // A null layerId falls back to the first layer, like the renderer does.
      { id: "f2", frame: "iphone16pro", x: 0.75, y: 0.5, scale: 0.4, layerId: null }
    ];
    expect(canRenderSceneInWorker(s)).toBe(true);
    s.frameInstances = [{ id: "f3", frame: "iphone16pro", x: 0.5, y: 0.5, scale: 0.4, layerId: "l3" }];
    expect(canRenderSceneInWorker(s)).toBe(false);
  });
});

describe("buildRenderWorkerPayload", () => {
  it("collects every visible layer's media and the overlay skin for single-frame scenes", () => {
    const payload = buildRenderWorkerPayload({
      id: 7,
      scene: baseScene(),
      width: 800,
      height: 600,
      pixelRatio: 2,
      mimeType: "image/png"
    });
    expect(payload).not.toBeNull();
    expect(payload!.id).toBe(7);
    // Single-frame mode renders every visible layer's media, keyed by layer id.
    expect(payload!.images).toEqual([
      { key: "l1", url: "data:image/png;base64,AAA" },
      { key: "l2", url: "data:image/png;base64,BBB" }
    ]);
    // The default iphone frame is now an overlay skin.
    expect(payload!.overlayUrl).toBe("/devices/iphone.svg");
    expect(payload!.backgroundImageUrl).toBeNull();
    expect(payload!.watermarkImageUrl).toBeNull();
  });

  it("maps per-layer media and skins in multi-frame scenes", () => {
    const s = baseScene();
    s.frameInstances = [
      { id: "f1", frame: "iphone16pro", x: 0.25, y: 0.5, scale: 0.4, layerId: "l1" },
      { id: "f2", frame: "macbook", x: 0.75, y: 0.5, scale: 0.4, layerId: "l2" }
    ];
    const payload = buildRenderWorkerPayload({
      id: 1,
      scene: s,
      width: 1200,
      height: 630,
      pixelRatio: 2,
      mimeType: "image/webp"
    });
    const keys = payload!.images.map((i) => i.key).sort();
    // Skins are keyed by instance id so two instances sharing a layer with
    // different materials each keep their own skin.
    expect(keys).toEqual(["l1", "l2", `${OVERLAY_KEY_PREFIX}f1`, `${OVERLAY_KEY_PREFIX}f2`]);
    const skins = payload!.images.filter((i) => i.key.startsWith(OVERLAY_KEY_PREFIX));
    expect(new Set(skins.map((i) => i.url))).toEqual(new Set(["/devices/iphone16pro.svg", "/devices/macbook.svg"]));
    expect(payload!.mimeType).toBe("image/webp");
  });

  it("passes background/watermark slots through when enabled", () => {
    const s = baseScene();
    s.backgroundMode = "image";
    s.backgroundImageUrl = "data:image/jpeg;base64,CCC";
    s.watermarkEnabled = true;
    s.watermarkImageUrl = "data:image/png;base64,DDD";
    const payload = buildRenderWorkerPayload({
      id: 1,
      scene: s,
      width: 100,
      height: 100,
      pixelRatio: 1,
      mimeType: "image/png"
    });
    expect(payload!.backgroundImageUrl).toBe("data:image/jpeg;base64,CCC");
    expect(payload!.watermarkImageUrl).toBe("data:image/png;base64,DDD");
  });

  it("returns null for unrenderable scenes instead of a broken payload", () => {
    const video = baseScene();
    video.layers[0] = { ...video.layers[0]!, mediaType: "video" as never };
    expect(
      buildRenderWorkerPayload({ id: 1, scene: video, width: 10, height: 10, pixelRatio: 1, mimeType: "image/png" })
    ).toBeNull();
  });

  it("defaults activeLayerId from the scene snapshot", () => {
    const s = baseScene();
    const payload = buildRenderWorkerPayload({ id: 1, scene: s, width: 10, height: 10, pixelRatio: 1, mimeType: "image/png" });
    expect(payload!.activeLayerId).toBe("l1");
    // The null frame is CSS-only (no skin asset).
    const cssOnly = { ...s, frame: "none" as const };
    expect(
      buildRenderWorkerPayload({ id: 1, scene: cssOnly, width: 10, height: 10, pixelRatio: 1, mimeType: "image/png" })!
        .overlayUrl
    ).toBeNull();
  });
});
