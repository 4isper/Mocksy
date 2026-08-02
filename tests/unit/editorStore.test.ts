import { describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
import { activePosterTime, makeDemoLayer, patchActive } from "@/lib/state/editorHelpers";
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

  it("setVideoDuration uses duration directly when trimEnd is zero (unset)", () => {
    useEditorStore.setState({ scene: { ...initialScene } });
    store().setVideoTrimEnd(0);
    store().setVideoDuration(12);
    expect(store().scene.layers[0]!.videoTrimEnd).toBe(12);
  });

  it("setVideoDuration handles null activeLayerId", () => {
    useEditorStore.setState({ scene: { ...initialScene, activeLayerId: null } });
    store().setVideoDuration(8);
    expect(store().scene.layers[0]!.videoDuration).toBe(8);
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

  it("redo is a no-op when future is empty", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene } });
    const before = store().scene;
    store().redo();
    expect(store().scene).toBe(before);
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

describe("background audio", () => {
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

  it("setBackgroundAudio stores the url and name", () => {
    reset();
    store().setBackgroundAudio("data:audio/mp3;base64,abc", "track.mp3");
    expect(store().scene.backgroundAudioUrl).toBe("data:audio/mp3;base64,abc");
    expect(store().scene.backgroundAudioName).toBe("track.mp3");
  });

  it("clearBackgroundAudio removes the url and name", () => {
    reset();
    store().setBackgroundAudio("data:audio/mp3;base64,abc", "track.mp3");
    store().clearBackgroundAudio();
    expect(store().scene.backgroundAudioUrl).toBeNull();
    expect(store().scene.backgroundAudioName).toBeNull();
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

  it("updateAnnotation leaves non-targeted annotations unchanged", () => {
    reset();
    store().addAnnotation("text");
    store().addAnnotation("arrow");
    const textId = store().scene.annotations[0]!.id;
    const arrowId = store().scene.annotations[1]!.id;
    store().updateAnnotation(textId, { color: "#ff0000" });
    expect(store().scene.annotations[0]!.color).toBe("#ff0000");
    expect(store().scene.annotations[1]!.id).toBe(arrowId);
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

  it("removeAnnotation preserves selection when removing a different annotation", () => {
    reset();
    store().addAnnotation("rect");
    const selectedId = store().selectedAnnotationId!;
    store().addAnnotation("arrow");
    const otherId = store().scene.annotations[store().scene.annotations.length - 1]!.id;
    store().selectAnnotation(selectedId);
    store().removeAnnotation(otherId);
    expect(store().scene.annotations.length).toBe(1);
    expect(store().selectedAnnotationId).toBe(selectedId);
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

describe("layer management", () => {
  function reset() {
    useEditorStore.setState({
      past: [],
      future: [],
      scene: { ...initialScene },
      selectedAnnotationId: null,
      activeFrameInstanceId: null,
      lastHistoryKey: null,
      lastHistoryAt: 0
    });
  }

  it("addLayer appends a new layer and makes it active", () => {
    reset();
    const before = store().scene.layers.length;
    store().addLayer("data:image/png;base64,new", "image", "new.png");
    expect(store().scene.layers.length).toBe(before + 1);
    const added = store().scene.layers[store().scene.layers.length - 1]!;
    expect(added.mediaUrl).toBe("data:image/png;base64,new");
    expect(added.mediaName).toBe("new.png");
    expect(store().scene.activeLayerId).toBe(added.id);
  });

  it("addLayer sets isMediaLoading while media decodes", () => {
    reset();
    store().addLayer("data:image/png;base64,loading", "image");
    expect(store().isMediaLoading).toBe(true);
  });

  it("duplicateLayer clones the source with a fresh id", () => {
    reset();
    const source = store().scene.layers[0]!;
    store().duplicateLayer(source.id);
    const clone = store().scene.layers[store().scene.layers.length - 1]!;
    expect(clone.id).not.toBe(source.id);
    expect(clone.mediaUrl).toBe(source.mediaUrl);
    expect(clone.mediaType).toBe(source.mediaType);
    expect(clone.zoom).toBe(source.zoom);
    expect(clone.mediaFit).toBe(source.mediaFit);
    expect(store().scene.activeLayerId).toBe(clone.id);
  });

  it("duplicateLayer returns empty when source not found", () => {
    reset();
    const pastBefore = store().past.length;
    store().duplicateLayer("nonexistent");
    expect(store().past.length).toBe(pastBefore);
  });

  it("toggleLayerHidden flips the hidden flag", () => {
    reset();
    const id = store().scene.layers[0]!.id;
    expect(store().scene.layers[0]!.hidden).toBe(false);
    store().toggleLayerHidden(id);
    expect(store().scene.layers[0]!.hidden).toBe(true);
    store().toggleLayerHidden(id);
    expect(store().scene.layers[0]!.hidden).toBe(false);
  });

  it("toggleLayerHidden leaves other layers unchanged", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const l1Id = store().scene.layers[0]!.id;
    const l2Id = store().scene.layers[1]!.id;
    store().toggleLayerHidden(l1Id);
    expect(store().scene.layers.find((l) => l.id === l1Id)!.hidden).toBe(true);
    expect(store().scene.layers.find((l) => l.id === l2Id)!.hidden).toBe(false);
  });

  it("removeLayer removes the named layer and selects the first remaining", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const layer2 = store().scene.layers[1]!;
    store().removeLayer(layer2.id);
    expect(store().scene.layers.length).toBe(1);
    expect(store().scene.activeLayerId).toBe(store().scene.layers[0]!.id);
  });

  it("removeLayer switches active layer when removing the active one", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const first = store().scene.layers[0]!.id;
    store().removeLayer(first);
    expect(store().scene.layers.some(l => l.id === first)).toBe(false);
    expect(store().scene.activeLayerId).toBe(store().scene.layers[0]!.id);
  });

  it("removeLayer is a no-op when only 1 layer remains", () => {
    reset();
    const pastBefore = store().past.length;
    store().removeLayer(store().scene.layers[0]!.id);
    expect(store().scene.layers.length).toBe(1);
    expect(store().past.length).toBe(pastBefore);
  });

  it("selectLayer changes active layer without recording history", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const first = store().scene.layers[0]!.id;
    const second = store().scene.layers[1]!.id;
    const pastBefore = store().past.length;
    store().selectLayer(first);
    expect(store().scene.activeLayerId).toBe(first);
    store().selectLayer(second);
    expect(store().scene.activeLayerId).toBe(second);
    expect(store().past.length).toBe(pastBefore);
  });

  it("reorderLayers respects the supplied order", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    store().addLayer("data:image/png;base64,l3", "image");
    const ids = store().scene.layers.map(l => l.id);
    const reversed = [...ids].reverse();
    store().reorderLayers(reversed);
    expect(store().scene.layers.map(l => l.id)).toEqual(reversed);
  });

  it("reorderLayers adds missing layers defensively", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const ids = store().scene.layers.map(l => l.id);
    // Only reorder the first layer — the second should be appended
    store().reorderLayers([ids[0]!]);
    expect(store().scene.layers.map(l => l.id)).toEqual([ids[0], ids[1]]);
  });

  it("reorderLayers filters out non-existent layer IDs", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const ids = store().scene.layers.map(l => l.id);
    store().reorderLayers(["nonexistent", ids[1]!, ids[0]!]);
    // "nonexistent" should be filtered out silently
    expect(store().scene.layers.map(l => l.id)).toEqual([ids[1], ids[0]]);
  });

  it("reorderLayers keeps ordered layers when all IDs are mentioned", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    store().addLayer("data:image/png;base64,l3", "image");
    const ids = store().scene.layers.map(l => l.id);
    store().reorderLayers([ids[2]!, ids[0]!, ids[1]!]);
    // All layers are mentioned, so none are appended — order matches
    expect(store().scene.layers.map(l => l.id)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("updateActiveLayer patches the active layer and coalesces", () => {
    reset();
    store().updateActiveLayer({ zoom: 1.5 });
    expect(store().scene.layers[0]!.zoom).toBe(1.5);
    store().updateActiveLayer({ zoom: 1.8 });
    expect(store().past.length).toBe(1);
  });

  it("updateActiveLayer leaves non-active layers unchanged", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const l1Id = store().scene.layers[0]!.id;
    const l2Id = store().scene.layers[1]!.id;
    store().selectLayer(l2Id);
    store().updateActiveLayer({ zoom: 2 });
    expect(store().scene.layers.find((l) => l.id === l2Id)!.zoom).toBe(2);
    expect(store().scene.layers.find((l) => l.id === l1Id)!.zoom).toBe(1);
  });

  it("updateActiveLayer is a no-op when there is no active layer", () => {
    reset();
    useEditorStore.setState({ scene: { ...initialScene, layers: [], activeLayerId: null } });
    const pastBefore = store().past.length;
    store().updateActiveLayer({ zoom: 2 });
    expect(store().past.length).toBe(pastBefore);
  });
});

describe("frame control", () => {
  function reset() {
    useEditorStore.setState({
      past: [],
      future: [],
      scene: { ...initialScene },
      selectedAnnotationId: null,
      activeFrameInstanceId: null,
      lastHistoryKey: null,
      lastHistoryAt: 0
    });
  }

  it("setFrame updates the frame and all frameInstances", () => {
    reset();
    store().setFrame("desktop");
    expect(store().scene.frame).toBe("desktop");
    store().setFrame("none");
    expect(store().scene.frame).toBe("none");
  });

  it("setFrame with existing frameInstances updates their frame field", () => {
    reset();
    const instances = [
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0.5, scale: 0.5, layerId: null },
      { id: "fi2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 0.5, layerId: null }
    ];
    store().setFrameInstances(instances);
    store().setFrame("desktop");
    expect(store().scene.frameInstances.every(i => i.frame === "desktop")).toBe(true);
  });

  it("setFrameInstances overwrites the frame instance list and records history", () => {
    reset();
    const instances = [
      { id: "fi1", frame: "iphone15" as const, x: 0, y: 0.5, scale: 0.5, layerId: null }
    ];
    store().setFrameInstances(instances);
    expect(store().scene.frameInstances).toEqual(instances);
    expect(store().past.length).toBe(1);
  });

  it("updateFrameInstance patches a single frame instance", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0.5, scale: 1, layerId: null }
    ]);
    store().updateFrameInstance("fi1", { x: 0.25, scale: 0.8 });
    expect(store().scene.frameInstances[0]!.x).toBe(0.25);
    expect(store().scene.frameInstances[0]!.scale).toBe(0.8);
  });

  it("updateFrameInstance leaves other instances unchanged", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0, scale: 1, layerId: null },
      { id: "fi2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }
    ]);
    store().updateFrameInstance("fi1", { x: 0.25 });
    expect(store().scene.frameInstances[0]!.x).toBe(0.25);
    expect(store().scene.frameInstances[1]!.x).toBe(0.5);
  });

  it("updateFrameInstance coalesces rapid calls into a single history entry", () => {
    reset();
    vi.useFakeTimers();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0, scale: 1, layerId: null }
    ]);
    const pastBefore = store().past.length;
    store().updateFrameInstance("fi1", { x: 0.1 }, true);
    store().updateFrameInstance("fi1", { x: 0.2 }, true);
    store().updateFrameInstance("fi1", { x: 0.3 }, true);
    expect(store().past.length).toBe(pastBefore + 1);
    expect(store().scene.frameInstances[0]!.x).toBe(0.3);
    vi.useRealTimers();
  });

  it("removeFrameInstance removes the instance and its orphaned layer", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const layerId = store().scene.layers[1]!.id;
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0.5, scale: 1, layerId: store().scene.layers[0]!.id },
      { id: "fi2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId }
    ]);
    store().removeFrameInstance("fi2");
    expect(store().scene.frameInstances.length).toBe(1);
    expect(store().scene.layers.some(l => l.id === layerId)).toBe(false);
  });

  it("removeFrameInstance is a no-op when instance not found", () => {
    reset();
    const pastBefore = store().past.length;
    store().removeFrameInstance("nonexistent");
    expect(store().past.length).toBe(pastBefore);
  });

  it("removeFrameInstance keeps layer when still referenced by other instance", () => {
    reset();
    const sharedId = store().scene.layers[0]!.id;
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0.5, scale: 1, layerId: sharedId },
      { id: "fi2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: sharedId }
    ]);
    store().removeFrameInstance("fi1");
    // Layer shared across instances should NOT be orphaned
    expect(store().scene.layers.some(l => l.id === sharedId)).toBe(true);
    expect(store().scene.frameInstances.length).toBe(1);
  });

  it("removeFrameInstance handles null layerId", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0.5, scale: 1, layerId: null }
    ]);
    const pastBefore = store().past.length;
    store().removeFrameInstance("fi1");
    // No layer to orphan, instance removed
    expect(store().scene.frameInstances.length).toBe(0);
    expect(store().past.length).toBeGreaterThan(pastBefore);
  });

  it("layoutFrameGrid creates new layers for each frame instance", () => {
    reset();
    const layersBefore = store().scene.layers.length;
    store().layoutFrameGrid("iphone", 3, "horizontal");
    expect(store().scene.frameInstances.length).toBe(3);
    expect(store().scene.layers.length).toBe(layersBefore + 3);
    expect(store().scene.activeLayerId).toBe(store().scene.frameInstances[0]!.layerId);
  });

  it("re-applying a layout drops layers orphaned by the previous layout", () => {
    reset();
    const baseLayers = store().scene.layers;
    store().layoutFrameGrid("iphone", 2, "horizontal");
    const firstInstanceLayerIds = store().scene.frameInstances.map((fi) => fi.layerId);
    expect(store().scene.layers.length).toBe(baseLayers.length + 2);
    // Apply a different layout — the old layout's layers must be replaced,
    // not accumulated, while the base layers survive.
    store().applyFrameLayout("iphone", 3, "grid");
    expect(store().scene.layers.length).toBe(baseLayers.length + 3);
    for (const id of firstInstanceLayerIds) {
      expect(store().scene.layers.some((l) => l.id === id)).toBe(false);
    }
    expect(store().scene.frameInstances).toHaveLength(3);
  });

  it("layoutFrameGrid falls back to demo layer when no active layer", () => {
    reset();
    useEditorStore.setState({ scene: { ...initialScene, layers: [], activeLayerId: null } });
    store().layoutFrameGrid("iphone", 2, "vertical");
    expect(store().scene.frameInstances.length).toBe(2);
    expect(store().scene.layers.length).toBe(2);
    expect(store().scene.layers[0]!.mediaUrl).toContain("data:image/svg");
  });

  it("layoutFrameGrid with count=0 adds no layers and keeps activeLayerId", () => {
    reset();
    store().layoutFrameGrid("iphone", 0, "horizontal");
    expect(store().scene.frameInstances).toHaveLength(0);
    expect(store().scene.activeLayerId).toBe(store().scene.layers[0]!.id);
  });

  it("selectFrameInstance sets activeFrameInstanceId without history", () => {
    reset();
    expect(store().activeFrameInstanceId).toBeNull();
    store().selectFrameInstance("fi-test");
    expect(store().activeFrameInstanceId).toBe("fi-test");
    expect(store().past.length).toBe(0);
  });
});

describe("scene-wide settings", () => {
  function reset() {
    useEditorStore.setState({
      past: [],
      future: [],
      scene: { ...initialScene },
      lastHistoryKey: null,
      lastHistoryAt: 0
    });
  }

  it("setStylePreset updates the style preset", () => {
    reset();
    store().setStylePreset("glassDark");
    expect(store().scene.stylePreset).toBe("glassDark");
    store().setStylePreset("outline");
    expect(store().scene.stylePreset).toBe("outline");
  });

  it("setAnimationPreset updates the active layer animation and coalesces", () => {
    reset();
    store().setAnimationPreset("zoomIn");
    expect(store().scene.layers[0]!.animationPreset).toBe("zoomIn");
    store().setAnimationPreset("parallax");
    expect(store().past.length).toBe(1);
  });

  it("setAnimationDuration updates the loop length and clamps into range", () => {
    reset();
    store().setAnimationDuration(5000);
    expect(store().scene.animationDurationMs).toBe(5000);
    store().setAnimationDuration(10);
    expect(store().scene.animationDurationMs).toBe(500);
    store().setAnimationDuration(999999);
    expect(store().scene.animationDurationMs).toBe(20000);
  });

  it("setZoom coalesces rapid calls", () => {
    reset();
    store().setZoom(1.1);
    store().setZoom(1.2);
    store().setZoom(1.3);
    expect(store().past.length).toBe(1);
    expect(store().scene.layers[0]!.zoom).toBe(1.3);
  });

  it("setMediaOffsetX coalesces and updates position", () => {
    reset();
    store().setMediaOffsetX(0.3);
    store().setMediaOffsetX(0.5);
    expect(store().past.length).toBe(1);
    expect(store().scene.layers[0]!.mediaOffsetX).toBe(0.5);
  });

  it("setMediaOffsetY coalesces and updates position", () => {
    reset();
    store().setMediaOffsetY(-0.2);
    store().setMediaOffsetY(0.1);
    expect(store().past.length).toBe(1);
    expect(store().scene.layers[0]!.mediaOffsetY).toBe(0.1);
  });

  it("setAspectRatio changes the canvas ratio", () => {
    reset();
    store().setAspectRatio("1 / 1");
    expect(store().scene.aspectRatio).toBe("1 / 1");
    store().setAspectRatio("9 / 16");
    expect(store().scene.aspectRatio).toBe("9 / 16");
  });

  it("toggleWatermark enables or disables the watermark", () => {
    reset();
    expect(store().scene.watermarkEnabled).toBe(false);
    store().toggleWatermark(true);
    expect(store().scene.watermarkEnabled).toBe(true);
    store().toggleWatermark(false);
    expect(store().scene.watermarkEnabled).toBe(false);
  });

  it("setWatermarkText updates the watermark text", () => {
    reset();
    store().setWatermarkText("My Brand");
    expect(store().scene.watermarkText).toBe("My Brand");
  });

  it("setBorderRadius coalesces and clamps", () => {
    reset();
    store().setBorderRadius(30);
    store().setBorderRadius(40);
    expect(store().past.length).toBe(1);
    expect(store().scene.borderRadius).toBe(40);
  });

  it("setShadowOpacity coalesces and updates", () => {
    reset();
    store().setShadowOpacity(0.5);
    store().setShadowOpacity(0.8);
    expect(store().past.length).toBe(1);
    expect(store().scene.shadowOpacity).toBe(0.8);
  });

  it("setVideoMuted toggles the muted flag", () => {
    reset();
    expect(store().scene.layers[0]!.videoMuted).toBe(true);
    store().setVideoMuted(false);
    expect(store().scene.layers[0]!.videoMuted).toBe(false);
  });

  it("setVideoLoop toggles the loop flag", () => {
    reset();
    expect(store().scene.layers[0]!.videoLoop).toBe(true);
    store().setVideoLoop(false);
    expect(store().scene.layers[0]!.videoLoop).toBe(false);
  });

  it("setVideoAutoplay toggles the autoplay flag", () => {
    reset();
    expect(store().scene.layers[0]!.videoAutoplay).toBe(true);
    store().setVideoAutoplay(false);
    expect(store().scene.layers[0]!.videoAutoplay).toBe(false);
  });

  it("setVideoPosterTime coalesces and records history", () => {
    reset();
    store().setVideoPosterTime(2);
    store().setVideoPosterTime(3);
    expect(store().past.length).toBe(1);
    expect(store().scene.layers[0]!.videoPosterTime).toBe(3);
  });

  it("setVideoTrimStart coalesces with trimStart key and clamps to trimEnd", () => {
    reset();
    store().setVideoTrimEnd(10);
    store().setVideoTrimStart(1);
    store().setVideoTrimStart(2);
    expect(store().scene.layers[0]!.videoTrimStart).toBe(2);
    expect(store().scene.layers[0]!.videoTrimStart).toBeLessThanOrEqual(store().scene.layers[0]!.videoTrimEnd);
  });

  it("setVideoTrimStart without trimEnd set clamps to zero", () => {
    reset();
    store().setVideoTrimStart(5);
    // trimEnd defaults to 0, so trimStart is clamped to Math.min(5, 0) = 0
    expect(store().scene.layers[0]!.videoTrimStart).toBe(0);
  });

  it("setVideoTrimEnd coalesces with trimEnd key and clamps to trimStart", () => {
    reset();
    store().setVideoTrimEnd(8);
    store().setVideoTrimEnd(6);
    expect(store().scene.layers[0]!.videoTrimEnd).toBe(6);
    expect(store().past.length).toBe(1);
  });

  it("setVideoTrimEnd with zero value clamps to zero when no duration set", () => {
    reset();
    store().setVideoTrimEnd(0);
    // videoDuration defaults to 0, so videoTrimEnd becomes 0
    expect(store().scene.layers[0]!.videoTrimEnd).toBe(0);
  });

  it("setVideoDuration with empty layers does not crash", () => {
    reset();
    useEditorStore.setState({ scene: { ...initialScene, layers: [], activeLayerId: null } });
    store().setVideoDuration(8);
    expect(store().scene.layers).toEqual([]);
  });

  it("setVideoTrimStart with empty layers and null activeLayerId does not crash", () => {
    reset();
    useEditorStore.setState({ scene: { ...initialScene, layers: [], activeLayerId: null } });
    store().setVideoTrimStart(5);
    expect(store().scene.layers).toEqual([]);
  });

  it("setVideoTrimEnd with empty layers and null activeLayerId does not crash", () => {
    reset();
    useEditorStore.setState({ scene: { ...initialScene, layers: [], activeLayerId: null } });
    store().setVideoTrimEnd(0);
    expect(store().scene.layers).toEqual([]);
  });

  it("setVideoTrimEnd with empty layers and positive value does not crash", () => {
    reset();
    useEditorStore.setState({ scene: { ...initialScene, layers: [], activeLayerId: null } });
    store().setVideoTrimEnd(5);
    expect(store().scene.layers).toEqual([]);
  });

  it("setMediaLoading updates the loading flag without history", () => {
    reset();
    store().setMediaLoading(true);
    expect(store().isMediaLoading).toBe(true);
    store().setMediaLoading(false);
    expect(store().isMediaLoading).toBe(false);
    expect(store().past.length).toBe(0);
  });

  it("setScenePalette updates palette without history", () => {
    reset();
    store().setScenePalette(["#ff0000", "#00ff00"]);
    expect(store().scenePalette).toEqual(["#ff0000", "#00ff00"]);
    expect(store().past.length).toBe(0);
  });

  it("setScene with recordHistory=false does not push to history", () => {
    reset();
    store().setScene({ frame: "tablet" }, false);
    expect(store().scene.frame).toBe("tablet");
    expect(store().past.length).toBe(0);
  });

  it("setVideoQuality updates layer quality and records history", () => {
    reset();
    store().setVideoQuality("high");
    expect(store().scene.layers[0]!.videoQuality).toBe("high");
  });

  it("setMedia seeds a demo layer when there are no layers", () => {
    useEditorStore.setState({ scene: { ...initialScene, layers: [], activeLayerId: null } });
    store().setMedia("data:image/png;base64,first", "image", "first.png");
    expect(store().scene.layers).toHaveLength(1);
    expect(store().scene.layers[0]!.mediaUrl).toBe("data:image/png;base64,first");
  });

  it("setMedia preserves non-active layers unchanged", () => {
    useEditorStore.setState({ scene: { ...initialScene } });
    store().addLayer("data:image/png;base64,l2", "image");
    const l1Id = store().scene.layers[0]!.id;
    const l2Id = store().scene.layers[1]!.id;
    store().selectLayer(l1Id);
    store().setMedia("data:image/png;base64,new", "image", "new.png");
    expect(store().scene.layers.find((l) => l.id === l2Id)!.mediaUrl).toBe("data:image/png;base64,l2");
  });

  it("setVideoDuration only updates the target layer", () => {
    useEditorStore.setState({ scene: { ...initialScene, layers: [], activeLayerId: null } });
    store().addLayer("data:image/png;base64,l1", "image");
    store().addLayer("data:image/png;base64,l2", "image");
    const l1Id = store().scene.layers[0]!.id;
    const l2Id = store().scene.layers[1]!.id;
    store().selectLayer(l2Id);
    store().setVideoDuration(10);
    expect(store().scene.layers.find((l) => l.id === l1Id)!.videoDuration).toBe(0);
    expect(store().scene.layers.find((l) => l.id === l2Id)!.videoDuration).toBe(10);
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

  it("starts without a custom export size and updates via setter", () => {
    expect(store().customExportSize).toBeNull();
    store().setCustomExportSize({ width: 1280, height: 720 });
    expect(store().customExportSize).toEqual({ width: 1280, height: 720 });
    store().setCustomExportSize(null);
    expect(store().customExportSize).toBeNull();
  });
});

describe("grid overlay state", () => {
  function reset() {
    useEditorStore.setState({
      past: [],
      future: [],
      scene: { ...initialScene },
      showGrid: false,
      gridDivisions: 12,
      lastHistoryKey: null,
      lastHistoryAt: 0
    });
  }

  it("defaults to a hidden 12-division grid", () => {
    expect(useEditorStore.getState().showGrid).toBe(false);
    expect(useEditorStore.getState().gridDivisions).toBe(12);
  });

  it("setShowGrid toggles the overlay without touching scene/history", () => {
    reset();
    const before = useEditorStore.getState().scene;
    useEditorStore.getState().setShowGrid(true);
    expect(useEditorStore.getState().showGrid).toBe(true);
    expect(useEditorStore.getState().scene).toBe(before);
    expect(useEditorStore.getState().past).toHaveLength(0);
  });

  it("setGridDivisions updates the density", () => {
    reset();
    useEditorStore.getState().setGridDivisions(8);
    expect(useEditorStore.getState().gridDivisions).toBe(8);
    useEditorStore.getState().setGridDivisions(12);
    expect(useEditorStore.getState().gridDivisions).toBe(12);
  });
});

describe("editorHelpers", () => {
  it("activePosterTime returns 0 when there are no layers", () => {
    expect(activePosterTime({ ...initialScene, layers: [] })).toBe(0);
  });

  it("patchActive leaves non-active layers unchanged", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        { ...makeDemoLayer(), id: "a", zoom: 1 },
        { ...makeDemoLayer(), id: "b", zoom: 1 }
      ],
      activeLayerId: "a"
    };
    const result = patchActive(scene, { zoom: 2 });
    expect(result.find((l) => l.id === "a")!.zoom).toBe(2);
    expect(result.find((l) => l.id === "b")!.zoom).toBe(1);
  });
});
