import { activePosterTime, pushHistory } from "@/lib/state/editorHelpers";
import { buildFreshScene } from "@/lib/state/editorScene";
import type { EditorStoreSetter, EditorStoreState } from "../editorStoreTypes";

export type SceneSlice = Pick<
  EditorStoreState,
  | "setScene"
  | "resetScene"
  | "undo"
  | "redo"
  | "setMediaLoading"
  | "setScenePalette"
  | "setExportScale"
  | "setCustomExportSize"
  | "setShowGrid"
  | "setGridDivisions"
  | "setVideoCurrentTime"
>;

/** History, scene replacement, and the UI-only state setters that must never
 *  touch the undo stack or serialize into share URLs. */
export function createSceneSlice(set: EditorStoreSetter): SceneSlice {
  return {
    setScene: (scene, recordHistory = true) =>
      set((s) => {
        const next = { ...s.scene, ...scene };
        if (!recordHistory) return { scene: next };
        return pushHistory(s, next);
      }),
    resetScene: () =>
      set((s) => pushHistory(s, buildFreshScene())),
    undo: () =>
      set((s) => {
        if (s.past.length === 0) return {};
        const previous = s.past[s.past.length - 1];
        // Playback position lives outside the scene, so re-sync it to the
        // restored scene's poster time instead of leaving the timeline slider
        // pointing at a moment that no longer matches the video.
        return { scene: previous, past: s.past.slice(0, -1), future: [s.scene, ...s.future], videoCurrentTime: activePosterTime(previous ?? s.scene) };
      }),
    redo: () =>
      set((s) => {
        if (s.future.length === 0) return {};
        const next = s.future[0];
        return { scene: next, past: [...s.past, s.scene], future: s.future.slice(1), videoCurrentTime: activePosterTime(next ?? s.scene) };
      }),
    setMediaLoading: (loading) => set({ isMediaLoading: loading }),
    setScenePalette: (palette) => set({ scenePalette: palette }),
    setExportScale: (exportScale) => set({ exportScale }),
    setCustomExportSize: (customExportSize) => set({ customExportSize }),
    setShowGrid: (showGrid) => set({ showGrid }),
    setGridDivisions: (gridDivisions) => set({ gridDivisions }),
    setVideoCurrentTime: (videoCurrentTime) => set({ videoCurrentTime })
  };
}
