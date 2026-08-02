import { describe, expect, it } from "vitest";
import { buildVideoTimeline, sampleVideoTransform, easeInOutQuad } from "@/lib/render/videoComposer";
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
  it("returns the cached timeline array for a given preset", () => {
    // The export/render loop samples every frame; re-allocating the keyframe
    // array 60x per second is pure garbage. Same preset must share the array.
    const a = buildVideoTimeline({ ...layer, animationPreset: "parallax" as const });
    const b = buildVideoTimeline({ ...layer, animationPreset: "parallax" as const });
    expect(a).toBe(b);
  });

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

  it("returns a horizontal pan timeline for panLeft", () => {
    const panLeftLayer = { ...layer, animationPreset: "panLeft" as const };
    const timeline = buildVideoTimeline(panLeftLayer);
    expect(timeline.length).toBe(2);
    expect(timeline[0]?.x).toBe(20);
    expect(timeline[1]?.x).toBe(-20);
    expect(timeline[0]?.y).toBe(0);
    expect(timeline[1]?.y).toBe(0);
    expect(timeline[0]?.zoom).toBe(timeline[1]?.zoom);
  });

  it("returns a horizontal pan timeline for panRight (mirror of panLeft)", () => {
    const panRightLayer = { ...layer, animationPreset: "panRight" as const };
    const timeline = buildVideoTimeline(panRightLayer);
    expect(timeline.length).toBe(2);
    expect(timeline[0]?.x).toBe(-20);
    expect(timeline[1]?.x).toBe(20);
    expect(timeline[0]?.zoom).toBe(timeline[1]?.zoom);
  });

  it("returns a breathe timeline with zoom pulse", () => {
    const breatheLayer = { ...layer, animationPreset: "breathe" as const };
    const timeline = buildVideoTimeline(breatheLayer);
    expect(timeline.length).toBe(3);
    expect(timeline[0]?.at).toBe(0);
    expect(timeline[1]?.at).toBe(0.5);
    expect(timeline[2]?.at).toBe(1);
    expect(timeline[0]?.zoom).toBe(1);
    expect(timeline[1]?.zoom).toBe(1.06);
    expect(timeline[2]?.zoom).toBe(1);
    expect(timeline[0]?.x).toBe(0);
    expect(timeline[1]?.x).toBe(0);
  });
});

describe("sampleVideoTransform", () => {
  it("returns the layer zoom for the none preset (drives the static preview)", () => {
    const noneLayer = { ...layer, animationPreset: "none" as const, zoom: 1.2 };
    expect(sampleVideoTransform(noneLayer, 0).zoom).toBe(1.2);
  });

  it("interpolates zoomIn from 1 to 1.12 with easing (midpoint is 0.5 of eased range, not linear)", () => {
    const mid = sampleVideoTransform(layer, 0.5);
    // easeInOutQuad(0.5) = 0.5, so midpoint is still 1.06 in this case
    expect(mid.zoom).toBeCloseTo(1.06, 3);
    expect(sampleVideoTransform(layer, 0).zoom).toBe(1);
    expect(sampleVideoTransform(layer, 1).zoom).toBe(1.12);
  });

  it("applies easeInOutQuad to parallax interpolation", () => {
    // At progress 0.25 (between 0 and 0.5) with easeInOutQuad:
    // rawT = 0.5, easedT = 0.5, same as linear for x but zoom eases
    const quarter = sampleVideoTransform({ ...layer, animationPreset: "parallax" }, 0.25);
    expect(quarter.zoom).toBeCloseTo(1.045, 3);
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

describe("easeInOutQuad", () => {
  it("returns 0 at t=0", () => {
    expect(easeInOutQuad(0)).toBe(0);
  });

  it("returns 1 at t=1", () => {
    expect(easeInOutQuad(1)).toBe(1);
  });

  it("returns 0.5 at t=0.5", () => {
    expect(easeInOutQuad(0.5)).toBe(0.5);
  });

  it("eases in slower than linear below 0.5", () => {
    expect(easeInOutQuad(0.25)).toBeLessThan(0.25);
  });

  it("eases out faster than linear above 0.5", () => {
    expect(easeInOutQuad(0.75)).toBeGreaterThan(0.75);
  });
});
