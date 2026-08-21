import type { Command, EditorScene, MockupFrame } from "@/lib/types/editor";
import { FRAME_ORDER, FRAME_SPECS } from "@/lib/render/frames";
import type { FrameAlignMode } from "@/lib/state/frameAlign";
import { useEditorStore } from "@/lib/state/editorStore";

export function createFrameCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  callbacks: {
    setFrame: (frame: MockupFrame) => void;
  }
): Command[] {
  const { setFrame } = callbacks;
  return FRAME_ORDER.map(frame => {
    const spec = FRAME_SPECS[frame];
    return {
      id: `frame-${frame}`,
      category: "frame",
      label: t("commandPalette.frameLabel", { name: frame.charAt(0).toUpperCase() + frame.slice(1) }),
      description: spec.isOverlay ? t("commandPalette.frameOverlayDesc") : t("commandPalette.frameCssDesc"),
      keywords: ["frame", "device", "mockup", frame],
      action: () => setFrame(frame),
    };
  });
}

const ALIGN_MODES: FrameAlignMode[] = ["left", "centerX", "right", "top", "centerY", "bottom"];

/** Align/distribute actions for multi-frame scenes. Disabled state mirrors the
 *  FrameSection buttons: align needs ≥2 instances, distribute ≥3. Actions read
 *  the store at invocation time so they always operate on the live scene. */
export function createFrameAlignCommands(t: (key: string) => string, scene: EditorScene): Command[] {
  const count = scene.frameInstances.length;
  const alignCommands: Command[] = ALIGN_MODES.map((mode) => ({
    id: `align-${mode}`,
    category: "frame",
    label: t(`editor.align${mode.charAt(0).toUpperCase() + mode.slice(1)}`),
    keywords: ["align", "frames", mode],
    disabled: count < 2,
    action: () => useEditorStore.getState().alignFrameInstances(mode),
  }));
  const distributeCommands: Command[] = (["horizontal", "vertical"] as const).map((axis) => ({
    id: `distribute-${axis}`,
    category: "frame",
    label: t(axis === "horizontal" ? "editor.distributeHorizontal" : "editor.distributeVertical"),
    keywords: ["distribute", "spacing", "frames", axis],
    disabled: count < 3,
    action: () => useEditorStore.getState().distributeFrameInstances(axis),
  }));
  return [...alignCommands, ...distributeCommands];
}