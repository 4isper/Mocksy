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

  it("setVideoDuration keeps trimStart <= trimEnd when a shorter clip loads", () => {
    useEditorStore.setState({ scene: { ...initialScene } });
    store().setVideoDuration(10);
    store().setVideoTrimStart(7);
    store().setVideoTrimEnd(8);
    store().setVideoDuration(3);
    const l = store().scene.layers[0]!;
    // Lookout: the new duration is shorter than the current trim start.
    expect(l.videoDuration).toBe(3);
    expect(l.videoTrimStart).toBeLessThanOrEqual(l.videoTrimEnd);
    expect(l.videoTrimStart).toBe(3);
    expect(l.videoTrimEnd).toBe(3);
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

  it("setBackgroundGradient clears the middle stop when explicitly passed null", () => {
    store().setGradientVia("#ffffff");
    expect(store().scene.gradientVia).toBe("#ffffff");
    store().setBackgroundGradient("#059669", "#0ea5e9", undefined, null);
    expect(store().scene.gradientVia).toBeNull();
  });

  it("setGradientVia(null) clears the middle stop", () => {
    store().setGradientVia("#ffffff");
    store().setGradientVia(null);
    expect(store().scene.gradientVia).toBeNull();
  });

  it("coalesces rapid solid color picker edits into one undo step", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene }, lastHistoryKey: null, lastHistoryAt: 0 });
    store().setBackgroundSolid("#111111", true);
    store().setBackgroundSolid("#222222", true);
    expect(store().past).toHaveLength(1);
    expect(store().scene.backgroundColor).toBe("#222222");
  });

  it("coalesces rapid gradient picker/slider edits into one undo step", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene }, lastHistoryKey: null, lastHistoryAt: 0 });
    for (const angle of [10, 60, 120, 240, 359]) {
      store().setBackgroundGradient("#1d4ed8", "#7c3aed", angle, undefined, undefined, true);
    }
    // one baseline entry for the whole drag, not one per degree
    expect(store().past).toHaveLength(1);
    expect(store().scene.gradientAngle).toBe(359);
  });

  it("keeps discrete gradient preset clicks as separate undo steps", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene }, lastHistoryKey: null, lastHistoryAt: 0 });
    store().setBackgroundGradient("#059669", "#0ea5e9", undefined, null);
    store().setBackgroundGradient("#f97316", "#db2777", undefined, null);
    expect(store().past).toHaveLength(2);
  });

  it("setScene merges onto the initial scene", () => {
    store().setScene({ frame: "desktop" });
    store().setZoom(1.2);
    expect(store().scene.frame).toBe("desktop");
    expect(store().scene.layers[0]!.zoom).toBe(1.2);
    // untouched fields fall back to initial values
    expect(store().scene.stylePreset).toBe(initialScene.stylePreset);
  });

  it("resetScene clears content back to a blank canvas", () => {
    store().setScene({ frame: "desktop" });
    store().setZoom(1.2);
    store().resetScene();
    expect(store().scene.frame).toBe(initialScene.frame);
    expect(store().scene.layers).toHaveLength(0);
    expect(store().scene.frameInstances).toHaveLength(0);
    expect(store().scene.annotations).toHaveLength(0);
    expect(store().scene.activeLayerId).toBeNull();
    // Defaults outside the canvas still come back from the initial scene.
    expect(store().scene.backgroundColor).toBe(initialScene.backgroundColor);
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

  it("undo/redo sync videoCurrentTime to the reconciled active layer", () => {
    const l1 = { ...initialScene.layers[0]!, id: "L1", videoPosterTime: 1, videoDuration: 10 };
    const l2 = { ...initialScene.layers[0]!, id: "L2", videoPosterTime: 7, videoDuration: 10 };
    // Restored scene's snapshot points at L1, but the live selection is L2.
    const previous = { ...initialScene, layers: [l1, l2], activeLayerId: "L1" };
    const current = { ...initialScene, layers: [l1, l2], activeLayerId: "L1", tiltX: 5 };
    useEditorStore.setState({
      past: [previous],
      scene: current,
      activeLayerId: "L2",
      videoCurrentTime: 0
    });
    store().undo();
    // L2 still exists in the restored scene, so it stays active — the scrubber
    // must reflect L2's poster time, not the snapshot's L1.
    expect(store().activeLayerId).toBe("L2");
    expect(store().videoCurrentTime).toBe(7);
  });

  it("an edit of the same field right after undo starts a fresh history entry", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene }, lastHistoryKey: null, lastHistoryAt: 0 });
    store().setZoom(1.2);
    expect(store().past).toHaveLength(1);
    store().undo();
    // Same coalesce key ("zoom") within the coalescing window: without a key
    // reset this would merge into the undone edit and leave a stale redo.
    store().setZoom(1.3);
    expect(store().scene.layers[0]!.zoom).toBe(1.3);
    expect(store().past).toHaveLength(1);
    expect(store().future).toHaveLength(0);
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
      activeLayerId: initialScene.activeLayerId,
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
      activeLayerId: initialScene.activeLayerId,
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
      activeLayerId: initialScene.activeLayerId,
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

  it("duplicateAnnotation clones the annotation, offset, and selects the copy", () => {
    reset();
    store().addAnnotation("rect");
    const src = store().scene.annotations[0]!;
    store().updateAnnotation(src.id, { x: 0.3, y: 0.3, w: 0.2, h: 0.1 });
    store().duplicateAnnotation(src.id);
    expect(store().scene.annotations.length).toBe(2);
    const copy = store().scene.annotations[1]!;
    expect(copy.id).not.toBe(src.id);
    expect(copy.w).toBe(0.2);
    expect(copy.x).toBeCloseTo(0.34);
    expect(copy.y).toBeCloseTo(0.34);
    expect(store().selectedAnnotationId).toBe(copy.id);
  });

  it("duplicateAnnotation is a no-op when annotation not found", () => {
    reset();
    const pastBefore = store().past.length;
    store().duplicateAnnotation("nonexistent");
    expect(store().past.length).toBe(pastBefore);
  });

  it("reorderAnnotation moves an annotation to front/back of the render order", () => {
    reset();
    store().addAnnotation("text");
    store().addAnnotation("arrow");
    const [first] = store().scene.annotations;
    store().reorderAnnotation(first!.id, "front");
    expect(store().scene.annotations.map((a) => a.id)[store().scene.annotations.length - 1]).toBe(first!.id);
    store().reorderAnnotation(first!.id, "back");
    expect(store().scene.annotations[0]!.id).toBe(first!.id);
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

  it("dragging two different annotations records two separate undo steps", () => {
    reset();
    store().addAnnotation("rect");
    const idA = store().scene.annotations[0]!.id;
    store().addAnnotation("arrow");
    const idB = store().scene.annotations[1]!.id;
    const afterSetup = store().past.length;
    store().updateAnnotation(idA, { color: "#ff0000" });
    store().updateAnnotation(idB, { color: "#00ff00" });
    expect(store().past.length).toBe(afterSetup + 2);
    expect(store().scene.annotations[0]!.color).toBe("#ff0000");
    expect(store().scene.annotations[1]!.color).toBe("#00ff00");
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

  it("selectAnnotation additive (shift) toggles multi-selection", () => {
    reset();
    store().addAnnotation("rect");
    const a = store().selectedAnnotationId!;
    store().addAnnotation("arrow");
    const b = store().selectedAnnotationId!;
    store().selectAnnotations([a]);
    store().selectAnnotation(b, true);
    expect(store().selectedAnnotationIds.sort()).toEqual([a, b].sort());
    store().selectAnnotation(b, true);
    expect(store().selectedAnnotationIds).toEqual([a]);
  });

  it("removeAnnotations drops the selected annotations in one undo step", () => {
    reset();
    store().addAnnotation("rect");
    const a = store().selectedAnnotationId!;
    store().addAnnotation("arrow");
    const b = store().selectedAnnotationId!;
    store().addAnnotation("text");
    const c = store().selectedAnnotationId!;
    const pastBefore = store().past.length;
    store().selectAnnotations([a, c]);
    store().removeAnnotations([a, c]);
    expect(store().scene.annotations.map((x) => x.id)).toEqual([b]);
    expect(store().selectedAnnotationId).toBeNull();
    expect(store().selectedAnnotationIds).toEqual([]);
    expect(store().past.length).toBe(pastBefore + 1);
  });

  it("removeAnnotations falls back to a remaining selected annotation", () => {
    reset();
    store().addAnnotation("rect");
    const a = store().selectedAnnotationId!;
    store().addAnnotation("arrow");
    const b = store().selectedAnnotationId!;
    store().selectAnnotations([a, b]);
    store().removeAnnotations([b]);
    expect(store().scene.annotations.map((x) => x.id)).toEqual([a]);
    expect(store().selectedAnnotationId).toBe(a);
    expect(store().selectedAnnotationIds).toEqual([a]);
  });

  it("applyAnnotationPatches updates many annotations in one undo step", () => {
    reset();
    store().addAnnotation("rect");
    const a = store().selectedAnnotationId!;
    store().addAnnotation("arrow");
    const b = store().selectedAnnotationId!;
    const pastBefore = store().past.length;
    store().applyAnnotationPatches({ [a]: { x: 0.1 }, [b]: { x: 0.9 } });
    expect(store().scene.annotations.find((x) => x.id === a)!.x).toBeCloseTo(0.1);
    expect(store().scene.annotations.find((x) => x.id === b)!.x).toBeCloseTo(0.9);
    expect(store().past.length).toBe(pastBefore + 1);
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
      selectedFrameIds: [],
      activeLayerId: initialScene.activeLayerId,
      lastHistoryKey: null,
      lastHistoryAt: 0
    });
  }

  it("transformLayers applies the patch to every selected layer and records history", () => {
    reset();
    store().addLayer("data:image/png;base64,second", "image", "second.png");
    const [a, b] = store().scene.layers;
    const pastBefore = store().past.length;
    useEditorStore.getState().transformLayers([a!.id, b!.id], { opacity: 42, zoom: 1.5 });
    const after = store().scene.layers;
    expect(after.find((l) => l.id === a!.id)!.opacity).toBe(42);
    expect(after.find((l) => l.id === b!.id)!.opacity).toBe(42);
    expect(after.find((l) => l.id === b!.id)!.zoom).toBe(1.5);
    expect(store().past.length).toBe(pastBefore + 1);
  });

  it("transformLayers skips locked layers", () => {
    reset();
    store().addLayer("data:image/png;base64,second", "image", "second.png");
    const [a, b] = store().scene.layers;
    useEditorStore.getState().transformLayers([a!.id, b!.id], { opacity: 42 });
    // Lock b via the store, then re-transform: b stays at 42, a updates.
    useEditorStore.setState((s) => ({ scene: { ...s.scene, layers: s.scene.layers.map((l) => (l.id === b!.id ? { ...l, locked: true } : l)) } }));
    useEditorStore.getState().transformLayers([a!.id, b!.id], { opacity: 7 });
    expect(store().scene.layers.find((l) => l.id === a!.id)!.opacity).toBe(7);
    expect(store().scene.layers.find((l) => l.id === b!.id)!.opacity).toBe(42);
  });

  it("nudgeLayers shifts every selected layer's offset", () => {
    reset();
    store().addLayer("data:image/png;base64,second", "image", "second.png");
    const [a, b] = store().scene.layers;
    const pastBefore = store().past.length;
    useEditorStore.getState().nudgeLayers([a!.id, b!.id], 0.1, -0.2);
    const after = store().scene.layers;
    expect(after.find((l) => l.id === a!.id)!.mediaOffsetX).toBeCloseTo(0.1);
    expect(after.find((l) => l.id === b!.id)!.mediaOffsetY).toBeCloseTo(-0.2);
    expect(store().past.length).toBe(pastBefore + 1);
  });


  it("addLayer appends a new layer and makes it active", () => {
    reset();
    const before = store().scene.layers.length;
    store().addLayer("data:image/png;base64,new", "image", "new.png");
    expect(store().scene.layers.length).toBe(before + 1);
    const added = store().scene.layers[store().scene.layers.length - 1]!;
    expect(added.mediaUrl).toBe("data:image/png;base64,new");
    expect(added.mediaName).toBe("new.png");
    expect(store().activeLayerId).toBe(added.id);
  });

  it("addTextLayer appends a text layer, selects it and records history", () => {
    reset();
    const before = store().scene.layers.length;
    const pastBefore = store().past.length;
    store().addTextLayer("Hello world");
    expect(store().scene.layers.length).toBe(before + 1);
    const added = store().scene.layers[store().scene.layers.length - 1]!;
    expect(added.kind).toBe("text");
    expect(added.textContent).toBe("Hello world");
    expect(added.mediaUrl).toBeNull();
    expect(store().activeLayerId).toBe(added.id);
    expect(store().selectedLayerIds).toEqual([added.id]);
    // Editing the text afterwards flows through updateActiveLayer with undo.
    useEditorStore.getState().updateActiveLayer({ textContent: "Changed" });
    expect(store().scene.layers.find((l) => l.id === added.id)!.textContent).toBe("Changed");
    store().undo();
    expect(store().scene.layers.find((l) => l.id === added.id)!.textContent).toBe("Hello world");
    expect(store().past.length).toBe(pastBefore + 1);
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
    expect(store().activeLayerId).toBe(clone.id);
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
    expect(store().activeLayerId).toBe(store().scene.layers[0]!.id);
  });

  it("removeLayer switches active layer when removing the active one", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const first = store().scene.layers[0]!.id;
    store().removeLayer(first);
    expect(store().scene.layers.some(l => l.id === first)).toBe(false);
    expect(store().activeLayerId).toBe(store().scene.layers[0]!.id);
  });

  it("removeLayer is a no-op when only 1 layer remains", () => {
    reset();
    const pastBefore = store().past.length;
    store().removeLayer(store().scene.layers[0]!.id);
    expect(store().scene.layers.length).toBe(1);
    expect(store().past.length).toBe(pastBefore);
  });

  it("removeLayer drops frame instances bound to the removed layer", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const layer2 = store().scene.layers[1]!;
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0.4, y: 0.4, scale: 0.5, layerId: layer2.id },
      { id: "fi2", frame: "iphone" as const, x: 0.6, y: 0.6, scale: 0.5, layerId: store().scene.layers[0]!.id }
    ]);
    store().removeLayer(layer2.id);
    expect(store().scene.frameInstances.map((fi) => fi.id)).toEqual(["fi2"]);
  });

  it("removeLayers drops frame instances bound to any removed layer", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    store().addLayer("data:image/png;base64,l3", "image");
    const [l1, l2, l3] = store().scene.layers;
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0.4, y: 0.4, scale: 0.5, layerId: l1!.id },
      { id: "fi2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 0.5, layerId: l2!.id },
      { id: "fi3", frame: "iphone" as const, x: 0.6, y: 0.6, scale: 0.5, layerId: l3!.id }
    ]);
    store().removeLayers([l1!.id, l2!.id]);
    expect(store().scene.frameInstances.map((fi) => fi.id)).toEqual(["fi3"]);
  });

  it("duplicateLayer is a no-op when the source layer does not exist", () => {
    reset();
    const pastBefore = store().past.length;
    store().duplicateLayer("missing");
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
    expect(store().activeLayerId).toBe(first);
    store().selectLayer(second);
    expect(store().activeLayerId).toBe(second);
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
      selectedFrameIds: [],
      activeLayerId: initialScene.activeLayerId,
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

  it("setCustomFrame stores the skin and selects the custom frame", () => {
    reset();
    const frame = { id: "c1", asset: "data:image/svg+xml;base64,eA==", name: "skin.svg", viewBox: { w: 400, h: 600 }, cutout: { x: 0, y: 0, w: 400, h: 600, rx: 0 } };
    store().setCustomFrame(frame);
    expect(store().scene.customFrame).toEqual(frame);
    expect(store().scene.frame).toBe("custom");
  });

  it("setCustomFrame(null) removes the skin and falls back when custom was active", () => {
    reset();
    const frame = { id: "c1", asset: "data:image/svg+xml;base64,eA==", name: "skin.svg", viewBox: { w: 400, h: 600 }, cutout: { x: 0, y: 0, w: 400, h: 600, rx: 0 } };
    store().setCustomFrame(frame);
    store().setCustomFrame(null);
    expect(store().scene.customFrame).toBeNull();
    expect(store().scene.frame).not.toBe("custom");
  });

  it("setCustomFrame(null) keeps a non-custom frame untouched", () => {
    reset();
    store().setFrame("desktop");
    store().setCustomFrame(null);
    expect(store().scene.frame).toBe("desktop");
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

   it("dragging two different instances records two separate undo steps", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0.5, scale: 1, layerId: null },
      { id: "fi2", frame: "iphone" as const, x: 0, y: 0.5, scale: 1, layerId: null }
    ]);
    const afterSetup = store().past.length;
    store().updateFrameInstance("fi1", { x: 0.1 }, true);
    store().updateFrameInstance("fi2", { x: 0.2 }, true);
    // Each instance has its own coalesce key, so quick drags of different
    // frames must not collapse into a single undo step.
    expect(store().past.length).toBe(afterSetup + 2);
    expect(store().scene.frameInstances[0]!.x).toBe(0.1);
    expect(store().scene.frameInstances[1]!.x).toBe(0.2);
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

  it("setFrameInstanceScreen overrides only the targeted device and seeds from the scene default", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0, scale: 1, layerId: null },
      { id: "fi2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }
    ]);
    // Start from a known scene default.
    store().setScreenChrome({ style: "home", theme: "light", showDock: true });
    // Editing device fi1 creates an independent override seeded from the default.
    store().setFrameInstanceScreen("fi1", { style: "lock", showClock: true });
    expect(store().scene.frameInstances[0]!.screen).toMatchObject({ style: "lock", showClock: true });
    // The seed kept the default's other fields (theme, showDock).
    expect(store().scene.frameInstances[0]!.screen).toMatchObject({ theme: "light", showDock: true });
    // The other device still inherits the scene default (no override).
    expect(store().scene.frameInstances[1]!.screen).toBeUndefined();
    // Editing the scene default later doesn't bleed into the override.
    store().setScreenChrome({ showDock: false });
    expect(store().scene.frameInstances[0]!.screen!.showDock).toBe(true);
  });

  it("setFrameInstanceScreen is a no-op for an unknown id", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0, scale: 1, layerId: null }
    ]);
    const before = store().scene.frameInstances;
    store().setFrameInstanceScreen("nope", { enabled: false });
    expect(store().scene.frameInstances).toBe(before);
  });

  it("clearFrameInstanceOverrides drops screen + floor reflection so the device inherits the defaults", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0, scale: 1, layerId: null }
    ]);
    store().setScreenChrome({ style: "home" });
    store().setFloorReflection(true);
    store().setFrameInstanceScreen("fi1", { style: "lock" });
    store().setFrameInstanceFloorReflection("fi1", false);
    expect(store().scene.frameInstances[0]!.screen!.style).toBe("lock");
    expect(store().scene.frameInstances[0]!.floorReflection).toBe(false);
    store().clearFrameInstanceOverrides("fi1");
    expect(store().scene.frameInstances[0]!.screen).toBeUndefined();
    expect(store().scene.frameInstances[0]!.floorReflection).toBeUndefined();
    expect(store().scene.frameInstances[0]!.id).toBe("fi1");
  });

  it("applyInstanceToAll copies the device chrome and floor reflection to the defaults and clears all overrides", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0, scale: 1, layerId: null },
      { id: "fi2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }
    ]);
    store().setScreenChrome({ style: "home", theme: "light" });
    store().setFloorReflection(true);
    store().setFrameInstanceScreen("fi1", { style: "lock", showClock: true });
    store().setFrameInstanceFloorReflection("fi1", false);
    store().setFrameInstanceScreen("fi2", { style: "statusBar" });
    store().applyInstanceToAll("fi1");
    // Scene defaults now match fi1's effective configuration.
    expect(store().scene.screen.style).toBe("lock");
    expect(store().scene.screen.showClock).toBe(true);
    expect(store().scene.floorReflection).toBe(false);
    // All instance overrides are cleared; they inherit the new defaults.
    expect(store().scene.frameInstances[0]!.screen).toBeUndefined();
    expect(store().scene.frameInstances[0]!.floorReflection).toBeUndefined();
    expect(store().scene.frameInstances[1]!.screen).toBeUndefined();
    expect(store().scene.frameInstances[1]!.floorReflection).toBeUndefined();
  });

  it("setFrameInstanceFloorReflection overrides only the targeted device", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0, y: 0, scale: 1, layerId: null },
      { id: "fi2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }
    ]);
    store().setFloorReflection(false);
    store().setFrameInstanceFloorReflection("fi1", true);
    expect(store().scene.frameInstances[0]!.floorReflection).toBe(true);
    expect(store().scene.frameInstances[1]!.floorReflection).toBeUndefined();
    // Editing the scene default later doesn't bleed into the override.
    store().setFloorReflection(false);
    expect(store().scene.frameInstances[0]!.floorReflection).toBe(true);
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

  it("duplicateFrameInstance clones the instance and its layer, offset from the original", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const srcLayerId = store().scene.layers[1]!.id;
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0.4, y: 0.4, scale: 0.5, layerId: srcLayerId }
    ]);
    const layersBefore = store().scene.layers.length;
    const frameCount = store().scene.frameInstances.length;
    store().duplicateFrameInstance("fi1");
    expect(store().scene.frameInstances.length).toBe(frameCount + 1);
    const copy = store().scene.frameInstances[1]!;
    expect(copy.id).not.toBe("fi1");
    expect(copy.frame).toBe("iphone");
    expect(copy.scale).toBe(0.5);
    expect(copy.x).toBeCloseTo(0.48);
    expect(copy.y).toBeCloseTo(0.48);
    // The copy gets its own cloned layer, not the source's.
    expect(copy.layerId).not.toBe(srcLayerId);
    expect(store().scene.layers.length).toBe(layersBefore + 1);
    expect(store().past.length).toBeGreaterThan(0);
  });

  it("duplicateFrameInstance keeps layerId null when the source has none", () => {
    reset();
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0.4, y: 0.4, scale: 0.5, layerId: null }
    ]);
    store().duplicateFrameInstance("fi1");
    expect(store().scene.frameInstances[1]!.layerId).toBeNull();
    expect(store().past.length).toBeGreaterThan(0);
  });

  it("duplicateFrameInstance is a no-op when instance not found", () => {
    reset();
    const pastBefore = store().past.length;
    store().duplicateFrameInstance("nonexistent");
    expect(store().past.length).toBe(pastBefore);
  });

  it("addFrameInstance appends a clone of the active frame instance with its own layer", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    const srcLayerId = store().scene.layers[1]!.id;
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0.4, y: 0.4, scale: 0.5, layerId: srcLayerId }
    ]);
    store().selectFrameInstance("fi1");
    const layersBefore = store().scene.layers.length;
    const frameCount = store().scene.frameInstances.length;
    store().addFrameInstance();
    expect(store().scene.frameInstances.length).toBe(frameCount + 1);
    const added = store().scene.frameInstances[frameCount]!;
    expect(added.id).not.toBe("fi1");
    expect(added.frame).toBe("iphone");
    expect(added.scale).toBe(0.5);
    expect(added.x).toBeCloseTo(0.48);
    expect(added.y).toBeCloseTo(0.48);
    expect(added.layerId).not.toBe(srcLayerId);
    expect(store().scene.layers.length).toBe(layersBefore + 1);
    expect(store().past.length).toBeGreaterThan(0);
  });

  it("addFrameInstance falls back to the default scene frame when no instances exist", () => {
    reset();
    store().setFrame("macbook");
    store().addFrameInstance();
    expect(store().scene.frameInstances.length).toBe(1);
    const added = store().scene.frameInstances[0]!;
    expect(added.frame).toBe("macbook");
    expect(added.layerId).not.toBeNull();
    expect(store().scene.layers.some((l) => l.id === added.layerId)).toBe(true);
  });

  it("addFrameInstance records undo history on the new instance", () => {
    reset();
    store().addLayer("data:image/png;base64,l2", "image");
    store().setFrameInstances([
      { id: "fi1", frame: "iphone" as const, x: 0.4, y: 0.4, scale: 0.5, layerId: store().scene.layers[1]!.id }
    ]);
    const pastBefore = store().past.length;
    store().addFrameInstance();
    expect(store().past.length).toBe(pastBefore + 1);
  });

  it("reorderFrameInstance moves an instance to front/back of the render order", () => {
    reset();
    store().setFrameInstances([
      { id: "a", frame: "iphone" as const, x: 0.3, y: 0.5, scale: 0.4, layerId: null },
      { id: "b", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 0.4, layerId: null },
      { id: "c", frame: "iphone" as const, x: 0.7, y: 0.5, scale: 0.4, layerId: null }
    ]);
    store().reorderFrameInstance("a", "front");
    expect(store().scene.frameInstances.map((fi) => fi.id)).toEqual(["b", "c", "a"]);
    store().reorderFrameInstance("a", "back");
    expect(store().scene.frameInstances.map((fi) => fi.id)).toEqual(["a", "b", "c"]);
  });

  it("reorderFrameInstances reorders by the given id order (drag-and-drop)", () => {
    reset();
    store().setFrameInstances([
      { id: "a", frame: "none" as const, x: 0.3, y: 0.5, scale: 0.4, layerId: null },
      { id: "b", frame: "none" as const, x: 0.5, y: 0.5, scale: 0.4, layerId: null },
      { id: "c", frame: "none" as const, x: 0.7, y: 0.5, scale: 0.4, layerId: null }
    ]);
    store().reorderFrameInstances(["c", "a", "b"]);
    expect(store().scene.frameInstances.map((fi) => fi.id)).toEqual(["c", "a", "b"]);
  });

  it("reorderFrameInstances is a no-op when the id list is incomplete", () => {
    reset();
    store().setFrameInstances([
      { id: "a", frame: "none" as const, x: 0.3, y: 0.5, scale: 0.4, layerId: null },
      { id: "b", frame: "none" as const, x: 0.5, y: 0.5, scale: 0.4, layerId: null }
    ]);
    const before = store().scene.frameInstances.map((fi) => fi.id);
    store().reorderFrameInstances(["a"]); // missing b
    expect(store().scene.frameInstances.map((fi) => fi.id)).toEqual(before);
  });

  it("alignFrameInstances targets the selected subset when one is active", () => {
    reset();
    store().selectFrameIds([]);
    store().setFrameInstances([
      { id: "a", frame: "none" as const, x: 0.1, y: 0.5, scale: 0.2, layerId: null },
      { id: "b", frame: "none" as const, x: 0.9, y: 0.5, scale: 0.2, layerId: null },
      { id: "c", frame: "none" as const, x: 0.5, y: 0.8, scale: 0.2, layerId: null }
    ]);
    // Select only a & b → align left should not move c.
    store().selectFrameIds(["a", "b"]);
    store().alignFrameInstances("left");
    const after = store().scene.frameInstances;
    const c = after.find((i) => i.id === "c")!;
    expect(c.x).toBeCloseTo(0.5, 6);
    expect(c.y).toBeCloseTo(0.8, 6);
    // a and b share a left edge now.
    expect(Math.abs(after[0]!.x - after[1]!.x)).toBeLessThan(1e-9);
  });

  it("alignFrameInstances falls back to all instances when nothing is selected", () => {
    reset();
    store().selectFrameIds([]);
    store().setFrameInstances([
      { id: "a", frame: "none" as const, x: 0.1, y: 0.5, scale: 0.2, layerId: null },
      { id: "b", frame: "none" as const, x: 0.9, y: 0.5, scale: 0.2, layerId: null }
    ]);
    expect(store().selectedFrameIds).toEqual([]);
    store().alignFrameInstances("centerX");
    const xs = store().scene.frameInstances.map((i) => i.x);
    expect(Math.abs(xs[0]! - xs[1]!)).toBeLessThan(1e-9);
  });

  it("alignFrameInstances clamps positions so frames stay on the canvas", () => {
    reset();
    store().setFrameInstances([
      { id: "a", frame: "none" as const, x: -0.5, y: 1.5, scale: 0.5, layerId: null },
      { id: "b", frame: "none" as const, x: 0.5, y: 0.5, scale: 0.5, layerId: null }
    ]);
    store().selectFrameIds(["a", "b"]);
    store().alignFrameInstances("left");
    const a = store().scene.frameInstances.find((i) => i.id === "a")!;
    // half-extent 0.25 → center must sit in [0.25, 0.75].
    expect(a.x).toBeGreaterThanOrEqual(0.25);
    expect(a.y).toBeLessThanOrEqual(0.75);
  });

  it("toggleFrameSelected adds and removes frames from the selection", () => {
    reset();
    store().selectFrameIds([]);
    store().setFrameInstances([
      { id: "a", frame: "none" as const, x: 0.1, y: 0.1, scale: 0.2, layerId: null },
      { id: "b", frame: "none" as const, x: 0.5, y: 0.5, scale: 0.2, layerId: null }
    ]);
    store().toggleFrameSelected("a");
    expect(store().selectedFrameIds).toEqual(["a"]);
    store().toggleFrameSelected("b");
    expect(store().selectedFrameIds).toEqual(["a", "b"]);
    store().toggleFrameSelected("a");
    expect(store().selectedFrameIds).toEqual(["b"]);
  });

  it("layoutFrameGrid reuses the existing layer when there is only one", () => {
    reset();
    const layersBefore = store().scene.layers.length; // 1 demo layer
    store().layoutFrameGrid("iphone", 3, "horizontal");
    expect(store().scene.frameInstances.length).toBe(3);
    // All three frames bind to the single demo layer (round-robin reuse); no
    // new layers are created, so the scene's media is never duplicated.
    expect(store().scene.layers.length).toBe(layersBefore);
    expect(store().scene.frameInstances.every((fi) => fi.layerId === store().scene.layers[0]!.id)).toBe(true);
  });

  it("re-applying a layout preserves existing layers instead of dropping them", () => {
    reset();
    const baseLayerCount = store().scene.layers.length; // 1 demo layer
    store().layoutFrameGrid("iphone", 2, "horizontal");
    const firstInstanceLayerIds = store().scene.frameInstances.map((fi) => fi.layerId);
    expect(store().scene.layers.length).toBe(baseLayerCount);
    // Apply a different layout with more frames: the existing layer is reused,
    // nothing is dropped and no clones are added.
    store().applyFrameLayout("iphone", 3, "grid");
    expect(store().scene.layers.length).toBe(baseLayerCount);
    for (const id of firstInstanceLayerIds) {
      expect(store().scene.layers.some((l) => l.id === id)).toBe(true);
    }
    expect(store().scene.frameInstances).toHaveLength(3);
  });

  it("layout reuses the scene's existing layers so their media is preserved", () => {
    reset();
    store().addLayer("data:image/png;base64,keep", "image");
    store().addLayer("data:image/png;base64,keep2", "image");
    const layerIds = store().scene.layers.map((l) => l.id);
    store().layoutFrameGrid("iphone", 3, "horizontal");
    const used = store().scene.frameInstances.map((fi) => fi.layerId);
    // All three new frames bind to the existing layers — nothing is cloned and
    // the user's uploaded media survives the layout change.
    expect(used).toEqual(layerIds);
    expect(store().scene.layers.length).toBe(layerIds.length);
  });

  it("layoutFrameGrid falls back to demo layer when no active layer", () => {
    reset();
    useEditorStore.setState({ scene: { ...initialScene, layers: [], activeLayerId: null } });
    store().layoutFrameGrid("iphone", 2, "vertical");
    expect(store().scene.frameInstances.length).toBe(2);
    expect(store().scene.layers.length).toBe(2);
    expect(store().scene.layers[0]!.mediaUrl).toContain("data:image/svg");
  });

  it("applying a layout preserves each frame's type and media, not just the scene frame", () => {
    reset();
    store().addLayer("data:image/png;base64,a", "image");
    store().addLayer("data:image/png;base64,b", "image");
    store().addLayer("data:image/png;base64,c", "image");
    store().setFrameInstances([
      { id: "f1", frame: "iphone16pro" as const, x: 0.1, y: 0.1, scale: 0.3, layerId: store().scene.layers[0]!.id },
      { id: "f2", frame: "iphone15" as const, x: 0.5, y: 0.5, scale: 0.3, layerId: store().scene.layers[1]!.id },
      { id: "f3", frame: "none" as const, x: 0.9, y: 0.9, scale: 0.3, layerId: store().scene.layers[2]!.id }
    ]);
    // A 3-frame layout must reposition all three without dropping the "none"
    // frame or converting every instance to the scene's current frame.
    store().applyFrameLayout("iphone", 3, "grid");
    const byId = Object.fromEntries(store().scene.frameInstances.map((fi) => [fi.id, fi]));
    expect(byId.f1!.frame).toBe("iphone16pro");
    expect(byId.f2!.frame).toBe("iphone15");
    expect(byId.f3!.frame).toBe("none");
    expect(byId.f3!.layerId).toBe(store().scene.layers[2]!.id);
    expect(store().scene.frameInstances).toHaveLength(3);
  });

  it("applying a layout with count matching the scene keeps every existing frame", () => {
    reset();
    store().setFrameInstances([
      { id: "f1", frame: "iphone" as const, x: 0.1, y: 0.1, scale: 0.3, layerId: null },
      { id: "f2", frame: "none" as const, x: 0.5, y: 0.5, scale: 0.3, layerId: null }
    ]);
    store().applyFrameLayout("iphone", 2, "grid");
    const ids = store().scene.frameInstances.map((fi) => fi.id);
    expect(ids).toEqual(["f1", "f2"]);
  });

  it("layoutFrameGrid with count=0 adds no layers and keeps activeLayerId", () => {
    reset();
    store().layoutFrameGrid("iphone", 0, "horizontal");
    expect(store().scene.frameInstances).toHaveLength(0);
    expect(store().activeLayerId).toBe(store().scene.layers[0]!.id);
  });

  it("layout reuses every existing layer cyclically instead of repeating the last", () => {
    reset();
    const before = store().scene.layers.length; // 1 demo layer
    store().addLayer("data:image/png;base64,a", "image");
    store().addLayer("data:image/png;base64,b", "image");
    store().addLayer("data:image/png;base64,c", "image");
    const addedIds = store().scene.layers.slice(before).map((l) => l.id);
    const layerCountBefore = store().scene.layers.length;
    // 6 frames over the 4 existing layers (demo + 3 added) round-robin: each
    // added layer is bound at least once, and no new layers are cloned.
    store().applyFrameLayout("iphone", 6, "grid");
    expect(store().scene.layers.length).toBe(layerCountBefore);
    const used = store().scene.frameInstances.map((fi) => fi.layerId);
    for (const id of addedIds) expect(used).toContain(id);
    // No layer should be used far more than the others (the old bug repeated
    // only the last layer); with 6 frames / 4 layers the spread is even.
    const counts = new Map(used.map((id) => [id, 0]));
    for (const id of used) counts.set(id, (counts.get(id) ?? 0) + 1);
    const max = Math.max(...counts.values());
    const min = Math.min(...counts.values());
    expect(max - min).toBeLessThanOrEqual(1);
  });

  it("applying a layout selects the freshly created frame instances", () => {
    reset();
    store().selectFrameIds([]);
    store().applyFrameLayout("iphone", 4, "grid");
    expect(store().selectedFrameIds).toEqual(store().scene.frameInstances.map((fi) => fi.id));
    expect(store().activeFrameInstanceId).toBe(store().scene.frameInstances[0]!.id);
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
      activeLayerId: initialScene.activeLayerId,
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

  it("setAnimationEasing updates the active layer easing and coalesces", () => {
    reset();
    // A preset click and an easing click are separate undo steps now (they
    // used to share one coalesce key and merge into a single step); repeated
    // easing changes still coalesce with each other.
    store().setAnimationPreset("zoomIn");
    store().setAnimationEasing("bounce");
    expect(store().scene.layers[0]!.animationEasing).toBe("bounce");
    store().setAnimationEasing("spring");
    expect(store().past.length).toBe(2);
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

  it("setEntranceAnimation updates the active layer entrance animation and coalesces", () => {
    reset();
    store().setEntranceAnimation("fadeIn");
    expect(store().scene.layers[0]!.entranceAnimation).toBe("fadeIn");
    store().setEntranceAnimation("slideUp");
    expect(store().past.length).toBe(1);
  });

  it("setEntranceDuration updates the entrance duration and clamps into range", () => {
    reset();
    store().setEntranceDuration(800);
    expect(store().scene.layers[0]!.entranceDuration).toBe(800);
    store().setEntranceDuration(50);
    expect(store().scene.layers[0]!.entranceDuration).toBe(200);
    store().setEntranceDuration(5000);
    expect(store().scene.layers[0]!.entranceDuration).toBe(2000);
  });

  it("setBlendMode updates the active layer blend mode and coalesces", () => {
    reset();
    store().setBlendMode("multiply");
    expect(store().scene.layers[0]!.blendMode).toBe("multiply");
    store().setBlendMode("overlay");
    expect(store().past.length).toBe(1);
    expect(store().scene.layers[0]!.blendMode).toBe("overlay");
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

  it("coalesces interleaved X/Y pan calls into one undo step", () => {
    reset();
    // A pointer-drag pan fires setMediaOffsetX and setMediaOffsetY together on
    // every move; both must share one coalesce key or each move floods history.
    store().setMediaOffsetX(0.1);
    store().setMediaOffsetY(0.2);
    store().setMediaOffsetX(0.3);
    store().setMediaOffsetY(0.4);
    expect(store().past.length).toBe(1);
    expect(store().scene.layers[0]!.mediaOffsetX).toBe(0.3);
    expect(store().scene.layers[0]!.mediaOffsetY).toBe(0.4);
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

  it("setScreenChrome patches the screen decoration and pushes history", () => {
    reset();
    store().setScreenChrome({ enabled: true, style: "home", theme: "light", showDock: false });
    expect(store().scene.screen.enabled).toBe(true);
    expect(store().scene.screen.style).toBe("home");
    expect(store().scene.screen.theme).toBe("light");
    expect(store().scene.screen.showDock).toBe(false);
    // unrelated flags are untouched
    expect(store().scene.screen.showStatusBar).toBe(true);
    store().setScreenChrome({ time: "10:30" });
    expect(store().scene.screen.time).toBe("10:30");
    expect(store().past.length).toBe(1);
    store().undo();
    expect(store().scene.screen.time).toBe(initialScene.screen.time);
    expect(store().scene.screen.enabled).toBe(false);
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

  it("setTiltX and setTiltY update the scene and push history", () => {
    reset();
    store().setTiltX(12);
    expect(store().scene.tiltX).toBe(12);
    expect(store().scene.tiltY).toBe(0);
    store().setTiltY(-8);
    expect(store().scene.tiltY).toBe(-8);
    expect(store().scene.tiltX).toBe(12);
    // rapid slider updates coalesce into a single undo entry
    expect(store().past.length).toBe(1);
    expect(store().past[0]!.tiltX).toBe(0);
    expect(store().past[0]!.tiltY).toBe(0);
  });

  it("different filter sliders stay separate undo steps", () => {
    reset();
    store().setBrightness(120);
    store().setBrightness(150);
    // The same slider still coalesces with itself.
    expect(store().past.length).toBe(1);
    // Touching brightness then contrast within the coalescing window used to
    // merge into one unrecoverable step (shared "layerFilter" key).
    store().setContrast(80);
    expect(store().past.length).toBe(2);
    expect(store().scene.layers[0]!.brightness).toBe(150);
    expect(store().scene.layers[0]!.contrast).toBe(80);
  });

  it("group transforms of different selections stay separate undo steps", () => {
    reset();
    const a = store().scene.layers[0]!;
    store().addLayer("data:image/png;base64,abc", "image", "b.png");
    const b = store().scene.layers[1]!;
    const base = store().past.length; // addLayer recorded its own step
    store().transformLayers([a.id], { zoom: 1.5 });
    expect(store().past.length).toBe(base + 1);
    store().transformLayers([b.id], { zoom: 1.5 });
    expect(store().past.length).toBe(base + 2);
    // Repeated edits of the same (adjacent) selection still coalesce.
    store().transformLayers([b.id], { opacity: 50 });
    expect(store().past.length).toBe(base + 2);
    expect(store().scene.layers.find((l) => l.id === b.id)!.opacity).toBe(50);
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

  it("setMedia with a pinned target applies to that layer even when another is active", () => {
    useEditorStore.setState({ scene: { ...initialScene } });
    store().addLayer("data:image/png;base64,l2", "image");
    const l1Id = store().scene.layers[0]!.id;
    const l2Id = store().scene.layers[1]!.id;
    // The user picked a file while l1 was active, then switched to l2 before
    // the decode finished — the media must still land on l1 (the pinned target).
    store().selectLayer(l2Id);
    store().setMedia("data:image/png;base64,new", "image", "new.png", l1Id);
    expect(store().scene.layers.find((l) => l.id === l1Id)!.mediaUrl).toBe("data:image/png;base64,new");
    expect(store().scene.layers.find((l) => l.id === l2Id)!.mediaUrl).toBe("data:image/png;base64,l2");
    // Selection is not yanked back to the pinned layer.
    expect(store().activeLayerId).toBe(l2Id);
  });

  it("setMedia with a pinned target that got locked silently declines", () => {
    useEditorStore.setState({ scene: { ...initialScene } });
    store().addLayer("data:image/png;base64,l2", "image");
    const l1Id = store().scene.layers[0]!.id;
    store().toggleLayersLocked([l1Id]);
    const before = store().scene.layers.find((l) => l.id === l1Id)!.mediaUrl;
    store().setMedia("data:image/png;base64,new", "image", "new.png", l1Id);
    expect(store().scene.layers.find((l) => l.id === l1Id)!.mediaUrl).toBe(before);
  });

  it("setMedia with a pinned target that no longer exists falls back to the active layer", () => {
    useEditorStore.setState({ scene: { ...initialScene } });
    store().addLayer("data:image/png;base64,l2", "image");
    const l2Id = store().scene.layers[1]!.id;
    store().selectLayer(l2Id);
    store().setMedia("data:image/png;base64,new", "image", "new.png", "ghost-layer");
    expect(store().scene.layers.find((l) => l.id === l2Id)!.mediaUrl).toBe("data:image/png;base64,new");
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
      activeLayerId: initialScene.activeLayerId,
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
      selectedAnnotationId: null,
      activeFrameInstanceId: null,
      selectedFrameIds: [],
      activeLayerId: initialScene.activeLayerId,
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

describe("fullscreen preview state", () => {
  function reset() {
    useEditorStore.setState({
      past: [],
      future: [],
      scene: { ...initialScene },
      fullscreenPreview: false,
      lastHistoryKey: null,
      lastHistoryAt: 0
    });
  }

  it("defaults to off", () => {
    reset();
    expect(useEditorStore.getState().fullscreenPreview).toBe(false);
  });

  it("setFullscreenPreview toggles without touching scene/history", () => {
    reset();
    const before = useEditorStore.getState().scene;
    useEditorStore.getState().setFullscreenPreview(true);
    expect(useEditorStore.getState().fullscreenPreview).toBe(true);
    useEditorStore.getState().setFullscreenPreview(false);
    expect(useEditorStore.getState().fullscreenPreview).toBe(false);
    expect(useEditorStore.getState().scene).toBe(before);
    expect(useEditorStore.getState().past).toHaveLength(0);
  });
});

describe("onboarding tour state", () => {
  it("defaults to closed and toggles without touching scene/history", () => {
    useEditorStore.setState({ scene: { ...initialScene }, past: [], future: [], onboardingOpen: false });
    const before = useEditorStore.getState().scene;
    expect(useEditorStore.getState().onboardingOpen).toBe(false);
    useEditorStore.getState().setOnboardingOpen(true);
    expect(useEditorStore.getState().onboardingOpen).toBe(true);
    useEditorStore.getState().setOnboardingOpen(false);
    expect(useEditorStore.getState().onboardingOpen).toBe(false);
    expect(useEditorStore.getState().scene).toBe(before);
    expect(useEditorStore.getState().past).toHaveLength(0);
  });
});

describe("screen glare state", () => {
  it("defaults to off; toggling records exactly one history step", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene, screenGlare: false } });
    expect(useEditorStore.getState().scene.screenGlare).toBe(false);
    useEditorStore.getState().setScreenGlare(true);
    expect(useEditorStore.getState().scene.screenGlare).toBe(true);
    expect(useEditorStore.getState().past.length).toBe(1);
    useEditorStore.getState().setScreenGlare(false);
    expect(useEditorStore.getState().scene.screenGlare).toBe(false);
    expect(useEditorStore.getState().past.length).toBe(2);
  });
});

describe("floor reflection state", () => {
  it("defaults to off and records history on toggle", () => {
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene, floorReflection: false } });
    useEditorStore.getState().setFloorReflection(true);
    expect(useEditorStore.getState().scene.floorReflection).toBe(true);
    expect(useEditorStore.getState().past.length).toBe(1);
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

  describe("jumpToHistory", () => {
    const buildTimeline = () => {
      useEditorStore.setState({ scene: initialScene, past: [], future: [] });
      useEditorStore.getState().setScene({ backgroundColor: "#111111" });
      useEditorStore.getState().setScene({ backgroundColor: "#222222" });
      useEditorStore.getState().setScene({ backgroundColor: "#333333" });
      return store();
    };

    it("jumps back and rebuilds the redo stack", () => {
      const s = buildTimeline();
      expect(s.past.length).toBe(3);
      useEditorStore.getState().jumpToHistory(0);
      const after = store();
      expect(after.scene.backgroundColor).toBe(initialScene.backgroundColor);
      expect(after.past.length).toBe(0);
      expect(after.future.length).toBe(3);
    });

    it("jumps to an earlier step and rebuilds the redo stack", () => {
      buildTimeline();
      // Timeline indices: 0=initial, 1=#111111, 2=#222222, 3=#333333.
      useEditorStore.getState().jumpToHistory(2);
      const after = store();
      expect(after.scene.backgroundColor).toBe("#222222");
      expect(after.past.length).toBe(2);
      expect(after.future.length).toBe(1);
    });

    it("is a no-op when jumping to the current index", () => {
      const s = buildTimeline();
      const backgroundColor = s.scene.backgroundColor;
      const pastLen = s.past.length;
      useEditorStore.getState().jumpToHistory(s.past.length);
      expect(store().scene.backgroundColor).toBe(backgroundColor);
      expect(store().past.length).toBe(pastLen);
    });

    it("clamps out-of-range indices", () => {
      buildTimeline();
      useEditorStore.getState().jumpToHistory(999);
      expect(store().scene.backgroundColor).toBe("#333333");
      useEditorStore.getState().jumpToHistory(-5);
      expect(store().scene.backgroundColor).toBe(initialScene.backgroundColor);
    });
  });
});
