import { describe, expect, it } from "vitest";
import { useEditorStore, orphanedBlobUrls } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
import { DEMO_MEDIA_URL } from "@/lib/media/demoMedia";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import type { EditorStoreState } from "@/lib/state/editorStore";

const store = () => useEditorStore.getState();

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return { ...initialScene.layers[0]!, id: overrides.id ?? "layer-test", ...overrides };
}

function sceneWithLayer(overrides: Partial<MediaLayer> = {}): EditorScene {
  const l = layer(overrides);
  return { ...initialScene, layers: [l], activeLayerId: l.id };
}

function fullState(scene: EditorScene, past: EditorScene[] = [], future: EditorScene[] = []): EditorStoreState {
  return { ...store(), scene, past, future } as EditorStoreState;
}

describe("editorStore", () => {
  it("starts from the documented initial scene", () => {
    expect(store().scene).toEqual(initialScene);
  });

  describe("blob: media URL lifecycle", () => {
    it("revokes a replaced blob URL once it falls out of history", () => {
      const prev = fullState(sceneWithLayer({ mediaUrl: "blob:old" }), [sceneWithLayer({ mediaUrl: "blob:old" })]);
      const state = fullState(sceneWithLayer({ mediaUrl: "blob:new" }), [sceneWithLayer({ mediaUrl: "blob:new" })] );
      // blob:old is gone from every collection -> should be revoked
      expect(orphanedBlobUrls(state, prev)).toEqual(["blob:old"]);
    });

    it("keeps a blob URL alive while reachable via undo history", () => {
      const prev = fullState(sceneWithLayer({ mediaUrl: "blob:new" }), [sceneWithLayer({ mediaUrl: "blob:old" })]);
      const state = fullState(sceneWithLayer({ mediaUrl: "blob:old" }), [sceneWithLayer({ mediaUrl: "blob:new" })]);
      // undo swapped current/past; blob:old still reachable -> keep alive
      expect(orphanedBlobUrls(state, prev)).toEqual([]);
    });

    it("does not report demo (data:) media URLs", () => {
      const prev = fullState(sceneWithLayer({ mediaUrl: DEMO_MEDIA_URL }));
      const state = fullState(sceneWithLayer({ mediaUrl: "blob:new" }));
      expect(orphanedBlobUrls(state, prev)).toEqual([]);
    });
  });

  it("setMedia resets video timing fields", () => {
    store().setVideoDuration(12);
    store().setVideoCurrentTime(4);
    store().setVideoTrimEnd(10);
    store().setMedia("blob:abc", "image", "shot.png");
    const scene = store().scene;
    expect(scene.layers[0]!.mediaUrl).toBe("blob:abc");
    expect(scene.layers[0]!.mediaName).toBe("shot.png");
    expect(scene.layers[0]!.videoDuration).toBe(0);
    expect(scene.layers[0]!.videoTrimStart).toBe(0);
    expect(scene.layers[0]!.videoTrimEnd).toBe(0);
    expect(store().videoCurrentTime).toBe(0);
  });

  it("setVideoDuration clamps existing trim end to duration", () => {
    store().setVideoTrimEnd(10);
    store().setVideoDuration(6);
    expect(store().scene.layers[0]!.videoTrimEnd).toBe(6);
  });

  it("setVideoTrimEnd(0) clamps to the full duration instead of a 0 sentinel", () => {
    store().setVideoDuration(8);
    store().setVideoTrimEnd(0);
    expect(store().scene.layers[0]!.videoTrimEnd).toBe(8);
  });

  it("setVideoDuration keeps an explicit trim end", () => {
    store().setVideoDuration(8);
    store().setVideoTrimEnd(5);
    store().setVideoDuration(10);
    // explicit end is preserved (clamped to new duration)
    expect(store().scene.layers[0]!.videoTrimEnd).toBe(5);
  });

  it("setVideoTrimStart never exceeds trim end", () => {
    store().setVideoTrimEnd(5);
    store().setVideoTrimStart(9);
    expect(store().scene.layers[0]!.videoTrimStart).toBe(5);
  });

  it("setVideoTrimEnd never drops below trim start", () => {
    store().setVideoTrimStart(4);
    store().setVideoTrimEnd(1);
    expect(store().scene.layers[0]!.videoTrimEnd).toBe(4);
  });

  it("setVideoQuality updates the export quality", () => {
    store().setVideoQuality("low");
    expect(store().scene.layers[0]!.videoQuality).toBe("low");
  });

  it("setWatermarkPosition and setWatermarkSize update the watermark", () => {
    store().setWatermarkPosition("top-left");
    expect(store().scene.watermarkPosition).toBe("top-left");
    store().setWatermarkSize(40);
    expect(store().scene.watermarkSize).toBe(40);
    // size is clamped to the 8..64 range
    store().setWatermarkSize(999);
    expect(store().scene.watermarkSize).toBe(64);
    store().setWatermarkSize(0);
    expect(store().scene.watermarkSize).toBe(8);
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
    store().setScene({ frame: "desktop" });
    store().setZoom(1.2);
    expect(store().scene.frame).toBe("desktop");
    expect(store().scene.layers[0]!.zoom).toBe(1.2);
    // untouched fields fall back to initial values
    expect(store().scene.stylePreset).toBe(initialScene.stylePreset);
  });

  it("resetScene restores defaults with demo media", () => {
    store().setScene({ frame: "desktop" });
    store().setZoom(1.2);
    store().resetScene();
    expect(store().scene.frame).toBe(initialScene.frame);
    expect(store().scene.layers[0]!.zoom).toBe(initialScene.layers[0]!.zoom);
    expect(store().scene.layers[0]!.mediaUrl).toContain("data:image/svg");
    expect(store().scene.layers[0]!.mediaType).toBe("image");
  });

  it("records history on a mutation and supports undo/redo", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene } });
    store().setFrame("desktop");
    expect(store().scene.frame).toBe("desktop");
    expect(store().past.length).toBe(1);

    store().undo();
    expect(store().scene.frame).toBe(initialScene.frame);
    expect(store().future.length).toBe(1);

    store().redo();
    expect(store().scene.frame).toBe("desktop");
    expect(store().future.length).toBe(0);
  });

  it("undo is a no-op with empty history", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene } });
    store().undo();
    expect(store().scene).toEqual(initialScene);
  });

  it("a new mutation clears the redo stack", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene } });
    store().setFrame("desktop");
    store().undo();
    store().setZoom(1.5);
    expect(store().future.length).toBe(0);
    expect(store().scene.layers[0]!.zoom).toBe(1.5);
  });

  it("setBackgroundTransparent switches mode without color", () => {
    store().setBackgroundTransparent();
    expect(store().scene.backgroundMode).toBe("transparent");
  });

  it("setVideoCurrentTime is kept out of scene/history (driven by playback)", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene }, videoCurrentTime: 0 });
    store().setVideoCurrentTime(3);
    expect(store().past.length).toBe(0);
    expect(store().videoCurrentTime).toBe(3);
  });

  it("coalesces rapid slider drags of the same field into one undo step", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene }, lastHistoryKey: null, lastHistoryAt: 0 });
    store().setZoom(1.1);
    store().setZoom(1.2);
    store().setZoom(1.3);
    // one baseline entry for the whole drag, not one per call
    expect(store().past.length).toBe(1);
    expect(store().scene.layers[0]!.zoom).toBe(1.3);

    store().undo();
    expect(store().scene.layers[0]!.zoom).toBe(initialScene.layers[0]!.zoom);
  });

  it("does not coalesce across different fields", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene }, lastHistoryKey: null, lastHistoryAt: 0 });
    store().setZoom(1.2);
    store().setShadowOpacity(0.6);
    expect(store().past.length).toBe(2);
  });

  it("setMedia marks media as loading and clears it on removal", () => {
    store().setMedia("blob:abc", "image", "shot.png");
    expect(store().isMediaLoading).toBe(true);
    store().setMedia(null, "none", null);
    expect(store().isMediaLoading).toBe(false);
  });

  it("undo/redo re-sync the playback position to the restored poster time", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene }, videoCurrentTime: 0 });
    store().setVideoPosterTime(3);
    store().setFrame("desktop");
    // simulate playback scrubbing ahead of the poster
    useEditorStore.setState({ videoCurrentTime: 7 });
    store().undo();
    // playback returns to the restored scene's poster time (3), not the
    // scrubbed position (7)
    expect(store().scene.frame).toBe(initialScene.frame);
    expect(store().videoCurrentTime).toBe(3);
    store().redo();
    expect(store().scene.frame).toBe("desktop");
    expect(store().videoCurrentTime).toBe(3);
  });
});
