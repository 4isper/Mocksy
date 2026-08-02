import { activeLayer, buildAutoLayout, layoutFrameGrid, makeDemoLayer, nextLayerId, pushHistory } from "@/lib/state/editorHelpers";
import type { EditorScene, FrameInstance, MockupFrame } from "@/lib/types/editor";
import type { EditorStoreSetter, EditorStoreState } from "../editorStoreTypes";

export type FramesSlice = Pick<
  EditorStoreState,
  | "setFrame"
  | "setFrameInstances"
  | "updateFrameInstance"
  | "removeFrameInstance"
  | "layoutFrameGrid"
  | "applyFrameLayout"
  | "selectFrameInstance"
>;

/**
 * Turns laid-out frame instances into a real multi-frame scene: each instance
 * gets a fresh layer cloned from the active one (or the demo layer), and the
 * first new layer becomes active.
 *
 * Re-applying a layout replaces the previous one, so layers that were only
 * referenced by the old frame instances are dropped — otherwise every apply
 * would accumulate orphaned layers that render stacked in single-frame view
 * and bloat undo history, share URLs and exports.
 */
function materializeLayout(instances: FrameInstance[], scene: EditorScene) {
  const activeLayerData = activeLayer(scene);
  const newLayers = instances.map((inst) => ({
    ...(activeLayerData ?? makeDemoLayer()),
    id: nextLayerId(),
    hidden: false,
    animationPreset: "none" as const
  }));
  const layerIds = newLayers.map((l) => l.id);
  const frameInstances = instances.map((inst, i) => ({
    ...inst,
    layerId: layerIds[i] ?? null
  }));
  const newLayerIdSet = new Set(layerIds);
  const orphaned = new Set(
    scene.frameInstances
      .map((fi) => fi.layerId)
      .filter((id): id is string => id != null && !newLayerIdSet.has(id))
  );
  const layers = [...scene.layers.filter((l) => !orphaned.has(l.id)), ...newLayers];
  return {
    layers,
    frameInstances,
    activeLayerId: layerIds[0] ?? scene.activeLayerId
  };
}

export function createFramesSlice(set: EditorStoreSetter): FramesSlice {
  return {
    setFrame: (frame) =>
      set((s) => {
        const nextScene = { ...s.scene, frame };
        if (nextScene.frameInstances.length > 0) {
          nextScene.frameInstances = nextScene.frameInstances.map((inst) => ({ ...inst, frame }));
        }
        return pushHistory(s, nextScene);
      }),
    setFrameInstances: (instances: FrameInstance[]) => set((s) => pushHistory(s, { ...s.scene, frameInstances: instances })),
    removeFrameInstance: (id) =>
      set((s) => {
        const inst = s.scene.frameInstances.find((fi) => fi.id === id);
        if (!inst) return {};
        const remaining = s.scene.frameInstances.filter((fi) => fi.id !== id);
        const layers = inst.layerId && !remaining.some((fi) => fi.layerId === inst.layerId)
          ? s.scene.layers.filter((l) => l.id !== inst.layerId)
          : s.scene.layers;
        const activeLayerId = layers.some((l) => l.id === s.scene.activeLayerId)
          ? s.scene.activeLayerId
          : layers[0]?.id ?? null;
        return pushHistory(s, { ...s.scene, layers, frameInstances: remaining, activeLayerId });
      }),
    updateFrameInstance: (id, patch, coalesce) =>
      set((s) => {
        const frameInstances = s.scene.frameInstances.map((fi) =>
          fi.id === id ? { ...fi, ...patch } : fi
        );
        return pushHistory(s, { ...s.scene, frameInstances }, coalesce ? "frameInstanceDrag" : undefined);
      }),
    layoutFrameGrid: (frame: MockupFrame, count: number, direction: "horizontal" | "vertical") =>
      set((s) => {
        const instances = layoutFrameGrid(frame, count, direction);
        return pushHistory(s, { ...s.scene, ...materializeLayout(instances, s.scene) });
      }),
    applyFrameLayout: (frame: MockupFrame, count: number, layout: import("@/lib/types/editor").LayoutPreset) =>
      set((s) => {
        const instances = buildAutoLayout(frame, count, layout, s.scene.aspectRatio);
        return pushHistory(s, { ...s.scene, ...materializeLayout(instances, s.scene) });
      }),
    selectFrameInstance: (id) => set({ activeFrameInstanceId: id })
  };
}
