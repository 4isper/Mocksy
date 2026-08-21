import { useTranslations } from "next-intl";
import type { Command, EditorScene, MediaType, MockupFrame, PatternId, Project, StylePreset, AnimationPreset, AnnotationType } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";
import { createFileCommands } from "./fileCommands";
import { createEditCommands } from "./editCommands";
import { createFrameCommands } from "./frameCommands";
import { createStyleCommands } from "./styleCommands";
import { createBackgroundCommands } from "./backgroundCommands";
import { createAspectRatioCommands } from "./aspectRatioCommands";
import { createLayerCommands } from "./layerCommands";
import { createAnnotationCommands } from "./annotationCommands";
import { createWatermarkCommands } from "./watermarkCommands";
import { createExportScaleCommands } from "./exportScaleCommands";
import { createThemeCommands } from "./themeCommands";
import { createProjectCommands } from "./projectCommands";
import { createViewCommands } from "./viewCommands";

export { createFileCommands } from "./fileCommands";
export { createEditCommands } from "./editCommands";
export { createFrameCommands } from "./frameCommands";
export { createStyleCommands } from "./styleCommands";
export { createBackgroundCommands } from "./backgroundCommands";
export { createAspectRatioCommands } from "./aspectRatioCommands";
export { createLayerCommands } from "./layerCommands";
export { createAnnotationCommands } from "./annotationCommands";
export { createWatermarkCommands } from "./watermarkCommands";
export { createExportScaleCommands } from "./exportScaleCommands";
export { createThemeCommands } from "./themeCommands";
export { createProjectCommands } from "./projectCommands";
export { createViewCommands } from "./viewCommands";

export function createCommands(
  t: ReturnType<typeof useTranslations>,
  scene: EditorScene,
  activeLayerId: string | null,
  undo: () => void,
  redo: () => void,
  pastLength: number,
  futureLength: number,
  resetScene: () => void,
  setFrame: (frame: MockupFrame) => void,
  setStylePreset: (preset: StylePreset) => void,
  setAnimationPreset: (preset: AnimationPreset) => void,
  setBackgroundSolid: (color: string) => void,
  setBackgroundGradient: (from: string, to: string) => void,
  setBackgroundPattern: (patternId: PatternId) => void,
  setBackgroundTransparent: () => void,
  setBackgroundImage: (url: string) => void,
  setAspectRatio: (ratio: string) => void,
  addLayer: (url: string, type: MediaType, name?: string | null) => void,
  duplicateLayer: (id: string) => void,
  removeLayer: (id: string) => void,
  toggleLayerHidden: (id: string) => void,
  selectLayer: (id: string) => void,
  reorderLayers: (ids: string[]) => void,
  addAnnotation: (type: AnnotationType) => void,
  clearAnnotations: () => void,
  toggleWatermark: (enabled: boolean) => void,
  setExportScale: (scale: 1 | 2 | 4) => void,
  exportScale: 1 | 2 | 4,
  activeProjectId: string | null,
  projects: Project[],
  switchProject: (id: string) => void,
  themeMode: "light" | "dark" | "system",
  setThemeMode: (mode: "light" | "dark" | "system") => void,
  onExportPng: () => void,
  onExportWebp: () => void,
  onExportSvg: () => void,
  onExportHtml: () => void,
  onExportPdf: () => void,
  onExportMp4: () => void,
  onExportWebm: () => void,
  onExportGif: () => void,
  onExportWebpAnim: () => void,
  onCopyPng: () => void,
  onCopyShareUrl: () => void,
  onSave: () => void,
  toggleFullscreenPreview: () => void,
): Command[] {
  return [
    ...createFileCommands(t, { onExportPng, onExportWebp, onExportSvg, onExportHtml, onExportPdf, onExportMp4, onExportWebm, onExportGif, onExportWebpAnim, onCopyPng, onCopyShareUrl, onSave }),
    ...createEditCommands(t, { undo, redo, pastLength, futureLength, resetScene }),
    ...createFrameCommands(t, { setFrame }),
    ...createStyleCommands(t),
    ...createBackgroundCommands(t, { setBackgroundSolid, setBackgroundGradient, setBackgroundPattern, setBackgroundTransparent }),
    ...createAspectRatioCommands(t, { setAspectRatio }),
    ...createLayerCommands(t, scene, { addLayer, duplicateLayer, removeLayer, toggleLayerHidden, selectLayer }, activeLayerId),
    ...createAnnotationCommands(t, scene, { addAnnotation, clearAnnotations }),
    ...createWatermarkCommands(t, scene, { toggleWatermark }),
    ...createExportScaleCommands(t, { setExportScale }),
    ...createThemeCommands(t, { setThemeMode }),
    ...createViewCommands(t, { toggleFullscreenPreview }),
    ...createProjectCommands(t, projects, activeProjectId, { switchProject }),
  ];
}