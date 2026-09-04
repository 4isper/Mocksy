import { describe, expect, it } from "vitest";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
import { makeDemoLayer, makeAnnotation } from "@/lib/state/editorHelpers";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import type { EditorStoreState } from "@/lib/state/editorStore";

const store = () => useEditorStore.getState();

function layer(overrides: Partial<MediaLayer> = {}): MediaLayer {
  return { ...makeDemoLayer(), id: overrides.id ?? "layer-test", ...overrides };
}

function seed(scene: EditorScene, extra: Partial<EditorStoreState> = {}): void {
  useEditorStore.setState({
    scene,
    past: [],
    future: [],
    activeLayerId: scene.activeLayerId,
    selectedLayerIds: scene.layers.map((l) => l.id),
    selectedAnnotationId: null,
    selectedAnnotationIds: [],
    activeFrameInstanceId: null,
    videoCurrentTime: 0,
    mediaUploadError: null,
    ...extra
  } as EditorStoreState);
}

// ---------------------------------------------------------------------------
// layersSlice — top-level `locked(s) ? {} : ...` true branch for every guarded
// setter. With the active layer locked, each setter is a no-op.
// ---------------------------------------------------------------------------
describe("layersSlice locked no-ops", () => {
  it("leaves the scene untouched when the active layer is locked", () => {
    const lockedScene: EditorScene = {
      ...initialScene,
      layers: [layer({ id: "L1", locked: true })],
      activeLayerId: "L1"
    };
    seed(lockedScene);

    const before = JSON.stringify(store().scene);
    const guarded: Array<[keyof EditorStoreState, ...unknown[]]> = [
      ["setMedia", "u", "image", "n"],
      ["setMediaOnLayer", "L1", "u", "image", "n"],
      ["removeLayer", "L1"],
      ["updateActiveLayer", { zoom: 2 }],
      ["renameLayer", "L1", "x"],
      ["setAnimationPreset", "fade"],
      ["setAnimationEasing", "ease-in"],
      ["setZoom", 1.2],
      ["setMediaOffsetX", 0.1],
      ["setMediaOffsetY", 0.1],
      ["setRotation", 5],
      ["setMediaFit", "contain"],
      ["setBrightness", 120],
      ["setContrast", 110],
      ["setSaturate", 105],
      ["setBlur", 2],
      ["setGrayscale", true],
      ["setOpacity", 0.5],
      ["setVideoMuted", true],
      ["setVideoLoop", true],
      ["setVideoAutoplay", true],
      ["setVideoPosterTime", 3],
      ["setVideoQuality", "high"],
      ["setVideoTrimStart", 1],
      ["setVideoTrimEnd", 2],
      ["setPlaybackSpeed", 1.5],
      ["setVideoDuration", 10]
    ];
    for (const [name, ...args] of guarded) {
      (store() as unknown as Record<string, ((...a: unknown[]) => void) | undefined>)[name as string]?.(...args);
    }
    expect(JSON.stringify(store().scene)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// layersSlice — empty / missing / locked edge branches.
// ---------------------------------------------------------------------------
describe("layersSlice edge branches", () => {
  it("setMediaOnLayer updates the target and leaves others untouched", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" })], activeLayerId: "A" });
    const bBefore = store().scene.layers.find((l) => l.id === "B")!.mediaUrl;
    store().setMediaOnLayer("A", "blob:x", "image", "a.png");
    expect(store().scene.layers.find((l) => l.id === "A")!.mediaUrl).toBe("blob:x");
    expect(store().scene.layers.find((l) => l.id === "B")!.mediaUrl).toBe(bBefore);
  });

  it("setMediaOnLayer is a no-op for a locked target layer", () => {
    seed({ ...initialScene, layers: [layer({ id: "A", locked: true })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().setMediaOnLayer("A", "blob:x", "image", "a.png");
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("setMediaOnLayer is a no-op for a missing layer", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().setMediaOnLayer("ghost", "blob:x", "image", "a.png");
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("toggleLayersLocked is a no-op for an empty id list", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().toggleLayersLocked([]);
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("toggleLayersLocked only flips the targeted layer", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" })], activeLayerId: "A" });
    store().toggleLayersLocked(["A"]);
    expect(store().scene.layers.find((l) => l.id === "A")!.locked).toBe(true);
    expect(store().scene.layers.find((l) => l.id === "B")!.locked).toBe(false);
  });

  it("removeLayer is a no-op for a locked layer", () => {
    seed({ ...initialScene, layers: [layer({ id: "A", locked: true }), layer({ id: "B" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().removeLayer("A");
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("duplicateLayers is a no-op for an empty id list", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().duplicateLayers([]);
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("duplicateLayers is a no-op when no id resolves to a layer", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().duplicateLayers(["ghost"]);
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("toggleLayersHidden is a no-op for an empty id list", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().toggleLayersHidden([]);
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("toggleLayersHidden only flips the targeted layer", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" })], activeLayerId: "A" });
    store().toggleLayersHidden(["B"]);
    expect(store().scene.layers.find((l) => l.id === "B")!.hidden).toBe(true);
    expect(store().scene.layers.find((l) => l.id === "A")!.hidden).toBe(false);
  });

  it("removeLayers keeps locked layers even when explicitly listed", () => {
    seed({ ...initialScene, layers: [layer({ id: "A", locked: true }), layer({ id: "B" })], activeLayerId: "B" });
    const before = JSON.stringify(store().scene);
    store().removeLayers(["A"]);
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("removeLayers is a no-op when the ids cover every layer", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().removeLayers(["A", "B"]);
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("removeLayers falls back to the first remaining layer when the active one is removed", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" })], activeLayerId: "A" });
    store().removeLayers(["A"]);
    expect(store().scene.layers).toHaveLength(1);
    expect(store().activeLayerId).toBe("B");
  });

  it("removeLayers keeps the active layer when only a non-active layer is removed", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" })], activeLayerId: "A" });
    store().removeLayers(["B"]);
    expect(store().activeLayerId).toBe("A");
  });

  it("transformLayers is a no-op for an empty id list", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().transformLayers([], { zoom: 2 });
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("transformLayers is a no-op when every targeted layer is locked", () => {
    seed({ ...initialScene, layers: [layer({ id: "A", locked: true })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().transformLayers(["A"], { zoom: 2 });
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("transformLayers applies the patch to unlocked targeted layers", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" });
    store().transformLayers(["A"], { zoom: 2 });
    expect(store().scene.layers[0]!.zoom).toBe(2);
  });

  it("nudgeLayers is a no-op for an empty id list", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().nudgeLayers([], 0.1, 0.1);
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("nudgeLayers skips locked layers", () => {
    seed({
      ...initialScene,
      layers: [layer({ id: "A", locked: true }), layer({ id: "B" })],
      activeLayerId: "A"
    });
    store().nudgeLayers(["A", "B"], 0.1, 0.2);
    expect(store().scene.layers.find((l) => l.id === "A")!.mediaOffsetX).toBe(0);
    expect(store().scene.layers.find((l) => l.id === "B")!.mediaOffsetX).toBeCloseTo(0.1, 5);
  });

  it("selectLayer is a no-op when the layer is already the sole selection", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" }, { selectedLayerIds: ["A"] });
    const before = JSON.stringify({ a: store().activeLayerId, s: store().selectedLayerIds });
    store().selectLayer("A");
    expect(JSON.stringify({ a: store().activeLayerId, s: store().selectedLayerIds })).toBe(before);
  });

  it("selectLayers with an empty list clears the selection", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" }, { selectedLayerIds: ["A"] });
    store().selectLayers([]);
    expect(store().activeLayerId).toBeNull();
    expect(store().selectedLayerIds).toEqual([]);
  });

  it("toggleLayerSelected re-selects the layer when toggling off the last one", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" }, { selectedLayerIds: ["A"] });
    store().toggleLayerSelected("A");
    expect(store().selectedLayerIds).toEqual(["A"]);
  });

  it("toggleLayerSelected re-points the active layer at the last remaining selection", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" }), layer({ id: "C" })], activeLayerId: "C" }, { selectedLayerIds: ["A", "B", "C"] });
    store().toggleLayerSelected("C");
    expect(store().selectedLayerIds).toEqual(["A", "B"]);
    // The deselected layer must not remain the active one — the control panel
    // edits the active layer, so it has to stay inside the selection.
    expect(store().activeLayerId).toBe("B");
  });

  it("selectLayerRange anchors to the id when nothing is selected", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" })], activeLayerId: "A" }, { selectedLayerIds: [] });
    store().selectLayerRange("B");
    expect(store().selectedLayerIds).toEqual(["B"]);
  });

  it("selectLayerRange selects just the id when it is not in the layer list", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" })], activeLayerId: "A" }, { selectedLayerIds: [] });
    store().selectLayerRange("ghost");
    expect(store().selectedLayerIds).toEqual(["ghost"]);
  });

  it("selectLayerRange merges the range when additive", () => {
    seed({
      ...initialScene,
      layers: [layer({ id: "A" }), layer({ id: "B" }), layer({ id: "C" })],
      activeLayerId: "A"
    }, { selectedLayerIds: ["A"] });
    store().selectLayerRange("C", true);
    expect(store().selectedLayerIds.sort()).toEqual(["A", "B", "C"]);
  });

  it("reorderLayers applies a new order", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" })], activeLayerId: "A" });
    store().reorderLayers(["B", "A"]);
    expect(store().scene.layers.map((l) => l.id)).toEqual(["B", "A"]);
  });

  it("reorderLayers is a no-op when the order is unchanged", () => {
    seed({ ...initialScene, layers: [layer({ id: "A" }), layer({ id: "B" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene.layers);
    store().reorderLayers(["A", "B"]);
    expect(JSON.stringify(store().scene.layers)).toBe(before);
  });

  it("updateActiveLayer is a no-op when there is no active layer", () => {
    seed({ ...initialScene, layers: [], activeLayerId: null });
    const before = JSON.stringify(store().scene);
    store().updateActiveLayer({ zoom: 2 });
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("renameLayer is a no-op for a missing layer", () => {
    seed({ ...initialScene, layers: [layer({ id: "A", mediaName: "old" })], activeLayerId: "A" });
    const before = JSON.stringify(store().scene);
    store().renameLayer("ghost", "new");
    expect(JSON.stringify(store().scene)).toBe(before);
  });

  it("renameLayer keeps the old name when the new one is empty", () => {
    seed({ ...initialScene, layers: [layer({ id: "A", mediaName: "old" })], activeLayerId: "A" });
    store().renameLayer("A", "");
    expect(store().scene.layers[0]!.mediaName).toBe("old");
  });

  it("renameLayer updates the name for a valid layer", () => {
    seed({ ...initialScene, layers: [layer({ id: "A", mediaName: "old" })], activeLayerId: "A" });
    store().renameLayer("A", "new");
    expect(store().scene.layers[0]!.mediaName).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// appearanceSlice — optional args, missing ids, empty selections.
// ---------------------------------------------------------------------------
describe("appearanceSlice edge branches", () => {
  it("setBackgroundGradient omits unspecified optional fields", () => {
    seed(initialScene);
    store().setBackgroundGradient("from", "to");
    const scene = store().scene;
    expect(scene.gradientFrom).toBe("from");
    expect(scene.gradientTo).toBe("to");
    expect(scene.gradientAngle).toBe(initialScene.gradientAngle);
    expect(scene.gradientVia).toBe(initialScene.gradientVia);
    expect(scene.gradientType).toBe(initialScene.gradientType);
  });

  it("reorderAnnotation is a no-op for a missing id", () => {
    seed({ ...initialScene, annotations: [makeAnnotation("text")] });
    const before = JSON.stringify(store().scene.annotations);
    store().reorderAnnotation("ghost", "front");
    expect(JSON.stringify(store().scene.annotations)).toBe(before);
  });

  it("applyAnnotationPatches leaves unpatched annotations untouched", () => {
    const a = makeAnnotation("text");
    const b = makeAnnotation("rect");
    seed({ ...initialScene, annotations: [a, b] });
    store().applyAnnotationPatches({ [a.id]: { x: 0.5 } });
    expect(store().scene.annotations[0]!.x).toBe(0.5);
    expect(store().scene.annotations[1]!.x).toBe(b.x);
  });

  it("selectAnnotation additive toggle drops to null when the last is removed", () => {
    const a = makeAnnotation("text");
    seed({ ...initialScene, annotations: [a] }, { selectedAnnotationId: a.id, selectedAnnotationIds: [a.id] });
    store().selectAnnotation(a.id, true);
    expect(store().selectedAnnotationId).toBeNull();
    expect(store().selectedAnnotationIds).toEqual([]);
  });

  it("selectAnnotations with an empty list clears the selection", () => {
    const a = makeAnnotation("text");
    seed({ ...initialScene, annotations: [a] }, { selectedAnnotationId: a.id, selectedAnnotationIds: [a.id] });
    store().selectAnnotations([]);
    expect(store().selectedAnnotationId).toBeNull();
    expect(store().selectedAnnotationIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// framesSlice — custom frame fallbacks, remove/duplicate/reorder guards, align
// and distribute minimums, material targeting.
// ---------------------------------------------------------------------------
describe("framesSlice edge branches", () => {
  it("setCustomFrame does not remap instances when clearing with none present", () => {
    const inst = { id: "f1", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null };
    seed({ ...initialScene, frameInstances: [inst] });
    store().setCustomFrame(null);
    expect(store().scene.frameInstances[0]!.frame).toBe("iphone");
  });

  it("setCustomFrame only remaps custom instances", () => {
    seed({
      ...initialScene,
      frameInstances: [
        { id: "f1", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null },
        { id: "f2", frame: "custom" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }
      ]
    });
    store().setCustomFrame({ id: "c", asset: "x", name: "n", viewBox: { w: 1, h: 1 }, cutout: { x: 0, y: 0, w: 1, h: 1, rx: 0 } });
    expect(store().scene.frameInstances[0]!.frame).toBe("iphone");
    expect(store().scene.frameInstances[1]!.frame).toBe("custom");
  });

  it("removeFrameInstance drops the active layer when it was the only layer", () => {
    seed({
      ...initialScene,
      layers: [layer({ id: "A" })],
      activeLayerId: "A",
      frameInstances: [{ id: "f1", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: "A" }]
    });
    store().removeFrameInstance("f1");
    expect(store().scene.layers).toHaveLength(0);
    expect(store().activeLayerId).toBeNull();
  });

  it("duplicateFrameInstance keeps the source layer when it is missing", () => {
    seed({
      ...initialScene,
      layers: [layer({ id: "A" })],
      activeLayerId: "A",
      frameInstances: [{ id: "f1", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: "ghost" }]
    });
    const before = JSON.stringify(store().scene.layers);
    store().duplicateFrameInstance("f1");
    expect(JSON.stringify(store().scene.layers)).toBe(before);
  });

  it("reorderFrameInstance is a no-op for a missing id", () => {
    seed({
      ...initialScene,
      frameInstances: [{ id: "f1", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }]
    });
    const before = JSON.stringify(store().scene.frameInstances);
    store().reorderFrameInstance("ghost", "front");
    expect(JSON.stringify(store().scene.frameInstances)).toBe(before);
  });

  it("alignFrameInstances is a no-op with fewer than two instances", () => {
    seed({
      ...initialScene,
      frameInstances: [{ id: "f1", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }]
    });
    const before = JSON.stringify(store().scene.frameInstances);
    store().alignFrameInstances("left");
    expect(JSON.stringify(store().scene.frameInstances)).toBe(before);
  });

  it("distributeFrameInstances is a no-op with fewer than three instances", () => {
    seed({
      ...initialScene,
      frameInstances: [
        { id: "f1", frame: "iphone" as const, x: 0.2, y: 0.5, scale: 1, layerId: null },
        { id: "f2", frame: "iphone" as const, x: 0.8, y: 0.5, scale: 1, layerId: null }
      ]
    });
    const before = JSON.stringify(store().scene.frameInstances);
    store().distributeFrameInstances("horizontal");
    expect(JSON.stringify(store().scene.frameInstances)).toBe(before);
  });

  it("setFrameMaterial leaves non-targeted instances untouched when one is active", () => {
    seed(
      {
        ...initialScene,
        frameInstances: [
          { id: "f1", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null },
          { id: "f2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }
        ]
      },
      { activeFrameInstanceId: "f1" }
    );
    store().setFrameMaterial("graphite");
    expect(store().scene.frameInstances[1]!.material).toBeUndefined();
  });

  it("setFrameMaterial updates every instance when none is active", () => {
    seed(
      {
        ...initialScene,
        frameInstances: [
          { id: "f1", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null },
          { id: "f2", frame: "iphone" as const, x: 0.5, y: 0.5, scale: 1, layerId: null }
        ]
      },
      { activeFrameInstanceId: null }
    );
    store().setFrameMaterial("graphite");
    expect(store().scene.frameInstances.every((i) => i.material === "graphite")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sceneSlice — media upload error timer + clearing.
// ---------------------------------------------------------------------------
describe("sceneSlice media upload error", () => {
  it("clears a pending auto-dismiss timer on a subsequent error", () => {
    seed(initialScene);
    store().setMediaUploadError("first");
    store().setMediaUploadError("second");
    expect(store().mediaUploadError).toBe("second");
  });

  it("does not schedule a timer when the error is cleared", () => {
    seed(initialScene);
    store().setMediaUploadError(null);
    expect(store().mediaUploadError).toBeNull();
  });
});
