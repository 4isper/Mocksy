import { describe, expect, it } from "vitest";
import type { MediaLayer } from "@/lib/types/editor";
import { canRemoveBackground, cutoutMediaName } from "@/lib/media/backgroundRemoval";

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return {
    id: "l1",
    mediaUrl: "data:image/png;base64,AAA",
    mediaType: "image",
    mediaName: "photo.png",
    hidden: false,
    zoom: 1,
    mediaOffsetX: 0,
    mediaOffsetY: 0,
    mediaFit: "cover",
    animationPreset: "none",
    videoMuted: false,
    videoLoop: false,
    videoAutoplay: false,
    videoPosterTime: 0,
    videoDuration: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    videoQuality: "high",
    ...overrides
  };
}

describe("canRemoveBackground", () => {
  it("is true for image layers with media", () => {
    expect(canRemoveBackground(layer())).toBe(true);
  });

  it("is false for videos and empty layers", () => {
    expect(canRemoveBackground(layer({ mediaType: "video" }))).toBe(false);
    expect(canRemoveBackground(layer({ mediaUrl: null }))).toBe(false);
    expect(canRemoveBackground(layer({ mediaUrl: "" }))).toBe(false);
    expect(canRemoveBackground(undefined)).toBe(false);
  });
});

describe("cutoutMediaName", () => {
  it("inserts the cutout suffix before the extension", () => {
    expect(cutoutMediaName("photo.png")).toBe("photo (cutout).png");
    expect(cutoutMediaName("shot.final.jpeg")).toBe("shot.final (cutout).jpeg");
  });

  it("appends the suffix when there is no extension", () => {
    expect(cutoutMediaName("photo")).toBe("photo (cutout)");
    expect(cutoutMediaName(".hidden")).toBe(".hidden (cutout)");
  });

  it("passes null through", () => {
    expect(cutoutMediaName(null)).toBeNull();
  });
});
