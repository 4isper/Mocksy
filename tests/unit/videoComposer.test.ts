import { describe, expect, it } from "vitest";
import { buildVideoTimeline, sampleVideoTransform } from "@/lib/render/videoComposer";
import type { EditorScene } from "@/lib/types/editor";

const scene: EditorScene = {
  mediaUrl: null,
  mediaType: "none",
  mediaName: null,
  frame: "iphone",
  stylePreset: "default",
  animationPreset: "zoomIn",
  zoom: 1,
  shadowOpacity: 0.4,
  borderRadius: 20,
  backgroundMode: "solid",
  backgroundColor: "#000000",
  gradientFrom: "#000000",
  gradientTo: "#ffffff",
  watermarkText: "Mocksy",
  watermarkEnabled: false,
  aspectRatio: "16 / 9",
  videoMuted: true,
  videoLoop: true,
  videoAutoplay: true,
  videoPosterTime: 0,
  videoDuration: 0,
  videoTrimStart: 0,
  videoTrimEnd: 0,
  videoQuality: "medium",
  watermarkPosition: "bottom-right",
  watermarkSize: 13
};

describe("buildVideoTimeline", () => {
  it("returns zoom keyframes for zoomIn preset", () => {
    const timeline = buildVideoTimeline(scene);
    expect(timeline.length).toBe(2);
    expect(timeline[1]?.zoom).toBeGreaterThan(timeline[0]?.zoom ?? 0);
  });

  it("returns a three-point parallax timeline", () => {
    const parallaxScene = { ...scene, animationPreset: "parallax" as const };
    const timeline = buildVideoTimeline(parallaxScene);
    expect(timeline.length).toBe(3);
    expect(timeline[0]?.at).toBe(0);
    expect(timeline[2]?.at).toBe(1);
    expect(timeline[1]?.x).not.toBe(0);
  });

  it("returns a single static keyframe for none", () => {
    const noneScene = { ...scene, animationPreset: "none" as const };
    const timeline = buildVideoTimeline(noneScene);
    expect(timeline.length).toBe(1);
    expect(timeline[0]?.zoom).toBe(noneScene.zoom);
  });
});

describe("sampleVideoTransform", () => {
  it("returns the scene zoom for the none preset (drives the static preview)", () => {
    const noneScene = { ...scene, animationPreset: "none" as const, zoom: 1.2 };
    expect(sampleVideoTransform(noneScene, 0).zoom).toBe(1.2);
  });

  it("interpolates zoomIn from 1 to 1.12 across the progress", () => {
    const mid = sampleVideoTransform(scene, 0.5);
    expect(mid.zoom).toBeCloseTo(1.06, 5);
    expect(sampleVideoTransform(scene, 0).zoom).toBe(1);
    expect(sampleVideoTransform(scene, 1).zoom).toBe(1.12);
  });

  it("sweeps parallax offsets from negative to positive and back", () => {
    const start = sampleVideoTransform({ ...scene, animationPreset: "parallax" }, 0);
    const mid = sampleVideoTransform({ ...scene, animationPreset: "parallax" }, 0.5);
    const end = sampleVideoTransform({ ...scene, animationPreset: "parallax" }, 1);
    expect(start.x).toBeLessThan(0);
    expect(mid.x).toBeGreaterThan(0);
    expect(end.x).toBe(start.x);
  });

  it("clamps progress to the 0..1 range", () => {
    const under = sampleVideoTransform(scene, -1);
    const over = sampleVideoTransform(scene, 2);
    expect(under.zoom).toBe(sampleVideoTransform(scene, 0).zoom);
    expect(over.zoom).toBe(sampleVideoTransform(scene, 1).zoom);
  });
});
