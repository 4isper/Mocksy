import { describe, expect, it } from "vitest";
import { useEditorStore } from "@/lib/state/editorStore";
import { initialScene } from "@/lib/state/editorStore";
import { makeDemoLayer } from "@/lib/state/editorHelpers";
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

describe("groupLayers", () => {
  it("assigns a shared groupId to the selected layers", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [layer({ id: "A", mediaName: "Alpha" }), layer({ id: "B", mediaName: "Beta" })],
      activeLayerId: "A"
    };
    seed(scene, { selectedLayerIds: ["A", "B"] });
    store().groupLayers(["A", "B"]);

    const layers = store().scene.layers;
    const groupA = layers.find((l) => l.id === "A")?.groupId;
    const groupB = layers.find((l) => l.id === "B")?.groupId;
    expect(groupA).toBeTruthy();
    expect(groupA).toBe(groupB);
  });

  it("does nothing with fewer than 2 ids", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [layer({ id: "A" })],
      activeLayerId: "A"
    };
    seed(scene, { selectedLayerIds: ["A"] });
    store().groupLayers(["A"]);

    expect(store().scene.layers[0]?.groupId).toBeUndefined();
  });

  it("does not group layers not in the id list", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [layer({ id: "A" }), layer({ id: "B" }), layer({ id: "C" })],
      activeLayerId: "A"
    };
    seed(scene, { selectedLayerIds: ["A", "B"] });
    store().groupLayers(["A", "B"]);

    expect(store().scene.layers.find((l) => l.id === "C")?.groupId).toBeUndefined();
  });
});

describe("ungroupLayers", () => {
  it("removes groupId from the specified layers", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        layer({ id: "A", groupId: "g1" }),
        layer({ id: "B", groupId: "g1" }),
        layer({ id: "C", groupId: "g1" })
      ],
      activeLayerId: "A"
    };
    seed(scene, { selectedLayerIds: ["A", "B"] });
    store().ungroupLayers(["A", "B"]);

    const layers = store().scene.layers;
    expect(layers.find((l) => l.id === "A")?.groupId).toBeNull();
    expect(layers.find((l) => l.id === "B")?.groupId).toBeNull();
    expect(layers.find((l) => l.id === "C")?.groupId).toBe("g1");
  });
});

describe("toggleGroupHidden", () => {
  it("hides all layers in the group when any are visible", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        layer({ id: "A", groupId: "g1", hidden: false }),
        layer({ id: "B", groupId: "g1", hidden: false })
      ],
      activeLayerId: "A"
    };
    seed(scene);
    store().toggleGroupHidden("g1");

    const layers = store().scene.layers;
    expect(layers.find((l) => l.id === "A")?.hidden).toBe(true);
    expect(layers.find((l) => l.id === "B")?.hidden).toBe(true);
  });

  it("shows all layers in the group when all are hidden", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        layer({ id: "A", groupId: "g1", hidden: true }),
        layer({ id: "B", groupId: "g1", hidden: true })
      ],
      activeLayerId: "A"
    };
    seed(scene);
    store().toggleGroupHidden("g1");

    const layers = store().scene.layers;
    expect(layers.find((l) => l.id === "A")?.hidden).toBe(false);
    expect(layers.find((l) => l.id === "B")?.hidden).toBe(false);
  });

  it("does nothing with a null groupId", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [layer({ id: "A", hidden: false })],
      activeLayerId: "A"
    };
    seed(scene);
    store().toggleGroupHidden(null);

    expect(store().scene.layers[0]?.hidden).toBe(false);
  });
});

describe("toggleGroupLocked", () => {
  it("locks all layers in the group when any are unlocked", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        layer({ id: "A", groupId: "g1", locked: false }),
        layer({ id: "B", groupId: "g1", locked: false })
      ],
      activeLayerId: "A"
    };
    seed(scene);
    store().toggleGroupLocked("g1");

    const layers = store().scene.layers;
    expect(layers.find((l) => l.id === "A")?.locked).toBe(true);
    expect(layers.find((l) => l.id === "B")?.locked).toBe(true);
  });

  it("unlocks all layers in the group when all are locked", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        layer({ id: "A", groupId: "g1", locked: true }),
        layer({ id: "B", groupId: "g1", locked: true })
      ],
      activeLayerId: "A"
    };
    seed(scene);
    store().toggleGroupLocked("g1");

    const layers = store().scene.layers;
    expect(layers.find((l) => l.id === "A")?.locked).toBe(false);
    expect(layers.find((l) => l.id === "B")?.locked).toBe(false);
  });
});

describe("renameGroup", () => {
  it("renames the first layer's mediaName for the group", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [
        layer({ id: "A", groupId: "g1", mediaName: "Old Name" }),
        layer({ id: "B", groupId: "g1", mediaName: "Beta" })
      ],
      activeLayerId: "A"
    };
    seed(scene);
    store().renameGroup("g1", "New Name");

    const layers = store().scene.layers;
    expect(layers.find((l) => l.id === "A")?.mediaName).toBe("New Name");
    expect(layers.find((l) => l.id === "B")?.mediaName).toBe("Beta");
  });

  it("does nothing with a null groupId", () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [layer({ id: "A", mediaName: "Original" })],
      activeLayerId: "A"
    };
    seed(scene);
    store().renameGroup(null, "New");

    expect(store().scene.layers[0]?.mediaName).toBe("Original");
  });
});
