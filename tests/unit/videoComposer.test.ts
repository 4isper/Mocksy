import { describe, expect, it } from "vitest";
import { buildVideoTimeline, sampleVideoTransform } from "@/lib/render/videoComposer";
import type { MediaLayer } from "@/lib/types/editor";

const layer: MediaLayer = {
  id: "l1",
  mediaUrl: null,
  mediaType: "none",
  mediaName: null,
  hidden: false,
  animationPreset: "zoomIn",
  zoom: 1,
  mediaOffsetX: 0,
  mediaOffsetY: 0,
  mediaFit: "cover",
  videoMuted: true,
  videoLoop: true,
  videoAutoplay: true,
  videoPosterTime: 0,
  videoDuration: 0,
  videoTrimStart: 0,
  videoTrimEnd: 0,
  videoQuality: "medium"
};

describe("buildVideoTimeline", () => {
  it("returns zoom keyframes for zoomIn preset", () => {
    const timeline = buildVideoTimeline(layer);
    expect(timeline.length).toBe(2);
    expect(timeline[1]?.zoom).toBeGreaterThan(timeline[0]?.zoom ?? 0);
  });

  it("returns a three-point parallax timeline", () => {
    const parallaxLayer = { ...layer, animationPreset: "parallax" as const };
    const timeline = buildVideoTimeline(parallaxLayer);
    expect(timeline.length).toBe(3);
    expect(timeline[0]?.at).toBe(0);
    expect(timeline[2]?.at).toBe(1);
    expect(timeline[1]?.x).not.toBe(0);
  });

  it("returns a single static keyframe for none", () => {
    const noneLayer = { ...layer, animationPreset: "none" as const };
    const timeline = buildVideoTimeline(noneLayer);
    expect(timeline.length).toBe(1);
    expect(timeline[0]?.zoom).toBe(noneLayer.zoom);
  });
});

describe("sampleVideoTransform", () => {
  it("returns the layer zoom for the none preset (drives the static preview)", () => {
    const noneLayer = { ...layer, animationPreset: "none" as const, zoom: 1.2 };
    expect(sampleVideoTransform(noneLayer, 0).zoom).toBe(1.2);
  });

  it("interpolates zoomIn from 1 to 1.12 across the progress", () => {
    const mid = sampleVideoTransform(layer, 0.5);
    expect(mid.zoom).toBeCloseTo(1.06, 5);
    expect(sampleVideoTransform(layer, 0).zoom).toBe(1);
    expect(sampleVideoTransform(layer, 1).zoom).toBe(1.12);
  });

  it("sweeps parallax offsets from negative to positive and back", () => {
    const start = sampleVideoTransform({ ...layer, animationPreset: "parallax" }, 0);
    const mid = sampleVideoTransform({ ...layer, animationPreset: "parallax" }, 0.5);
    const end = sampleVideoTransform({ ...layer, animationPreset: "parallax" }, 1);
    expect(start.x).toBeLessThan(0);
    expect(mid.x).toBeGreaterThan(0);
    expect(end.x).toBe(start.x);
  });

  it("clamps progress to the 0..1 range", () => {
    const under = sampleVideoTransform(layer, -1);
    const over = sampleVideoTransform(layer, 2);
    expect(under.zoom).toBe(sampleVideoTransform(layer, 0).zoom);
    expect(over.zoom).toBe(sampleVideoTransform(layer, 1).zoom);
  });
});
