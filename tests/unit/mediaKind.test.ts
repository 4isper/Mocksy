import { describe, expect, it } from "vitest";
import { isVideoScene, isVideoSource } from "@/lib/render/mediaKind";
import { initialScene } from "@/lib/state/editorStore";
import type { EditorScene } from "@/lib/types/editor";

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

  it("derives scene kind from type and name", () => {
    const videoScene: EditorScene = { ...initialScene, mediaType: "video", mediaName: "x.mp4" };
    const imageScene: EditorScene = { ...initialScene, mediaType: "image", mediaName: "x.png" };
    expect(isVideoScene(videoScene)).toBe(true);
    expect(isVideoScene(imageScene)).toBe(false);
  });
});
