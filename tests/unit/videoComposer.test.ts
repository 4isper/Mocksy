import { describe, expect, it } from "vitest";
import { buildVideoTimeline } from "@/lib/render/videoComposer";
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
  videoCurrentTime: 0,
  videoTrimStart: 0,
  videoTrimEnd: 0
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
