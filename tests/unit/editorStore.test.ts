import { describe, expect, it } from "vitest";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";

const store = () => useEditorStore.getState();

describe("editorStore", () => {
  it("starts from the documented initial scene", () => {
    expect(store().scene).toEqual(initialScene);
  });

  it("setMedia resets video timing fields", () => {
    store().setVideoDuration(12);
    store().setVideoCurrentTime(4);
    store().setVideoTrimEnd(10);
    store().setMedia("blob:abc", "image", "shot.png");
    const scene = store().scene;
    expect(scene.mediaUrl).toBe("blob:abc");
    expect(scene.mediaName).toBe("shot.png");
    expect(scene.videoDuration).toBe(0);
    expect(scene.videoCurrentTime).toBe(0);
    expect(scene.videoTrimStart).toBe(0);
    expect(scene.videoTrimEnd).toBe(0);
  });

  it("setVideoDuration clamps existing trim end to duration", () => {
    store().setVideoTrimEnd(10);
    store().setVideoDuration(6);
    expect(store().scene.videoTrimEnd).toBe(6);
  });

  it("setVideoDuration keeps trim end when none set", () => {
    store().setVideoTrimEnd(0);
    store().setVideoDuration(8);
    expect(store().scene.videoTrimEnd).toBe(8);
  });

  it("setVideoTrimStart never exceeds trim end", () => {
    store().setVideoTrimEnd(5);
    store().setVideoTrimStart(9);
    expect(store().scene.videoTrimStart).toBe(5);
  });

  it("setVideoTrimEnd never drops below trim start", () => {
    store().setVideoTrimStart(4);
    store().setVideoTrimEnd(1);
    expect(store().scene.videoTrimEnd).toBe(4);
  });

  it("setBackgroundSolid switches mode and color", () => {
    store().setBackgroundSolid("#09090b");
    expect(store().scene.backgroundMode).toBe("solid");
    expect(store().scene.backgroundColor).toBe("#09090b");
  });

  it("setBackgroundGradient switches mode and both stops", () => {
    store().setBackgroundGradient("#1d4ed8", "#7c3aed");
    expect(store().scene.backgroundMode).toBe("gradient");
    expect(store().scene.gradientFrom).toBe("#1d4ed8");
    expect(store().scene.gradientTo).toBe("#7c3aed");
  });

  it("setScene merges onto the initial scene", () => {
    store().setScene({ frame: "desktop", zoom: 1.2 } as never);
    expect(store().scene.frame).toBe("desktop");
    expect(store().scene.zoom).toBe(1.2);
    // untouched fields fall back to initial values
    expect(store().scene.stylePreset).toBe(initialScene.stylePreset);
  });

  it("resetScene restores defaults with demo media", () => {
    store().setScene({ frame: "desktop", zoom: 1.2 });
    store().resetScene();
    expect(store().scene.frame).toBe(initialScene.frame);
    expect(store().scene.zoom).toBe(initialScene.zoom);
    expect(store().scene.mediaUrl).toContain("data:image/svg");
    expect(store().scene.mediaType).toBe("image");
  });
});
