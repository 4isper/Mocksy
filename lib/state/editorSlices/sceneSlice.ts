import { activePosterTime, pushHistory } from "@/lib/state/editorHelpers";
import { buildFreshScene } from "@/lib/state/editorScene";
import type { EditorScene } from "@/lib/types/editor";
import type { EditorStoreSetter, EditorStoreState } from "../editorStoreTypes";

let mediaErrorTimer: ReturnType<typeof setTimeout> | null = null;

export type SceneSlice = Pick<
  EditorStoreState,
  | "setScene"
  | "resetScene"
  | "undo"
  | "redo"
  | "setMediaLoading"
  | "setRemovingBackground"
  | "setMediaUploadError"
  | "setScenePalette"
  | "setExportScale"
  | "setCustomExportSize"
  | "setShowGrid"
  | "setGridDivisions"
  | "setVideoCurrentTime"
>;

/** Keeps the live layer selection valid after a scene is replaced: if the
 *  current selection still exists in the new scene it's preserved (so undo of
 *  an edit doesn't reset the selection), otherwise fall back to the scene's
 *  persisted snapshot, then to the first layer. */
function reconcileActiveLayerId(scene: EditorScene, current: string | null): string | null {
  if (current && scene.layers.some((l) => l.id === current)) return current;
  return scene.activeLayerId ?? scene.layers[0]?.id ?? null;
}

/** History, scene replacement, and the UI-only state setters that must never
 *  touch the undo stack or serialize into share URLs. */
export function createSceneSlice(set: EditorStoreSetter): SceneSlice {
  return {
    setScene: (scene, recordHistory = true) =>
      set((s) => {
        const next = { ...s.scene, ...scene };
        const activeLayerId = reconcileActiveLayerId(next, s.activeLayerId);
        if (!recordHistory) return { scene: next, activeLayerId };
        return { ...pushHistory(s, next), activeLayerId };
      }),
    resetScene: () =>
      set((s) => {
        const fresh = buildFreshScene();
        return { ...pushHistory(s, fresh), activeLayerId: reconcileActiveLayerId(fresh, s.activeLayerId) };
      }),
    undo: () =>
      set((s) => {
        if (s.past.length === 0) return {};
        const previous = s.past[s.past.length - 1];
        // Playback position lives outside the scene, so re-sync it to the
        // restored scene's poster time instead of leaving the timeline slider
        // pointing at a moment that no longer matches the video.
        return {
          scene: previous,
          past: s.past.slice(0, -1),
          future: [s.scene, ...s.future],
          videoCurrentTime: activePosterTime(previous ?? s.scene),
          activeLayerId: reconcileActiveLayerId(previous ?? s.scene, s.activeLayerId)
        };
      }),
    redo: () =>
      set((s) => {
        if (s.future.length === 0) return {};
        const next = s.future[0];
        return {
          scene: next,
          past: [...s.past, s.scene],
          future: s.future.slice(1),
          videoCurrentTime: activePosterTime(next ?? s.scene),
          activeLayerId: reconcileActiveLayerId(next ?? s.scene, s.activeLayerId)
        };
      }),
    setMediaLoading: (loading) => set({ isMediaLoading: loading }),
    setRemovingBackground: (loading) => set({ isRemovingBackground: loading }),
    setMediaUploadError: (msg) => {
      // Auto-clear the shared error so it doesn't linger until the next action,
      // matching the previous per-component auto-dismiss behaviour.
      if (mediaErrorTimer) clearTimeout(mediaErrorTimer);
      if (msg) {
        mediaErrorTimer = setTimeout(() => {
          mediaErrorTimer = null;
          set({ mediaUploadError: null });
        }, 4000);
      }
      set({ mediaUploadError: msg });
    },
    setScenePalette: (palette) => set({ scenePalette: palette }),
    setExportScale: (exportScale) => set({ exportScale }),
    setCustomExportSize: (customExportSize) => set({ customExportSize }),
    setShowGrid: (showGrid) => set({ showGrid }),
    setGridDivisions: (gridDivisions) => set({ gridDivisions }),
    setVideoCurrentTime: (videoCurrentTime) => set({ videoCurrentTime })
  };
}
