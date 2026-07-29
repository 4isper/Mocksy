import { describe, expect, it } from "vitest";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
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
    // angle defaults to the existing scene angle when not passed
    expect(store().scene.gradientAngle).toBe(120);
  });

  it("setBackgroundGradient stores angle when provided", () => {
    store().setBackgroundGradient("#1d4ed8", "#7c3aed", 45);
    expect(store().scene.gradientAngle).toBe(45);
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

describe("background image + blur", () => {
  function reset() {
    useEditorStore.setState({
      past: [],
      future: [],
      scene: { ...initialScene },
      selectedAnnotationId: null,
      lastHistoryKey: null,
      lastHistoryAt: 0
    });
  }

  it("setBackgroundImage switches to image mode and stores the url", () => {
    reset();
    store().setBackgroundImage("data:image/png;base64,AAA");
    expect(store().scene.backgroundMode).toBe("image");
    expect(store().scene.backgroundImageUrl).toBe("data:image/png;base64,AAA");
  });

  it("setBackgroundBlur clamps to [0, 40]", () => {
    reset();
    store().setBackgroundBlur(99);
    expect(store().scene.backgroundBlur).toBe(40);
    store().setBackgroundBlur(-5);
    expect(store().scene.backgroundBlur).toBe(0);
    store().setBackgroundBlur(12);
    expect(store().scene.backgroundBlur).toBe(12);
  });
});

describe("annotations", () => {
  function reset() {
    useEditorStore.setState({
      past: [],
      future: [],
      scene: { ...initialScene },
      selectedAnnotationId: null,
      lastHistoryKey: null,
      lastHistoryAt: 0
    });
  }

  it("addAnnotation appends and auto-selects the new annotation", () => {
    reset();
    store().addAnnotation("text");
    const scene = store().scene;
    expect(scene.annotations.length).toBe(1);
    expect(scene.annotations[0]!.type).toBe("text");
    expect(store().selectedAnnotationId).toBe(scene.annotations[0]!.id);
  });

  it("updateAnnotation patches only the targeted annotation", () => {
    reset();
    store().addAnnotation("arrow");
    const id = store().selectedAnnotationId!;
    store().updateAnnotation(id, { color: "#ff0000", strokeWidth: 8 });
    const a = store().scene.annotations[0]!;
    expect(a.color).toBe("#ff0000");
    expect(a.strokeWidth).toBe(8);
    expect(a.type).toBe("arrow");
  });

  it("removeAnnotation drops the annotation and clears selection", () => {
    reset();
    store().addAnnotation("rect");
    const id = store().selectedAnnotationId!;
    store().selectAnnotation(id);
    store().removeAnnotation(id);
    expect(store().scene.annotations.length).toBe(0);
    expect(store().selectedAnnotationId).toBeNull();
  });

  it("selectAnnotation only changes selection, not history", () => {
    reset();
    store().addAnnotation("text");
    const id = store().selectedAnnotationId!;
    const pastBefore = store().past.length;
    store().selectAnnotation(null);
    store().selectAnnotation(id);
    expect(store().past.length).toBe(pastBefore);
  });

  it("clearAnnotations empties the list and selection", () => {
    reset();
    store().addAnnotation("text");
    store().addAnnotation("arrow");
    store().clearAnnotations();
    expect(store().scene.annotations.length).toBe(0);
    expect(store().selectedAnnotationId).toBeNull();
  });
});

describe("media fit + PNG export scale", () => {
  function reset() {
    useEditorStore.setState({
      past: [],
      future: [],
      scene: { ...initialScene },
      selectedAnnotationId: null,
      lastHistoryKey: null,
      lastHistoryAt: 0
    });
  }

  it("defaults the active layer to cover (fill/crop)", () => {
    expect(store().scene.layers[0]!.mediaFit).toBe("cover");
  });

  it("setMediaFit switches the active layer between cover and contain", () => {
    reset();
    store().setMediaFit("contain");
    expect(store().scene.layers[0]!.mediaFit).toBe("contain");
    store().setMediaFit("cover");
    expect(store().scene.layers[0]!.mediaFit).toBe("cover");
    // the change is recorded so it can be undone
    expect(store().past.length).toBe(1);
  });

  it("defaults export scale to 2× and updates via setter", () => {
    expect(store().exportScale).toBe(2);
    store().setExportScale(4);
    expect(store().exportScale).toBe(4);
    store().setExportScale(1);
    expect(store().exportScale).toBe(1);
  });
});
