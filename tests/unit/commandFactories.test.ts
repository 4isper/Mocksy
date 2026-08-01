import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAnnotationCommands,
  createAspectRatioCommands,
  createBackgroundCommands,
  createCommands,
  createEditCommands,
  createExportScaleCommands,
  createFileCommands,
  createFrameCommands,
  createLayerCommands,
  createProjectCommands,
  createStyleCommands,
  createThemeCommands,
  createWatermarkCommands
} from "@/lib/commands/commandFactories";
import { FRAME_ORDER, FRAME_SPECS, ASPECT_RATIOS } from "@/lib/render/frames";
import { sceneStylePresets, backgroundPresets } from "@/lib/presets/presets";
import { initialScene, useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import type { EditorScene, Project } from "@/lib/types/editor";

const t = (key: string) => key;

function makeScene(layers = 2): EditorScene {
  const base = initialScene;
  const scene = {
    ...base,
    layers: Array.from({ length: layers }, (_, i) => ({
      ...base.layers[0]!,
      id: `layer-${i}`,
      mediaName: i === 0 ? "cover.png" : ""
    })),
    activeLayerId: "layer-0"
  };
  return scene;
}

function makeProject(id: string, name: string): Project {
  return { id, name, scene: initialScene, updatedAt: Date.now() };
}

function makeFileCallbacks() {
  return {
    onExportPng: vi.fn(),
    onExportWebp: vi.fn(),
    onExportSvg: vi.fn(),
    onExportHtml: vi.fn(),
    onExportMp4: vi.fn(),
    onExportWebm: vi.fn(),
    onExportGif: vi.fn(),
    onExportWebpAnim: vi.fn(),
    onCopyPng: vi.fn(),
    onCopyShareUrl: vi.fn(),
    onSave: vi.fn()
  };
}

function makeOrchestratorArgs(scene: EditorScene) {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    resetScene: vi.fn(),
    setFrame: vi.fn(),
    setStylePreset: vi.fn(),
    setAnimationPreset: vi.fn(),
    setBackgroundSolid: vi.fn(),
    setBackgroundGradient: vi.fn(),
    setBackgroundTransparent: vi.fn(),
    setBackgroundImage: vi.fn(),
    setAspectRatio: vi.fn(),
    addLayer: vi.fn(),
    duplicateLayer: vi.fn(),
    removeLayer: vi.fn(),
    toggleLayerHidden: vi.fn(),
    selectLayer: vi.fn(),
    reorderLayers: vi.fn(),
    addAnnotation: vi.fn(),
    clearAnnotations: vi.fn(),
    toggleWatermark: vi.fn(),
    setExportScale: vi.fn(),
    switchProject: vi.fn(),
    setThemeMode: vi.fn(),
    ...makeFileCallbacks()
  };
}

beforeEach(() => {
  useEditorStore.setState({
    scene: initialScene,
    past: [],
    future: [],
    lastHistoryKey: null,
    lastHistoryAt: 0
  });
  useProjectsStore.setState({ projects: [], activeProjectId: null, hydrated: false, saveError: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createFileCommands", () => {
  it("routes each export/copy action to its callback", () => {
    const cb = makeFileCallbacks();
    const cmds = createFileCommands(t, cb);
    expect(cmds.map((c) => c.id)).toEqual([
      "new-project", "save-project", "export-png", "export-mp4", "export-webm",
      "export-webp", "export-webp-anim", "export-svg", "export-html", "export-gif",
      "copy-png", "copy-share-url"
    ]);
    cmds.find((c) => c.id === "save-project")!.action();
    cmds.find((c) => c.id === "export-png")!.action();
    cmds.find((c) => c.id === "export-mp4")!.action();
    cmds.find((c) => c.id === "export-webm")!.action();
    cmds.find((c) => c.id === "export-webp")!.action();
    cmds.find((c) => c.id === "export-webp-anim")!.action();
    cmds.find((c) => c.id === "export-svg")!.action();
    cmds.find((c) => c.id === "export-html")!.action();
    cmds.find((c) => c.id === "export-gif")!.action();
    cmds.find((c) => c.id === "copy-png")!.action();
    cmds.find((c) => c.id === "copy-share-url")!.action();
    expect(cb.onSave).toHaveBeenCalledTimes(1);
    expect(cb.onExportPng).toHaveBeenCalledTimes(1);
    expect(cb.onExportMp4).toHaveBeenCalledTimes(1);
    expect(cb.onExportWebm).toHaveBeenCalledTimes(1);
    expect(cb.onExportWebp).toHaveBeenCalledTimes(1);
    expect(cb.onExportWebpAnim).toHaveBeenCalledTimes(1);
    expect(cb.onExportSvg).toHaveBeenCalledTimes(1);
    expect(cb.onExportHtml).toHaveBeenCalledTimes(1);
    expect(cb.onExportGif).toHaveBeenCalledTimes(1);
    expect(cb.onCopyPng).toHaveBeenCalledTimes(1);
    expect(cb.onCopyShareUrl).toHaveBeenCalledTimes(1);
  });

  it("creates and activates a new project from the new-project action", () => {
    const cmds = createFileCommands(t, makeFileCallbacks());
    cmds.find((c) => c.id === "new-project")!.action();
    expect(useProjectsStore.getState().projects).toHaveLength(1);
    expect(useProjectsStore.getState().projects[0]!.name).toBe("Untitled");
    expect(useProjectsStore.getState().activeProjectId).toBe(useProjectsStore.getState().projects[0]!.id);
  });
});

describe("createEditCommands", () => {
  it("disables undo/redo based on history depth", () => {
    const undo = vi.fn();
    const redo = vi.fn();
    const resetScene = vi.fn();
    const cmds = createEditCommands(t, { undo, redo, pastLength: 0, futureLength: 0, resetScene });
    expect(cmds.find((c) => c.id === "undo")!.disabled).toBe(true);
    expect(cmds.find((c) => c.id === "redo")!.disabled).toBe(true);
    const withHistory = createEditCommands(t, { undo, redo, pastLength: 2, futureLength: 1, resetScene });
    expect(withHistory.find((c) => c.id === "undo")!.disabled).toBe(false);
    expect(withHistory.find((c) => c.id === "redo")!.disabled).toBe(false);
    withHistory.find((c) => c.id === "undo")!.action();
    withHistory.find((c) => c.id === "redo")!.action();
    withHistory.find((c) => c.id === "reset-scene")!.action();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(1);
    expect(resetScene).toHaveBeenCalledTimes(1);
  });
});

describe("createFrameCommands", () => {
  it("emits one command per frame with a setFrame action", () => {
    const setFrame = vi.fn();
    const cmds = createFrameCommands(t, { setFrame });
    expect(cmds).toHaveLength(FRAME_ORDER.length);
    for (const frame of FRAME_ORDER) {
      const cmd = cmds.find((c) => c.id === `frame-${frame}`)!;
      expect(cmd).toBeDefined();
      const spec = FRAME_SPECS[frame];
      expect(cmd.description).toBe(spec.isOverlay ? "commandPalette.frameOverlayDesc" : "commandPalette.frameCssDesc");
      cmd.action();
    }
    expect(setFrame).toHaveBeenCalledTimes(FRAME_ORDER.length);
    FRAME_ORDER.forEach((frame, i) => expect(setFrame.mock.calls[i]![0]).toBe(frame));
  });
});

describe("createStyleCommands", () => {
  it("applies each scene style preset to the editor store", () => {
    const cmds = createStyleCommands(t);
    expect(cmds).toHaveLength(sceneStylePresets.length);
    for (let i = 0; i < cmds.length; i++) {
      cmds[i]!.action();
      const scene = useEditorStore.getState().scene;
      expect(scene.stylePreset).toBe(sceneStylePresets[i]!.stylePreset);
      expect(scene.frame).toBe(sceneStylePresets[i]!.frame);
    }
  });
});

describe("createBackgroundCommands", () => {
  it("routes background presets to the right setter", () => {
    const setBackgroundSolid = vi.fn();
    const setBackgroundGradient = vi.fn();
    const setBackgroundTransparent = vi.fn();
    const cmds = createBackgroundCommands(t, { setBackgroundSolid, setBackgroundGradient, setBackgroundTransparent });
    expect(cmds).toHaveLength(backgroundPresets.length);
    for (const preset of backgroundPresets) {
      const cmd = cmds.find((c) => c.id === `bg-${preset.id}`)!;
      cmd.action();
    }
    for (const preset of backgroundPresets) {
      if (preset.kind === "transparent") expect(setBackgroundTransparent).toHaveBeenCalled();
      else if (preset.kind === "solid")
        expect(setBackgroundSolid).toHaveBeenCalledWith(preset.backgroundColor);
      else expect(setBackgroundGradient).toHaveBeenCalledWith(preset.gradientFrom, preset.gradientTo);
    }
  });
});

describe("createAspectRatioCommands", () => {
  it("emits one command per aspect ratio", () => {
    const setAspectRatio = vi.fn();
    const cmds = createAspectRatioCommands(t, { setAspectRatio });
    expect(cmds).toHaveLength(ASPECT_RATIOS.length);
    ASPECT_RATIOS.forEach((ratio, i) => {
      const cmd = cmds.find((c) => c.id === `ratio-${ratio.replace(/\s/g, "-")}`)!;
      cmd.action();
      expect(setAspectRatio.mock.calls[i]![0]).toBe(ratio);
    });
  });
});

describe("createLayerCommands", () => {
  it("adds a layer from a picked file", () => {
    const addLayer = vi.fn();
    const input = {
      type: "",
      accept: "",
      onchange: null as ((e: { target: { files: File[] | null } }) => void) | null,
      click: vi.fn()
    };
    vi.stubGlobal("document", { createElement: (tag: string) => (tag === "input" ? input : undefined) });
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:file"), revokeObjectURL: vi.fn() });

    const cmds = createLayerCommands(t, makeScene(), {
      addLayer, duplicateLayer: vi.fn(), removeLayer: vi.fn(), toggleLayerHidden: vi.fn(), selectLayer: vi.fn()
    });
    cmds.find((c) => c.id === "layer-add")!.action();
    expect(input.click).toHaveBeenCalled();
    input.onchange?.({ target: { files: [new File(["x"], "clip.mp4", { type: "video/mp4" })] } });
    expect(addLayer).toHaveBeenCalledWith("blob:file", "video", "clip.mp4");
  });

  it("duplicates, removes, toggles and selects the active layer", () => {
    const scene = makeScene(2);
    const duplicateLayer = vi.fn();
    const removeLayer = vi.fn();
    const toggleLayerHidden = vi.fn();
    const selectLayer = vi.fn();
    const cmds = createLayerCommands(t, scene, {
      addLayer: vi.fn(), duplicateLayer, removeLayer, toggleLayerHidden, selectLayer
    });
    expect(cmds.find((c) => c.id === "layer-duplicate")!.disabled).toBe(false);
    expect(cmds.find((c) => c.id === "layer-remove")!.disabled).toBe(false);
    cmds.find((c) => c.id === "layer-duplicate")!.action();
    cmds.find((c) => c.id === "layer-remove")!.action();
    cmds.find((c) => c.id === "layer-toggle-hidden")!.action();
    cmds.find((c) => c.id === "layer-select-layer-1")!.action();
    expect(duplicateLayer).toHaveBeenCalledWith("layer-0");
    expect(removeLayer).toHaveBeenCalledWith("layer-0");
    expect(toggleLayerHidden).toHaveBeenCalledWith("layer-0");
    expect(selectLayer).toHaveBeenCalledWith("layer-1");
  });

  it("falls back to the first layer when no layer is active", () => {
    const duplicateLayer = vi.fn();
    const removeLayer = vi.fn();
    const toggleLayerHidden = vi.fn();
    const cmds = createLayerCommands(t, { ...makeScene(2), activeLayerId: null }, {
      addLayer: vi.fn(), duplicateLayer, removeLayer, toggleLayerHidden, selectLayer: vi.fn()
    });
    cmds.find((c) => c.id === "layer-duplicate")!.action();
    cmds.find((c) => c.id === "layer-toggle-hidden")!.action();
    expect(duplicateLayer).toHaveBeenCalledWith("layer-0");
    expect(toggleLayerHidden).toHaveBeenCalledWith("layer-0");
  });

  it("never offers to remove the last remaining layer", () => {
    const cmds = createLayerCommands(t, makeScene(1), {
      addLayer: vi.fn(), duplicateLayer: vi.fn(), removeLayer: vi.fn(), toggleLayerHidden: vi.fn(), selectLayer: vi.fn()
    });
    expect(cmds.find((c) => c.id === "layer-remove")!.disabled).toBe(true);
  });
});

describe("createAnnotationCommands", () => {
  it("adds the requested annotation type and clears when allowed", () => {
    const addAnnotation = vi.fn();
    const clearAnnotations = vi.fn();
    const scene = makeScene(1);
    const cmds = createAnnotationCommands(t, scene, { addAnnotation, clearAnnotations });
    expect(cmds.find((c) => c.id === "anno-clear")!.disabled).toBe(true);
    cmds.find((c) => c.id === "anno-text")!.action();
    cmds.find((c) => c.id === "anno-arrow")!.action();
    cmds.find((c) => c.id === "anno-rect")!.action();
    expect(addAnnotation).toHaveBeenNthCalledWith(1, "text");
    expect(addAnnotation).toHaveBeenNthCalledWith(2, "arrow");
    expect(addAnnotation).toHaveBeenNthCalledWith(3, "rect");

    const withAnnotations = createAnnotationCommands(t, {
      ...scene,
      annotations: [{ id: "a1", type: "text", x: 0, y: 0, w: 0, h: 0, text: "Hi", color: "#fff", strokeWidth: 0, fontSize: 12 }]
    }, { addAnnotation, clearAnnotations });
    withAnnotations.find((c) => c.id === "anno-clear")!.action();
    expect(clearAnnotations).toHaveBeenCalledTimes(1);
  });
});

describe("createWatermarkCommands", () => {
  it("toggles the watermark based on the current scene state", () => {
    const toggleWatermark = vi.fn();
    const off = createWatermarkCommands(t, makeScene(), { toggleWatermark });
    expect(off.find((c) => c.id === "watermark-toggle")!.label).toBe("commandPalette.enableWatermark");
    off.find((c) => c.id === "watermark-toggle")!.action();
    expect(toggleWatermark).toHaveBeenCalledWith(true);

    const on = createWatermarkCommands(t, { ...makeScene(), watermarkEnabled: true }, { toggleWatermark });
    expect(on.find((c) => c.id === "watermark-toggle")!.label).toBe("commandPalette.disableWatermark");
    on.find((c) => c.id === "watermark-toggle")!.action();
    expect(toggleWatermark).toHaveBeenLastCalledWith(false);
  });

  it("edits the watermark text through a prompt", () => {
    vi.stubGlobal("prompt", () => "My Brand");
    const cmds = createWatermarkCommands(t, makeScene(), { toggleWatermark: vi.fn() });
    cmds.find((c) => c.id === "watermark-edit")!.action();
    expect(useEditorStore.getState().scene.watermarkText).toBe("My Brand");
  });
});

describe("createExportScaleCommands", () => {
  it("sets the export scale", () => {
    const setExportScale = vi.fn();
    const cmds = createExportScaleCommands(t, { setExportScale });
    cmds.find((c) => c.id === "export-scale-1x")!.action();
    cmds.find((c) => c.id === "export-scale-2x")!.action();
    cmds.find((c) => c.id === "export-scale-4x")!.action();
    expect(setExportScale).toHaveBeenNthCalledWith(1, 1);
    expect(setExportScale).toHaveBeenNthCalledWith(2, 2);
    expect(setExportScale).toHaveBeenNthCalledWith(3, 4);
  });
});

describe("createThemeCommands", () => {
  it("sets the theme mode", () => {
    const setThemeMode = vi.fn();
    const cmds = createThemeCommands(t, { setThemeMode });
    cmds.find((c) => c.id === "theme-light")!.action();
    cmds.find((c) => c.id === "theme-dark")!.action();
    cmds.find((c) => c.id === "theme-system")!.action();
    expect(setThemeMode).toHaveBeenNthCalledWith(1, "light");
    expect(setThemeMode).toHaveBeenNthCalledWith(2, "dark");
    expect(setThemeMode).toHaveBeenNthCalledWith(3, "system");
  });
});

describe("createProjectCommands", () => {
  it("switches projects and disables the active one", () => {
    const projects = [makeProject("p1", "One"), makeProject("p2", "Two")];
    const switchProject = vi.fn();
    const cmds = createProjectCommands(t, projects, "p1", { switchProject });
    expect(cmds.find((c) => c.id === "project-switch-p1")!.disabled).toBe(true);
    expect(cmds.find((c) => c.id === "project-switch-p2")!.disabled).toBe(false);
    cmds.find((c) => c.id === "project-switch-p2")!.action();
    expect(switchProject).toHaveBeenCalledWith("p2");
  });
});

describe("createCommands", () => {
  it("combines every command group into a single list", () => {
    const scene = makeScene(2);
    const a = makeOrchestratorArgs(scene);
    const cmds = createCommands(
      t as never, scene,
      a.undo, a.redo, 1, 0, a.resetScene,
      a.setFrame, a.setStylePreset, a.setAnimationPreset,
      a.setBackgroundSolid, a.setBackgroundGradient, a.setBackgroundTransparent, a.setBackgroundImage,
      a.setAspectRatio,
      a.addLayer, a.duplicateLayer, a.removeLayer, a.toggleLayerHidden, a.selectLayer, a.reorderLayers,
      a.addAnnotation, a.clearAnnotations,
      a.toggleWatermark,
      a.setExportScale, 2,
      "p1", [makeProject("p1", "One")], a.switchProject,
      "dark", a.setThemeMode,
      a.onExportPng, a.onExportWebp, a.onExportSvg, a.onExportHtml,
      a.onExportMp4, a.onExportWebm, a.onExportGif, a.onExportWebpAnim,
      a.onCopyPng, a.onCopyShareUrl, a.onSave
    );

    expect(cmds.find((c) => c.id === "export-png")).toBeDefined();
    expect(cmds.find((c) => c.id === "undo")).toBeDefined();
    expect(cmds.find((c) => c.id === `frame-${FRAME_ORDER[0]}`)).toBeDefined();
    expect(cmds.find((c) => c.id === "layer-add")).toBeDefined();
    expect(cmds.find((c) => c.id === "anno-text")).toBeDefined();
    expect(cmds.find((c) => c.id === "watermark-toggle")).toBeDefined();
    expect(cmds.find((c) => c.id === "export-scale-2x")).toBeDefined();
    expect(cmds.find((c) => c.id === "theme-system")).toBeDefined();
    expect(cmds.find((c) => c.id === "project-switch-p1")).toBeDefined();

    cmds.find((c) => c.id === "export-svg")!.action();
    cmds.find((c) => c.id === "undo")!.action();
    expect(a.onExportSvg).toHaveBeenCalledTimes(1);
    expect(a.undo).toHaveBeenCalledTimes(1);
  });
});
