import { activeLayer, alignFrameInstances, buildAutoLayout, distributeFrameInstances, layoutFrameGrid, makeDemoLayer, nextLayerId, pushHistory } from "@/lib/state/editorHelpers";
import { nextFrameInstanceId } from "@/lib/state/ids";
import type { CustomFrame, EditorScene, FrameInstance, MockupFrame } from "@/lib/types/editor";
import type { FrameAlignMode } from "@/lib/state/frameAlign";
import type { EditorStoreSetter, EditorStoreState } from "../editorStoreTypes";

export type FramesSlice = Pick<
  EditorStoreState,
  | "setFrame"
  | "setCustomFrame"
  | "setFrameInstances"
  | "updateFrameInstance"
  | "setFrameMaterial"
  | "removeFrameInstance"
  | "addFrameInstance"
  | "duplicateFrameInstance"
  | "reorderFrameInstance"
  | "layoutFrameGrid"
  | "applyFrameLayout"
  | "alignFrameInstances"
  | "distributeFrameInstances"
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
function materializeLayout(instances: FrameInstance[], scene: EditorScene, activeLayerId: string | null) {
  const activeLayerData = activeLayer(scene, activeLayerId);
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
    activeLayerId: layerIds[0] ?? activeLayerId
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
    // Uploading a custom frame selects it immediately; clearing it falls back
    // to the default frame so the scene never sits on a dangling "custom" value.
    setCustomFrame: (customFrame: CustomFrame | null) =>
      set((s) => {
        const frame = customFrame
          ? "custom" as MockupFrame
          : (s.scene.frame === "custom" ? "iphone" as MockupFrame : s.scene.frame);
        const nextScene = { ...s.scene, customFrame, frame };
        if (nextScene.frameInstances.length > 0 && customFrame) {
          nextScene.frameInstances = nextScene.frameInstances.map((inst) =>
            inst.frame === "custom" ? { ...inst, frame } : inst
          );
        }
        return pushHistory(s, nextScene, "customFrame");
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
        const activeLayerId = layers.some((l) => l.id === s.activeLayerId)
          ? s.activeLayerId
          : layers[0]?.id ?? null;
        return { ...pushHistory(s, { ...s.scene, layers, frameInstances: remaining }), activeLayerId };
      }),
    updateFrameInstance: (id, patch, coalesce) =>
      set((s) => {
        const frameInstances = s.scene.frameInstances.map((fi) =>
          fi.id === id ? { ...fi, ...patch } : fi
        );
        // The coalesce key must include the instance id: a constant key would
        // merge a drag of instance A and a quick drag of instance B (within the
        // 400ms window) into a single undo step, dropping the intermediate
        // state. Keying per-instance keeps each frame's drag its own step.
        return pushHistory(s, { ...s.scene, frameInstances }, coalesce ? `frameInstanceDrag:${id}` : undefined);
      }),
    addFrameInstance: () =>
      set((s) => {
        const src = s.activeFrameInstanceId
          ? s.scene.frameInstances.find((fi) => fi.id === s.activeFrameInstanceId)
          : s.scene.frameInstances[s.scene.frameInstances.length - 1];
        const base = src
          ? { frame: src.frame, layerId: src.layerId, scale: src.scale, material: src.material, orientation: src.orientation }
          : { frame: s.scene.frame, layerId: s.activeLayerId, scale: 1, material: s.scene.frameMaterial, orientation: undefined };
        let layers = s.scene.layers;
        let layerId = base.layerId;
        if (layerId) {
          const srcLayer = layers.find((l) => l.id === layerId);
          if (srcLayer) {
            const clone = { ...srcLayer, id: nextLayerId() };
            layers = [...layers, clone];
            layerId = clone.id;
          }
        }
        const copy: FrameInstance = {
          id: nextFrameInstanceId(),
          frame: base.frame,
          x: Math.min(1, (src?.x ?? 0.5) + 0.08),
          y: Math.min(1, (src?.y ?? 0.5) + 0.08),
          scale: base.scale,
          layerId,
          orientation: base.orientation,
          material: base.material
        };
        return pushHistory(s, { ...s.scene, layers, frameInstances: [...s.scene.frameInstances, copy] });
      }),
    duplicateFrameInstance: (id) =>
      set((s) => {
        const inst = s.scene.frameInstances.find((fi) => fi.id === id);
        if (!inst) return {};
        // Clone the referenced layer so the copy is independent — sharing the
        // layer would couple media/zoom edits between the two frames.
        let layers = s.scene.layers;
        let layerId = inst.layerId;
        if (layerId) {
          const src = layers.find((l) => l.id === layerId);
          if (src) {
            const clone = { ...src, id: nextLayerId() };
            layers = [...layers, clone];
            layerId = clone.id;
          }
        }
        const copy: FrameInstance = {
          ...inst,
          id: nextFrameInstanceId(),
          layerId,
          x: Math.min(1, inst.x + 0.08),
          y: Math.min(1, inst.y + 0.08)
        };
        return pushHistory(s, { ...s.scene, layers, frameInstances: [...s.scene.frameInstances, copy] });
      }),
    reorderFrameInstance: (id, to) =>
      set((s) => {
        const idx = s.scene.frameInstances.findIndex((fi) => fi.id === id);
        if (idx < 0) return {};
        const frameInstances = [...s.scene.frameInstances];
        const [item] = frameInstances.splice(idx, 1);
        if (!item) return {};
        if (to === "front") frameInstances.push(item);
        else frameInstances.unshift(item);
        return pushHistory(s, { ...s.scene, frameInstances });
      }),
    layoutFrameGrid: (frame: MockupFrame, count: number, direction: "horizontal" | "vertical") =>
      set((s) => {
        const instances = layoutFrameGrid(frame, count, direction, s.scene.aspectRatio, s.scene.customFrame);
        const { layers, frameInstances, activeLayerId } = materializeLayout(instances, s.scene, s.activeLayerId);
        return { ...pushHistory(s, { ...s.scene, layers, frameInstances }), activeLayerId };
      }),
    applyFrameLayout: (frame: MockupFrame, count: number, layout: import("@/lib/types/editor").LayoutPreset) =>
      set((s) => {
        const instances = buildAutoLayout(frame, count, layout, s.scene.aspectRatio, s.scene.customFrame);
        const { layers, frameInstances, activeLayerId } = materializeLayout(instances, s.scene, s.activeLayerId);
        return { ...pushHistory(s, { ...s.scene, layers, frameInstances }), activeLayerId };
      }),
    alignFrameInstances: (mode: FrameAlignMode) =>
      set((s) => {
        if (s.scene.frameInstances.length < 2) return {};
        const frameInstances = alignFrameInstances(s.scene.frameInstances, mode, s.scene.aspectRatio, s.scene.customFrame);
        return pushHistory(s, { ...s.scene, frameInstances });
      }),
    distributeFrameInstances: (axis: "horizontal" | "vertical") =>
      set((s) => {
        if (s.scene.frameInstances.length < 3) return {};
        const frameInstances = distributeFrameInstances(s.scene.frameInstances, axis, s.scene.aspectRatio, s.scene.customFrame);
        return pushHistory(s, { ...s.scene, frameInstances });
      }),
    selectFrameInstance: (id) => set({ activeFrameInstanceId: id }),
    setFrameMaterial: (material) =>
      set((s) => {
        const nextScene: EditorScene = { ...s.scene, frameMaterial: material };
        if (nextScene.frameInstances.length > 0) {
          const targetId = s.activeFrameInstanceId;
          nextScene.frameInstances = nextScene.frameInstances.map((inst) =>
            !targetId || inst.id === targetId ? { ...inst, material } : inst
          );
        }
        return pushHistory(s, nextScene);
      })
  };
}
