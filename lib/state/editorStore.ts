"use client";

import { create } from "zustand";
import { DEFAULT_GRID_DIVISIONS } from "@/lib/render/grid";
import { initialScene } from "@/lib/state/editorScene";
import { createAppearanceSlice } from "@/lib/state/editorSlices/appearanceSlice";
import { createFramesSlice } from "@/lib/state/editorSlices/framesSlice";
import { createLayersSlice } from "@/lib/state/editorSlices/layersSlice";
import { createSceneSlice } from "@/lib/state/editorSlices/sceneSlice";
import type { EditorStoreState } from "@/lib/state/editorStoreTypes";

export type { EditorStoreState } from "@/lib/state/editorStoreTypes";
export { initialScene, makeDemoScene } from "@/lib/state/editorScene";

/**
 * The single editor store, assembled from domain slices. All scene mutations
 * record undo history via pushHistory; UI-only state (selection, grid, export
 * scale, playback position, palette) lives outside `scene` so it never churns
 * history or leaks into share URLs.
 */
export const useEditorStore = create<EditorStoreState>()((set) => ({
  scene: initialScene,
  past: [],
  future: [],
  videoCurrentTime: 0,
  selectedAnnotationId: null,
  selectedAnnotationIds: [],
  activeLayerId: initialScene.activeLayerId ?? null,
  activeFrameInstanceId: null,
  selectedLayerIds: [],
  lastHistoryKey: null,
  lastHistoryAt: 0,
  isMediaLoading: false,
  isRemovingBackground: false,
  mediaUploadError: null,
  scenePalette: null,
  exportScale: 2,
  customExportSize: null,
  showGrid: false,
  gridDivisions: DEFAULT_GRID_DIVISIONS,
  previewZoom: "fit",
  fullscreenPreview: false,
  onboardingOpen: false,
  ...createSceneSlice(set),
  ...createLayersSlice(set),
  ...createFramesSlice(set),
  ...createAppearanceSlice(set)
}));
