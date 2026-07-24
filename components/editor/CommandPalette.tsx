"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { useThemeStore } from "@/lib/state/themeStore";
import { FRAME_ORDER, FRAME_SPECS, ASPECT_RATIOS } from "@/lib/render/frames";
import { sceneStylePresets, applySceneStylePreset, backgroundPresets } from "@/lib/presets/presets";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";

export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  keywords: string[];
  action: () => void;
  disabled?: boolean;
}

interface CommandPaletteState {
  isOpen: boolean;
  searchQuery: string;
  selectedIndex: number;
  open: () => void;
  close: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
}

function matchQuery(command: Command, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [command.label, command.description, ...command.keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function scoreMatch(command: Command, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const label = command.label.toLowerCase();
  const desc = command.description?.toLowerCase() || "";

  if (label.startsWith(q)) return 100;
  if (label.includes(q)) return 50;
  if (desc.includes(q)) return 25;
  if (command.keywords.some(k => k.toLowerCase().includes(q))) return 10;
  return 0;
}

function createCommands(
  // Editor state
  scene: EditorScene,
  undo: () => void,
  redo: () => void,
  pastLength: number,
  futureLength: number,
  resetScene: () => void,
  setFrame: (frame: any) => void,
  setStylePreset: (preset: any) => void,
  setAnimationPreset: (preset: any) => void,
  setBackgroundSolid: (color: string) => void,
  setBackgroundGradient: (from: string, to: string) => void,
  setBackgroundTransparent: () => void,
  setBackgroundImage: (url: string) => void,
  setAspectRatio: (ratio: string) => void,
  addLayer: (url: string, type: any, name?: string | null) => void,
  duplicateLayer: (id: string) => void,
  removeLayer: (id: string) => void,
  toggleLayerHidden: (id: string) => void,
  selectLayer: (id: string) => void,
  reorderLayers: (ids: string[]) => void,
  addAnnotation: (type: any) => void,
  clearAnnotations: () => void,
  toggleWatermark: (enabled: boolean) => void,
  setExportScale: (scale: 1 | 2 | 4) => void,
  exportScale: 1 | 2 | 4,
  // Projects
  activeProjectId: string | null,
  projects: any[],
  switchProject: (id: string) => void,
  // Theme
  themeMode: "light" | "dark" | "system",
  setThemeMode: (mode: "light" | "dark" | "system") => void,
  // Export callbacks
  onExportPng: () => void,
  onExportMp4: () => void,
  onExportGif: () => void,
  onCopyPng: () => void,
  onCopyShareUrl: () => void,
  onSave: () => void
): Command[] {
  const layers = scene.layers;
  const activeLayerId = scene.activeLayerId ?? layers[0]?.id;

  const commands: Command[] = [
    // === File / Project ===
    {
      id: "new-project",
      label: "New Project",
      description: "Create a fresh mockup project",
      shortcut: "⌘N",
      keywords: ["new", "create", "fresh", "start"],
      action: () => {
        const newProjectId = useProjectsStore.getState().createProject("Untitled");
        useProjectsStore.getState().switchProject(newProjectId);
      },
    },
    {
      id: "save-project",
      label: "Save Project",
      description: "Save current project to localStorage",
      shortcut: "⌘S",
      keywords: ["save", "store", "persist"],
      action: onSave,
    },
    {
      id: "export-png",
      label: "Export PNG",
      description: "Export current scene as PNG image",
      shortcut: "⌘E",
      keywords: ["export", "png", "image", "download", "picture"],
      action: onExportPng,
    },
    {
      id: "export-mp4",
      label: "Export MP4",
      description: "Export animated scene as MP4 video",
      shortcut: "⇧⌘E",
      keywords: ["export", "mp4", "video", "movie", "animation"],
      action: onExportMp4,
    },
    {
      id: "export-gif",
      label: "Export GIF",
      description: "Export animated scene as GIF",
      shortcut: "⇧⌘G",
      keywords: ["export", "gif", "animation", "animated"],
      action: onExportGif,
    },
    {
      id: "copy-png",
      label: "Copy PNG to Clipboard",
      description: "Copy current scene as PNG to clipboard",
      shortcut: "⇧⌘C",
      keywords: ["copy", "clipboard", "png", "image"],
      action: onCopyPng,
    },
    {
      id: "copy-share-url",
      label: "Copy Share URL",
      description: "Copy shareable link with current scene",
      shortcut: "⌘L",
      keywords: ["copy", "share", "url", "link"],
      action: onCopyShareUrl,
    },

    // === Edit ===
    {
      id: "undo",
      label: "Undo",
      description: "Undo last change",
      shortcut: "⌘Z",
      keywords: ["undo", "back", "revert"],
      action: undo,
      disabled: pastLength === 0,
    },
    {
      id: "redo",
      label: "Redo",
      description: "Redo last undone change",
      shortcut: "⇧⌘Z",
      keywords: ["redo", "forward", "repeat"],
      action: redo,
      disabled: futureLength === 0,
    },
    {
      id: "reset-scene",
      label: "Reset to Defaults",
      description: "Clear scene and restore default settings",
      shortcut: "R",
      keywords: ["reset", "default", "clear", "restart"],
      action: resetScene,
    },

    // === Frames ===
    ...FRAME_ORDER.map(frame => {
      const spec = FRAME_SPECS[frame];
      return {
        id: `frame-${frame}`,
        label: `Frame: ${frame.charAt(0).toUpperCase() + frame.slice(1)}`,
        description: spec.isOverlay ? "Device overlay with screen cutout" : "CSS-only frame",
        keywords: ["frame", "device", "mockup", frame],
        action: () => setFrame(frame as any),
      };
    }),

    // === Style Presets ===
    ...sceneStylePresets.map(preset => ({
      id: `preset-${preset.id}`,
      label: `Preset: ${preset.name}`,
      description: `${preset.frame} • ${preset.stylePreset} • ${preset.backgroundMode}`,
      keywords: ["preset", "style", "theme", "template", preset.name.toLowerCase()],
      action: () => {
        const scenePatch = applySceneStylePreset(preset);
        useEditorStore.getState().setScene(scenePatch);
      },
    })),

    // === Backgrounds ===
    ...backgroundPresets.map(bg => ({
      id: `bg-${bg.id}`,
      label: `Background: ${bg.name}`,
      description: bg.kind === "gradient" ? `${bg.gradientFrom} → ${bg.gradientTo}` : bg.backgroundColor,
      keywords: ["background", "bg", "color", "gradient", "solid", bg.name.toLowerCase()],
      action: () => {
        if (bg.kind === "transparent") setBackgroundTransparent();
        else if (bg.kind === "solid") setBackgroundSolid(bg.backgroundColor!);
        else setBackgroundGradient(bg.gradientFrom!, bg.gradientTo!);
      },
    })),

    // === Aspect Ratios ===
    ...ASPECT_RATIOS.map(ratio => ({
      id: `ratio-${ratio.replace(/\s/g, "-")}`,
      label: `Aspect Ratio: ${ratio}`,
      description: `Set canvas to ${ratio}`,
      keywords: ["ratio", "aspect", "canvas", "size", ratio],
      action: () => setAspectRatio(ratio),
    })),

    // === Layers ===
    {
      id: "layer-add",
      label: "Add Layer",
      description: "Add a new media layer",
      shortcut: "⌘D",
      keywords: ["layer", "add", "new", "media", "image", "video"],
      action: () => {
        // Opens file picker via control panel
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
      label: "Duplicate Active Layer",
      description: "Clone the currently selected layer",
      shortcut: "⌘D",
      keywords: ["layer", "duplicate", "clone", "copy"],
      action: () => {
        if (activeLayerId) duplicateLayer(activeLayerId);
      },
      disabled: !activeLayerId,
    },
    {
      id: "layer-remove",
      label: "Remove Active Layer",
      description: "Delete the currently selected layer",
      keywords: ["layer", "remove", "delete", "trash"],
      action: () => {
        if (activeLayerId && layers.length > 1) removeLayer(activeLayerId);
      },
      disabled: !activeLayerId || layers.length <= 1,
    },
    {
      id: "layer-toggle-hidden",
      label: "Toggle Layer Visibility",
      description: "Show/hide the active layer",
      keywords: ["layer", "hide", "show", "visibility", "eye"],
      action: () => {
        if (activeLayerId) toggleLayerHidden(activeLayerId);
      },
      disabled: !activeLayerId,
    },
    ...layers.map(layer => ({
      id: `layer-select-${layer.id}`,
      label: `Select Layer: ${layer.mediaName || `Layer ${layers.indexOf(layer) + 1}`}`,
      description: layer.hidden ? "(hidden)" : "Click to select",
      keywords: ["layer", "select", "switch", layer.mediaName || ""],
      action: () => selectLayer(layer.id),
    })),

    // === Annotations ===
    {
      id: "anno-text",
      label: "Add Text Annotation",
      description: "Add editable text overlay",
      keywords: ["annotation", "text", "label", "caption"],
      action: () => addAnnotation("text"),
    },
    {
      id: "anno-arrow",
      label: "Add Arrow Annotation",
      description: "Add directional arrow overlay",
      keywords: ["annotation", "arrow", "pointer", "direction"],
      action: () => addAnnotation("arrow"),
    },
    {
      id: "anno-rect",
      label: "Add Rectangle Annotation",
      description: "Add rectangle highlight overlay",
      keywords: ["annotation", "rectangle", "box", "highlight", "shape"],
      action: () => addAnnotation("rectangle"),
    },
    {
      id: "anno-clear",
      label: "Clear All Annotations",
      description: "Remove all text, arrows, and rectangles",
      keywords: ["annotation", "clear", "remove", "delete", "all"],
      action: clearAnnotations,
      disabled: scene.annotations.length === 0,
    },

    // === Watermark ===
    {
      id: "watermark-toggle",
      label: scene.watermarkEnabled ? "Disable Watermark" : "Enable Watermark",
      description: scene.watermarkEnabled ? "Remove Mocksy watermark" : "Add Mocksy watermark",
      keywords: ["watermark", "brand", "logo", "mocksy"],
      action: () => toggleWatermark(!scene.watermarkEnabled),
    },
    {
      id: "watermark-edit",
      label: "Edit Watermark Text",
      description: `Current: "${scene.watermarkText}"`,
      keywords: ["watermark", "text", "edit", "change"],
      action: () => {
        const text = prompt("Watermark text:", scene.watermarkText);
        if (text !== null) useEditorStore.getState().setWatermarkText(text);
      },
    },

    // === Export Scale ===
    {
      id: "export-scale-1x",
      label: "Export Scale: 1×",
      description: "Standard resolution export",
      keywords: ["export", "scale", "resolution", "1x"],
      action: () => setExportScale(1),
    },
    {
      id: "export-scale-2x",
      label: "Export Scale: 2×",
      description: "High resolution export (default)",
      keywords: ["export", "scale", "resolution", "2x", "retina"],
      action: () => setExportScale(2),
    },
    {
      id: "export-scale-4x",
      label: "Export Scale: 4×",
      description: "Ultra high resolution export",
      keywords: ["export", "scale", "resolution", "4x", "print"],
      action: () => setExportScale(4),
    },

    // === Theme ===
    {
      id: "theme-light",
      label: "Theme: Light",
      description: "Switch to light color scheme",
      keywords: ["theme", "light", "day", "bright"],
      action: () => setThemeMode("light"),
    },
    {
      id: "theme-dark",
      label: "Theme: Dark",
      description: "Switch to dark color scheme",
      keywords: ["theme", "dark", "night", "dim"],
      action: () => setThemeMode("dark"),
    },
    {
      id: "theme-system",
      label: "Theme: System",
      description: "Follow system preference",
      keywords: ["theme", "system", "auto", "preference"],
      action: () => setThemeMode("system"),
    },

    // === Projects ===
    ...projects.map(project => ({
      id: `project-switch-${project.id}`,
      label: `Switch to Project: ${project.name}`,
      description: project.id === activeProjectId ? "(current)" : `Updated ${new Date(project.updatedAt).toLocaleDateString()}`,
      keywords: ["project", "switch", "open", project.name.toLowerCase()],
      action: () => switchProject(project.id),
      disabled: project.id === activeProjectId,
    })),
  ];

  return commands;
}

export function useCommands(
  onExportPng: () => void,
  onExportMp4: () => void,
  onExportGif: () => void,
  onCopyPng: () => void,
  onCopyShareUrl: () => void,
  onSave: () => void
) {
  const scene = useEditorStore(s => s.scene);
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
  const setBackgroundTransparent = useEditorStore(s => s.setBackgroundTransparent);
  const setBackgroundImage = useEditorStore(s => s.setBackgroundImage);
  const setAspectRatio = useEditorStore(s => s.setAspectRatio);
  const addLayer = useEditorStore(s => s.addLayer);
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
    scene, undo, redo, pastLength, futureLength, resetScene,
    setFrame, setStylePreset, setAnimationPreset,
    setBackgroundSolid, setBackgroundGradient, setBackgroundTransparent, setBackgroundImage,
    setAspectRatio, addLayer, duplicateLayer, removeLayer, toggleLayerHidden,
    selectLayer, reorderLayers, addAnnotation, clearAnnotations,
    toggleWatermark, setExportScale, exportScale,
    activeProjectId, projects, switchProject,
    themeMode, setThemeMode,
    onExportPng, onExportMp4, onExportGif, onCopyPng, onCopyShareUrl, onSave
  ), [
    scene, pastLength, futureLength, activeProjectId, projects, themeMode, exportScale,
    onExportPng, onExportMp4, onExportGif, onCopyPng, onCopyShareUrl, onSave,
    undo, redo, resetScene,
    setFrame, setStylePreset, setAnimationPreset,
    setBackgroundSolid, setBackgroundGradient, setBackgroundTransparent, setBackgroundImage,
    setAspectRatio, addLayer, duplicateLayer, removeLayer, toggleLayerHidden,
    selectLayer, reorderLayers, addAnnotation, clearAnnotations,
    toggleWatermark, setExportScale, switchProject, setThemeMode
  ]);
}

export function CommandPalette({ 
  commands, 
  isOpen, 
  onClose, 
  onSearchChange 
}: { 
  commands: Command[]; 
  isOpen: boolean; 
  onClose: () => void; 
  onSearchChange?: (query: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredCommands = useMemo(() => {
    return commands
      .filter(c => !c.disabled && matchQuery(c, searchQuery))
      .sort((a, b) => scoreMatch(b, searchQuery) - scoreMatch(a, searchQuery));
  }, [commands, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const item = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, filteredCommands.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        cmd.action();
        onClose();
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      setSelectedIndex((selectedIndex + 1) % filteredCommands.length);
      return;
    }
  }, [filteredCommands, onClose, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        className="command-palette"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="command-palette-header">
          <kbd className="command-palette-kbd">⌘K</kbd>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              onSearchChange?.(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command…"
            className="command-palette-input"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search commands"
          />
          <kbd className="command-palette-kbd">⎋</kbd>
        </div>
        <div className="command-palette-list" ref={listRef} role="listbox">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty" role="option" aria-selected={false}>
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                className={`command-palette-item ${idx === selectedIndex ? "selected" : ""}`}
                data-index={idx}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                role="option"
                aria-selected={idx === selectedIndex}
              >
                <span className="command-palette-item-label">{cmd.label}</span>
                {cmd.description && (
                  <span className="command-palette-item-desc">{cmd.description}</span>
                )}
                {cmd.shortcut && (
                  <kbd className="command-palette-item-shortcut">{cmd.shortcut}</kbd>
                )}
              </button>
            ))
          )}
        </div>
        <div className="command-palette-footer">
          {filteredCommands.length} command{filteredCommands.length !== 1 ? "s" : ""} available
        </div>
      </div>
    </div>
  );
}