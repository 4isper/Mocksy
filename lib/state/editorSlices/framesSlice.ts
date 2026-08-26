import { activeLayer, alignFrameInstances, buildAutoLayout, distributeFrameInstances, layoutFrameGrid, makeDemoLayer, nextLayerId, pushHistory } from "@/lib/state/editorHelpers";
import { nextFrameInstanceId } from "@/lib/state/ids";
import type { CustomFrame, EditorScene, FrameInstance, MockupFrame } from "@/lib/types/editor";
import type { FrameAlignMode } from "@/lib/state/frameAlign";
import { clampFramePositions, targetFrameInstances } from "@/lib/state/frameAlign";
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
  | "reorderFrameInstances"
  | "layoutFrameGrid"
  | "applyFrameLayout"
  | "alignFrameInstances"
  | "distributeFrameInstances"
  | "selectFrameInstance"
  | "selectFrameIds"
  | "toggleFrameSelected"
>;

/**
 * Lays out the scene's EXISTING frame instances (preserving each one's frame
 * type, bound layer and media) onto the positions computed by a layout
 * algorithm. Instances beyond `count` are dropped, and if the layout needs more
 * slots than the scene has instances, the surplus frames are added by reusing
 * existing layers round-robin (never cloning a single layer N times, so no
 * picture is duplicated) or, when there are no layers at all, cloning the
 * active/demo layer. This is why applying a layout never wipes a user's
 * uploaded images or silently drops a distinct frame such as "none".
 */
function applyLayoutPositions(
  positions: FrameInstance[],
  scene: EditorScene,
  activeLayerId: string | null
): { layers: EditorScene["layers"]; frameInstances: FrameInstance[]; activeLayerId: string | null } {
  const existing = scene.frameInstances;
  const existingIds = scene.layers.map((l) => l.id);
  const activeLayerData = activeLayer(scene, activeLayerId);
  const newLayers: EditorScene["layers"] = [];
  const frameInstances = positions.map((pos, i) => {
    const keep = existing[i];
    if (keep) {
      // Preserve the user's frame type, layer binding and media; only move it.
      return { ...keep, x: pos.x, y: pos.y, scale: pos.scale };
    }
    // Extra slot: bind to an existing layer round-robin, else clone a new one.
    const cycleIndex = i % Math.max(1, existingIds.length);
    const reuseId = existingIds.length > 0 ? existingIds[cycleIndex] : undefined;
    if (reuseId) return { ...pos, id: nextFrameInstanceId(), layerId: reuseId };
    const clone = {
      ...(activeLayerData ?? makeDemoLayer()),
      id: nextLayerId(),
      hidden: false,
      animationPreset: "none" as const
    };
    newLayers.push(clone);
    return { ...pos, id: nextFrameInstanceId(), layerId: clone.id };
  });
  const layers = [...scene.layers, ...newLayers];
  return {
    layers,
    frameInstances,
    activeLayerId: frameInstances[0]?.layerId ?? activeLayerId
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
    reorderFrameInstances: (orderedIds) =>
      set((s) => {
        const byId = new Map(s.scene.frameInstances.map((fi) => [fi.id, fi]));
        const reordered = orderedIds.map((id) => byId.get(id)).filter((fi): fi is (typeof s.scene.frameInstances)[number] => Boolean(fi));
        // Ignore invalid input that doesn't cover every existing instance.
        if (reordered.length !== s.scene.frameInstances.length) return {};
        return pushHistory(s, { ...s.scene, frameInstances: reordered });
      }),
    layoutFrameGrid: (frame: MockupFrame, count: number, direction: "horizontal" | "vertical") =>
      set((s) => {
        const positions = layoutFrameGrid(frame, count, direction, s.scene.aspectRatio, s.scene.customFrame);
        const { layers, frameInstances, activeLayerId } = applyLayoutPositions(positions, s.scene, s.activeLayerId);
        // Selecting the laid-out frames lets the user immediately align/distribute.
        return { ...pushHistory(s, { ...s.scene, layers, frameInstances }), activeLayerId, activeFrameInstanceId: frameInstances[0]?.id ?? null, selectedFrameIds: frameInstances.map((i) => i.id) };
      }),
    applyFrameLayout: (frame: MockupFrame, count: number, layout: import("@/lib/types/editor").LayoutPreset) =>
      set((s) => {
        const positions = buildAutoLayout(frame, count, layout, s.scene.aspectRatio, s.scene.customFrame);
        const { layers, frameInstances, activeLayerId } = applyLayoutPositions(positions, s.scene, s.activeLayerId);
        return { ...pushHistory(s, { ...s.scene, layers, frameInstances }), activeLayerId, activeFrameInstanceId: frameInstances[0]?.id ?? null, selectedFrameIds: frameInstances.map((i) => i.id) };
      }),
    alignFrameInstances: (mode: FrameAlignMode) =>
      set((s) => {
        if (s.scene.frameInstances.length < 2) return {};
        const target = targetFrameInstances(s.scene.frameInstances, s.selectedFrameIds);
        if (target.length < 2) return {};
        const aligned = alignFrameInstances(target, mode, s.scene.aspectRatio, s.scene.customFrame);
        const byId = new Map(aligned.map((i) => [i.id, i]));
        const frameInstances = clampFramePositions(
          s.scene.frameInstances.map((i) => byId.get(i.id) ?? i),
          s.scene.aspectRatio,
          s.scene.customFrame
        );
        return pushHistory(s, { ...s.scene, frameInstances });
      }),
    distributeFrameInstances: (axis: "horizontal" | "vertical") =>
      set((s) => {
        if (s.scene.frameInstances.length < 3) return {};
        const target = targetFrameInstances(s.scene.frameInstances, s.selectedFrameIds);
        if (target.length < 3) return {};
        const distributed = distributeFrameInstances(target, axis, s.scene.aspectRatio, s.scene.customFrame);
        const byId = new Map(distributed.map((i) => [i.id, i]));
        const frameInstances = clampFramePositions(
          s.scene.frameInstances.map((i) => byId.get(i.id) ?? i),
          s.scene.aspectRatio,
          s.scene.customFrame
        );
        return pushHistory(s, { ...s.scene, frameInstances });
      }),
    selectFrameInstance: (id) =>
      set(id == null ? { activeFrameInstanceId: null, selectedFrameIds: [] } : { activeFrameInstanceId: id, selectedFrameIds: [id] }),
    selectFrameIds: (ids) => set(() => ({ activeFrameInstanceId: ids[0] ?? null, selectedFrameIds: [...ids] })),
    toggleFrameSelected: (id) =>
      set((s) => {
        const exists = s.selectedFrameIds.includes(id);
        const next = exists ? s.selectedFrameIds.filter((x) => x !== id) : [...s.selectedFrameIds, id];
        return { activeFrameInstanceId: id, selectedFrameIds: next.length > 0 ? next : [id] };
      }),
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
