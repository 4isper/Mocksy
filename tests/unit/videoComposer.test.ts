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
});
