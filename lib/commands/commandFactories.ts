import { useTranslations } from "next-intl";
import type {
  AnnotationType,
  Command,
  EditorScene,
  MediaType,
  MockupFrame,
  Project,
  StylePreset,
  AnimationPreset,
} from "@/lib/types/editor";
import { FRAME_ORDER, FRAME_SPECS, ASPECT_RATIOS } from "@/lib/render/frames";
import { sceneStylePresets, applySceneStylePreset, backgroundPresets } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";

// --- File / Project commands ---

export function createFileCommands(
  t: (key: string, values?: Record<string, any>) => string,
  callbacks: {
    onExportPng: () => void;
    onExportWebp: () => void;
    onExportSvg: () => void;
    onExportHtml: () => void;
    onExportMp4: () => void;
    onExportWebm: () => void;
    onExportGif: () => void;
    onExportWebpAnim: () => void;
    onCopyPng: () => void;
    onCopyShareUrl: () => void;
    onSave: () => void;
  }
): Command[] {
  const { onExportPng, onExportWebp, onExportSvg, onExportHtml, onExportMp4, onExportWebm, onExportGif, onExportWebpAnim, onCopyPng, onCopyShareUrl, onSave } = callbacks;
  return [
    {
      id: "new-project",
      label: t("commandPalette.newProject"),
      description: t("commandPalette.newProjectDesc"),
      shortcut: "⌘N",
      keywords: ["new", "create", "fresh", "start"],
      action: () => {
        const newProjectId = useProjectsStore.getState().createProject("Untitled");
        useProjectsStore.getState().switchProject(newProjectId);
      },
    },
    {
      id: "save-project",
      label: t("commandPalette.saveProject"),
      description: t("commandPalette.saveProjectDesc"),
      shortcut: "⌘S",
      keywords: ["save", "store", "persist"],
      action: onSave,
    },
    {
      id: "export-png",
      label: t("commandPalette.exportPng"),
      description: t("commandPalette.exportPngDesc"),
      shortcut: "⌘E",
      keywords: ["export", "png", "image", "download", "picture"],
      action: onExportPng,
    },
    {
      id: "export-mp4",
      label: t("commandPalette.exportMp4"),
      description: t("commandPalette.exportMp4Desc"),
      shortcut: "⇧⌘E",
      keywords: ["export", "mp4", "video", "movie", "animation"],
      action: onExportMp4,
    },
    {
      id: "export-webm",
      label: t("commandPalette.exportWebm"),
      description: t("commandPalette.exportWebmDesc"),
      keywords: ["export", "webm", "video", "movie", "animation"],
      action: onExportWebm,
    },
    {
      id: "export-webp",
      label: t("commandPalette.exportWebp"),
      description: t("commandPalette.exportWebpDesc"),
      keywords: ["export", "webp", "image", "download", "picture"],
      action: onExportWebp,
    },
    {
      id: "export-webp-anim",
      label: t("commandPalette.exportWebpAnim"),
      description: t("commandPalette.exportWebpAnimDesc"),
      keywords: ["export", "webp", "animation", "animated"],
      action: onExportWebpAnim,
    },
    {
      id: "export-svg",
      label: t("commandPalette.exportSvg"),
      description: t("commandPalette.exportSvgDesc"),
      keywords: ["export", "svg", "vector", "figma", "illustrator"],
      action: onExportSvg,
    },
    {
      id: "export-html",
      label: t("commandPalette.exportHtml"),
      description: t("commandPalette.exportHtmlDesc"),
      keywords: ["export", "html", "snippet", "embed", "web"],
      action: onExportHtml,
    },
    {
      id: "export-gif",
      label: t("commandPalette.exportGif"),
      description: t("commandPalette.exportGifDesc"),
      shortcut: "⇧⌘G",
      keywords: ["export", "gif", "animation", "animated"],
      action: onExportGif,
    },
    {
      id: "copy-png",
      label: t("commandPalette.copyPng"),
      description: t("commandPalette.copyPngDesc"),
      shortcut: "⇧⌘C",
      keywords: ["copy", "clipboard", "png", "image"],
      action: onCopyPng,
    },
    {
      id: "copy-share-url",
      label: t("commandPalette.copyShareUrl"),
      description: t("commandPalette.copyShareUrlDesc"),
      shortcut: "⌘L",
      keywords: ["copy", "share", "url", "link"],
      action: onCopyShareUrl,
    },
  ];
}

// --- Edit commands ---

export function createEditCommands(
  t: (key: string, values?: Record<string, any>) => string,
  callbacks: {
    undo: () => void;
    redo: () => void;
    pastLength: number;
    futureLength: number;
    resetScene: () => void;
  }
): Command[] {
  const { undo, redo, pastLength, futureLength, resetScene } = callbacks;
  return [
    {
      id: "undo",
      label: t("commandPalette.undo"),
      description: t("commandPalette.undoDesc"),
      shortcut: "⌘Z",
      keywords: ["undo", "back", "revert"],
      action: undo,
      disabled: pastLength === 0,
    },
    {
      id: "redo",
      label: t("commandPalette.redo"),
      description: t("commandPalette.redoDesc"),
      shortcut: "⇧⌘Z",
      keywords: ["redo", "forward", "repeat"],
      action: redo,
      disabled: futureLength === 0,
    },
    {
      id: "reset-scene",
      label: t("commandPalette.resetScene"),
      description: t("commandPalette.resetSceneDesc"),
      shortcut: "R",
      keywords: ["reset", "default", "clear", "restart"],
      action: resetScene,
    },
  ];
}

// --- Frame commands ---

export function createFrameCommands(
  t: (key: string, values?: Record<string, any>) => string,
  callbacks: {
    setFrame: (frame: MockupFrame) => void;
  }
): Command[] {
  const { setFrame } = callbacks;
  return FRAME_ORDER.map(frame => {
    const spec = FRAME_SPECS[frame];
    return {
      id: `frame-${frame}`,
      label: t("commandPalette.frameLabel", { name: frame.charAt(0).toUpperCase() + frame.slice(1) }),
      description: spec.isOverlay ? t("commandPalette.frameOverlayDesc") : t("commandPalette.frameCssDesc"),
      keywords: ["frame", "device", "mockup", frame],
      action: () => setFrame(frame),
    };
  });
}

// --- Style preset commands ---

export function createStyleCommands(
  t: (key: string, values?: Record<string, any>) => string,
): Command[] {
  return sceneStylePresets.map(preset => ({
    id: `preset-${preset.id}`,
    label: `Preset: ${preset.name}`,
    description: `${preset.frame} • ${preset.stylePreset} • ${preset.backgroundMode}`,
    keywords: ["preset", "style", "theme", "template", preset.name.toLowerCase()],
    action: () => {
      const scenePatch = applySceneStylePreset(preset);
      useEditorStore.getState().setScene(scenePatch);
    },
  }));
}

// --- Background commands ---

export function createBackgroundCommands(
  t: (key: string, values?: Record<string, any>) => string,
  callbacks: {
    setBackgroundSolid: (color: string) => void;
    setBackgroundGradient: (from: string, to: string) => void;
    setBackgroundTransparent: () => void;
  }
): Command[] {
  const { setBackgroundSolid, setBackgroundGradient, setBackgroundTransparent } = callbacks;
  return backgroundPresets.map(bg => ({
    id: `bg-${bg.id}`,
    label: t("commandPalette.backgroundLabel", { name: bg.name }),
    description: bg.kind === "gradient" ? `${bg.gradientFrom} → ${bg.gradientTo}` : bg.backgroundColor,
    keywords: ["background", "bg", "color", "gradient", "solid", bg.name.toLowerCase()],
    action: () => {
      if (bg.kind === "transparent") setBackgroundTransparent();
      else if (bg.kind === "solid") setBackgroundSolid(bg.backgroundColor!);
      else setBackgroundGradient(bg.gradientFrom!, bg.gradientTo!);
    },
  }));
}

// --- Aspect ratio commands ---

export function createAspectRatioCommands(
  t: (key: string, values?: Record<string, any>) => string,
  callbacks: {
    setAspectRatio: (ratio: string) => void;
  }
): Command[] {
  const { setAspectRatio } = callbacks;
  return ASPECT_RATIOS.map(ratio => ({
    id: `ratio-${ratio.replace(/\s/g, "-")}`,
    label: t("commandPalette.aspectRatioLabel", { ratio }),
    description: t("commandPalette.aspectRatioDesc", { ratio }),
    keywords: ["ratio", "aspect", "canvas", "size", ratio],
    action: () => setAspectRatio(ratio),
  }));
}

// --- Layer commands ---

export function createLayerCommands(
  t: (key: string, values?: Record<string, any>) => string,
  scene: EditorScene,
  callbacks: {
    addLayer: (url: string, type: MediaType, name?: string | null) => void;
    duplicateLayer: (id: string) => void;
    removeLayer: (id: string) => void;
    toggleLayerHidden: (id: string) => void;
    selectLayer: (id: string) => void;
  }
): Command[] {
  const { addLayer, duplicateLayer, removeLayer, toggleLayerHidden, selectLayer } = callbacks;
  const layers = scene.layers;
  const activeLayerId = scene.activeLayerId ?? layers[0]?.id;

  return [
    {
      id: "layer-add",
      label: t("commandPalette.addLayer"),
      description: t("commandPalette.addLayerDesc"),
      keywords: ["layer", "add", "new", "media", "image", "video"],
      action: () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/*";
        input.onchange = e => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            const type = file.type.startsWith("video/") ? "video" : "image";
            addLayer(url, type, file.name);
          }
        };
        input.click();
      },
    },
    {
      id: "layer-duplicate",
      label: t("commandPalette.duplicateLayer"),
      description: t("commandPalette.duplicateLayerDesc"),
      shortcut: "⌘D",
      keywords: ["layer", "duplicate", "clone", "copy"],
      action: () => {
        if (activeLayerId) duplicateLayer(activeLayerId);
      },
      disabled: !activeLayerId,
    },
    {
      id: "layer-remove",
      label: t("commandPalette.removeLayer"),
      description: t("commandPalette.removeLayerDesc"),
      keywords: ["layer", "remove", "delete", "trash"],
      action: () => {
        if (activeLayerId && layers.length > 1) removeLayer(activeLayerId);
      },
      disabled: !activeLayerId || layers.length <= 1,
    },
    {
      id: "layer-toggle-hidden",
      label: t("commandPalette.toggleLayerVisibility"),
      description: t("commandPalette.toggleLayerVisibilityDesc"),
      keywords: ["layer", "hide", "show", "visibility", "eye"],
      action: () => {
        if (activeLayerId) toggleLayerHidden(activeLayerId);
      },
      disabled: !activeLayerId,
    },
    ...layers.map(layer => ({
      id: `layer-select-${layer.id}`,
      label: t("commandPalette.selectLayer", { name: layer.mediaName || t("commandPalette.layerNumber", { n: layers.indexOf(layer) + 1 }) }),
      description: layer.hidden ? t("commandPalette.hidden") : t("commandPalette.clickToSelect"),
      keywords: ["layer", "select", "switch", layer.mediaName || ""],
      action: () => selectLayer(layer.id),
    })),
  ];
}

// --- Annotation commands ---

export function createAnnotationCommands(
  t: (key: string, values?: Record<string, any>) => string,
  scene: EditorScene,
  callbacks: {
    addAnnotation: (type: AnnotationType) => void;
    clearAnnotations: () => void;
  }
): Command[] {
  const { addAnnotation, clearAnnotations } = callbacks;
  return [
    {
      id: "anno-text",
      label: t("commandPalette.addTextAnnotation"),
      description: t("commandPalette.addTextAnnotationDesc"),
      keywords: ["annotation", "text", "label", "caption"],
      action: () => addAnnotation("text"),
    },
    {
      id: "anno-arrow",
      label: t("commandPalette.addArrowAnnotation"),
      description: t("commandPalette.addArrowAnnotationDesc"),
      keywords: ["annotation", "arrow", "pointer", "direction"],
      action: () => addAnnotation("arrow"),
    },
    {
      id: "anno-rect",
      label: t("commandPalette.addRectangleAnnotation"),
      description: t("commandPalette.addRectangleAnnotationDesc"),
      keywords: ["annotation", "rectangle", "box", "highlight", "shape"],
      action: () => addAnnotation("rect"),
    },
    {
      id: "anno-clear",
      label: t("commandPalette.clearAnnotations"),
      description: t("commandPalette.clearAnnotationsDesc"),
      keywords: ["annotation", "clear", "remove", "delete", "all"],
      action: clearAnnotations,
      disabled: scene.annotations.length === 0,
    },
  ];
}

// --- Watermark commands ---

export function createWatermarkCommands(
  t: (key: string, values?: Record<string, any>) => string,
  scene: EditorScene,
  callbacks: {
    toggleWatermark: (enabled: boolean) => void;
  }
): Command[] {
  const { toggleWatermark } = callbacks;
  return [
    {
      id: "watermark-toggle",
      label: scene.watermarkEnabled ? t("commandPalette.disableWatermark") : t("commandPalette.enableWatermark"),
      description: scene.watermarkEnabled ? t("commandPalette.disableWatermarkDesc") : t("commandPalette.enableWatermarkDesc"),
      keywords: ["watermark", "brand", "logo", "mocksy"],
      action: () => toggleWatermark(!scene.watermarkEnabled),
    },
    {
      id: "watermark-edit",
      label: t("commandPalette.editWatermarkText"),
      description: t("commandPalette.watermarkTextDesc", { text: scene.watermarkText }),
      keywords: ["watermark", "text", "edit", "change"],
      action: () => {
        const text = prompt(t("commandPalette.watermarkTextPrompt"), scene.watermarkText);
        if (text !== null) useEditorStore.getState().setWatermarkText(text);
      },
    },
  ];
}

// --- Export scale commands ---

export function createExportScaleCommands(
  t: (key: string, values?: Record<string, any>) => string,
  callbacks: {
    setExportScale: (scale: 1 | 2 | 4) => void;
  }
): Command[] {
  const { setExportScale } = callbacks;
  return [
    {
      id: "export-scale-1x",
      label: t("commandPalette.exportScale1x"),
      description: t("commandPalette.exportScale1xDesc"),
      keywords: ["export", "scale", "resolution", "1x"],
      action: () => setExportScale(1),
    },
    {
      id: "export-scale-2x",
      label: t("commandPalette.exportScale2x"),
      description: t("commandPalette.exportScale2xDesc"),
      keywords: ["export", "scale", "resolution", "2x", "retina"],
      action: () => setExportScale(2),
    },
    {
      id: "export-scale-4x",
      label: t("commandPalette.exportScale4x"),
      description: t("commandPalette.exportScale4xDesc"),
      keywords: ["export", "scale", "resolution", "4x", "print"],
      action: () => setExportScale(4),
    },
  ];
}

// --- Theme commands ---

export function createThemeCommands(
  t: (key: string, values?: Record<string, any>) => string,
  callbacks: {
    setThemeMode: (mode: "light" | "dark" | "system") => void;
  }
): Command[] {
  const { setThemeMode } = callbacks;
  return [
    {
      id: "theme-light",
      label: t("commandPalette.themeLight"),
      description: t("commandPalette.themeLightDesc"),
      keywords: ["theme", "light", "day", "bright"],
      action: () => setThemeMode("light"),
    },
    {
      id: "theme-dark",
      label: t("commandPalette.themeDark"),
      description: t("commandPalette.themeDarkDesc"),
      keywords: ["theme", "dark", "night", "dim"],
      action: () => setThemeMode("dark"),
    },
    {
      id: "theme-system",
      label: t("commandPalette.themeSystem"),
      description: t("commandPalette.themeSystemDesc"),
      keywords: ["theme", "system", "auto", "preference"],
      action: () => setThemeMode("system"),
    },
  ];
}

// --- Project switch commands ---

export function createProjectCommands(
  t: (key: string, values?: Record<string, any>) => string,
  projects: Project[],
  activeProjectId: string | null,
  callbacks: {
    switchProject: (id: string) => void;
  }
): Command[] {
  const { switchProject } = callbacks;
  return projects.map(project => ({
    id: `project-switch-${project.id}`,
    label: t("commandPalette.switchProject", { name: project.name }),
    description: project.id === activeProjectId ? t("commandPalette.current") : t("commandPalette.updated", { date: new Date(project.updatedAt).toLocaleDateString() }),
    keywords: ["project", "switch", "open", project.name.toLowerCase()],
    action: () => switchProject(project.id),
    disabled: project.id === activeProjectId,
  }));
}

// --- Orchestrator ---

export function createCommands(
  t: ReturnType<typeof useTranslations>,
  scene: EditorScene,
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
  onExportMp4: () => void,
  onExportWebm: () => void,
  onExportGif: () => void,
  onExportWebpAnim: () => void,
  onCopyPng: () => void,
  onCopyShareUrl: () => void,
  onSave: () => void,
): Command[] {
  return [
    ...createFileCommands(t, { onExportPng, onExportWebp, onExportSvg, onExportHtml, onExportMp4, onExportWebm, onExportGif, onExportWebpAnim, onCopyPng, onCopyShareUrl, onSave }),
    ...createEditCommands(t, { undo, redo, pastLength, futureLength, resetScene }),
    ...createFrameCommands(t, { setFrame }),
    ...createStyleCommands(t),
    ...createBackgroundCommands(t, { setBackgroundSolid, setBackgroundGradient, setBackgroundTransparent }),
    ...createAspectRatioCommands(t, { setAspectRatio }),
    ...createLayerCommands(t, scene, { addLayer, duplicateLayer, removeLayer, toggleLayerHidden, selectLayer }),
    ...createAnnotationCommands(t, scene, { addAnnotation, clearAnnotations }),
    ...createWatermarkCommands(t, scene, { toggleWatermark }),
    ...createExportScaleCommands(t, { setExportScale }),
    ...createThemeCommands(t, { setThemeMode }),
    ...createProjectCommands(t, projects, activeProjectId, { switchProject }),
  ];
}
