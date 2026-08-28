import { activePosterTime, pushHistory } from "@/lib/state/editorHelpers";
import { buildFreshScene } from "@/lib/state/editorScene";
import type { EditorScene } from "@/lib/types/editor";
import type { EditorStoreSetter, EditorStoreState } from "../editorStoreTypes";

let mediaErrorTimer: ReturnType<typeof setTimeout> | null = null;

export type SceneSlice = Pick<
  EditorStoreState,
  | "setScene"
  | "resetScene"
  | "clearHistory"
  | "undo"
  | "redo"
  | "jumpToHistory"
  | "setMediaLoading"
  | "setRemovingBackground"
  | "setMediaUploadError"
  | "setScenePalette"
  | "setExportScale"
  | "setCustomExportSize"
  | "setShowGrid"
  | "setGridDivisions"
  | "setPreviewZoom"
  | "setPreviewPan"
  | "resetPreviewView"
  | "setFullscreenPreview"
  | "setOnboardingOpen"
  | "setRightTab"
  | "setMobileSheet"
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
    clearHistory: () =>
      set(() => {
        // Reset the coalescing keys too: an edit right after the reset must
        // start a fresh entry instead of merging into a stale one whose
        // snapshot predates the scene replacement.
        return { past: [], future: [], lastHistoryKey: null, lastHistoryAt: 0 };
      }),
    undo: () =>
      set((s) => {
        if (s.past.length === 0) return {};
        const previous = s.past[s.past.length - 1];
        // Playback position lives outside the scene, so re-sync it to the
        // restored scene's poster time instead of leaving the timeline slider
        // pointing at a moment that no longer matches the video. Must use the
        // reconciled selection (not the scene snapshot) so the scrubber tracks
        // whichever layer stays active after the undo.
        const activeLayerId = reconcileActiveLayerId(previous ?? s.scene, s.activeLayerId);
        return {
          scene: previous,
          past: s.past.slice(0, -1),
          future: [s.scene, ...s.future],
          // Reset the coalescing key so an edit of the same field right after
          // the undo starts a fresh history entry instead of silently merging
          // into the just-undone one.
          lastHistoryKey: null,
          lastHistoryAt: 0,
          videoCurrentTime: activePosterTime(previous ?? s.scene, activeLayerId),
          activeLayerId
        };
      }),
    redo: () =>
      set((s) => {
        if (s.future.length === 0) return {};
        const next = s.future[0];
        const activeLayerId = reconcileActiveLayerId(next ?? s.scene, s.activeLayerId);
        return {
          scene: next,
          past: [...s.past, s.scene],
          future: s.future.slice(1),
          lastHistoryKey: null,
          lastHistoryAt: 0,
          videoCurrentTime: activePosterTime(next ?? s.scene, activeLayerId),
          activeLayerId
        };
      }),
    jumpToHistory: (index) =>
      set((s) => {
        const target = Math.max(0, Math.min(s.past.length + s.future.length, index));
        if (target === s.past.length) return {};
        const states = [...s.past, s.scene, ...s.future];
        const nextScene = states[target] ?? s.scene;
        return {
          scene: nextScene,
          past: states.slice(0, target),
          future: states.slice(target + 1),
          lastHistoryKey: null,
          lastHistoryAt: 0,
          videoCurrentTime: activePosterTime(nextScene),
          activeLayerId: reconcileActiveLayerId(nextScene, s.activeLayerId)
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
    setPreviewZoom: (previewZoom) => set({ previewZoom }),
    setPreviewPan: (previewPan) => set({ previewPan }),
    resetPreviewView: () => set({ previewZoom: "fit", previewPan: { x: 0, y: 0 } }),
    setFullscreenPreview: (fullscreenPreview) => set({ fullscreenPreview }),
    setOnboardingOpen: (onboardingOpen) => set({ onboardingOpen }),
    setRightTab: (rightTab) => set({ rightTab }),
    setMobileSheet: (mobileSheet) => set({ mobileSheet }),
    setVideoCurrentTime: (videoCurrentTime) => set({ videoCurrentTime })
  };
}
