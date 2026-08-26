import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { useThemeStore } from "@/lib/state/themeStore";
import { createCommands } from "@/lib/commands/commandFactories";
import type { Command } from "@/lib/types/editor";

export function useCommands(
  onExportPng: () => void,
  onExportJpeg: () => void,
  onExportWebp: () => void,
  onExportSvg: () => void,
  onExportHtml: () => void,
  onExportPdf: () => void,
  onExportMp4: () => void,
  onExportWebm: () => void,
  onExportGif: () => void,
  onExportWebpAnim: () => void,
  onExportZipVideo: () => void,
  onCopyPng: () => void,
  onCopySvg: () => void,
  onCopyHtml: () => void,
  onCopyShareUrl: () => void,
  onSave: () => void,
  onToggleFullscreenPreview: () => void
): Command[] {
  const t = useTranslations();
  const scene = useEditorStore(s => s.scene);
  const activeLayerId = useEditorStore(s => s.activeLayerId);
  const undo = useEditorStore(s => s.undo);
  const redo = useEditorStore(s => s.redo);
  const pastLength = useEditorStore(s => s.past.length);
  const futureLength = useEditorStore(s => s.future.length);
  const resetScene = useEditorStore(s => s.resetScene);
  const setFrame = useEditorStore(s => s.setFrame);
  const setStylePreset = useEditorStore(s => s.setStylePreset);
  const setAnimationPreset = useEditorStore(s => s.setAnimationPreset);
  const setBackgroundSolid = useEditorStore(s => s.setBackgroundSolid);
  const setBackgroundGradient = useEditorStore(s => s.setBackgroundGradient);
  const setBackgroundPattern = useEditorStore(s => s.setBackgroundPattern);
  const setBackgroundTransparent = useEditorStore(s => s.setBackgroundTransparent);
  const setBackgroundImage = useEditorStore(s => s.setBackgroundImage);
  const setAspectRatio = useEditorStore(s => s.setAspectRatio);
  const addLayer = useEditorStore(s => s.addLayer);
  const addTextLayer = useEditorStore(s => s.addTextLayer);
  const duplicateLayer = useEditorStore(s => s.duplicateLayer);
  const removeLayer = useEditorStore(s => s.removeLayer);
  const toggleLayerHidden = useEditorStore(s => s.toggleLayerHidden);
  const selectLayer = useEditorStore(s => s.selectLayer);
  const reorderLayers = useEditorStore(s => s.reorderLayers);
  const addAnnotation = useEditorStore(s => s.addAnnotation);
  const clearAnnotations = useEditorStore(s => s.clearAnnotations);
  const toggleWatermark = useEditorStore(s => s.toggleWatermark);
  const setExportScale = useEditorStore(s => s.setExportScale);
  const exportScale = useEditorStore(s => s.exportScale);

  const activeProjectId = useProjectsStore(s => s.activeProjectId);
  const projects = useProjectsStore(s => s.projects);
  const switchProject = useProjectsStore(s => s.switchProject);

  const themeMode = useThemeStore(s => s.mode);
  const setThemeMode = useThemeStore(s => s.setMode);

  return useMemo(() => createCommands(
    t, scene, activeLayerId, undo, redo, pastLength, futureLength, resetScene,
    setFrame, setStylePreset, setAnimationPreset,
    setBackgroundSolid, setBackgroundGradient, setBackgroundPattern, setBackgroundTransparent, setBackgroundImage,
    setAspectRatio, addLayer, addTextLayer, duplicateLayer, removeLayer, toggleLayerHidden,
    selectLayer, reorderLayers, addAnnotation, clearAnnotations,
    toggleWatermark, setExportScale, exportScale,
    activeProjectId, projects, switchProject,
    themeMode, setThemeMode,
    onExportPng, onExportJpeg, onExportWebp, onExportSvg, onExportHtml, onExportPdf, onExportMp4, onExportWebm, onExportGif, onExportWebpAnim, onExportZipVideo,
    onCopyPng, onCopySvg, onCopyHtml, onCopyShareUrl, onSave, onToggleFullscreenPreview
  ), [
    t, scene, activeLayerId, pastLength, futureLength, activeProjectId, projects, themeMode, exportScale,
    onExportPng, onExportJpeg, onExportWebp, onExportSvg, onExportHtml, onExportPdf, onExportMp4, onExportWebm, onExportGif, onExportWebpAnim, onExportZipVideo,
    onCopyPng, onCopySvg, onCopyHtml, onCopyShareUrl, onSave, onToggleFullscreenPreview,
    undo, redo, resetScene,
    setFrame, setStylePreset, setAnimationPreset,
    setBackgroundSolid, setBackgroundGradient, setBackgroundPattern, setBackgroundTransparent, setBackgroundImage,
    setAspectRatio, addLayer, addTextLayer, duplicateLayer, removeLayer, toggleLayerHidden,
    selectLayer, reorderLayers, addAnnotation, clearAnnotations,
    toggleWatermark, setExportScale, switchProject, setThemeMode
  ]);
}
