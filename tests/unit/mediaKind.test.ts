import { describe, expect, it } from "vitest";
import { hasVideoLayer, isVideoLayer, isVideoSource } from "@/lib/render/mediaKind";
import type { MediaLayer } from "@/lib/types/editor";

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return {
    id: "l1",
    mediaUrl: null,
    mediaType: "image",
    mediaName: null,
    hidden: false,
    animationPreset: "none",
    zoom: 1,
    mediaOffsetX: 0,
    mediaOffsetY: 0,
    videoMuted: true,
    videoLoop: true,
    videoAutoplay: true,
    videoPosterTime: 0,
    videoDuration: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    videoQuality: "medium",
    ...overrides
  };
}

describe("mediaKind", () => {
  it("flags video by mediaType", () => {
    expect(isVideoSource("video", "clip.png")).toBe(true);
  });

  it("flags video by extension in name", () => {
    expect(isVideoSource("image", "demo.mp4")).toBe(true);
    expect(isVideoSource("none", "demo.mov")).toBe(true);
  });

  it("does not flag images or unknown names", () => {
    expect(isVideoSource("image", "shot.png")).toBe(false);
    expect(isVideoSource("none", null)).toBe(false);
    expect(isVideoSource("image", "notes.txt")).toBe(false);
  });

  it("derives layer kind from type and name", () => {
    const videoLayer = layer({ mediaType: "video", mediaName: "x.mp4" });
    const imageLayer = layer({ mediaType: "image", mediaName: "x.png" });
    expect(isVideoLayer(videoLayer)).toBe(true);
    expect(isVideoLayer(imageLayer)).toBe(false);
  });

  it("aggregates video presence across layers", () => {
    expect(hasVideoLayer([layer(), layer({ mediaType: "video", mediaName: "x.mp4" })])).toBe(true);
    expect(hasVideoLayer([layer(), layer({ mediaType: "image", mediaName: "x.png" })])).toBe(false);
  });
});
