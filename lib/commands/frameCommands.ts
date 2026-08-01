import type { Command, MockupFrame } from "@/lib/types/editor";
import { FRAME_ORDER, FRAME_SPECS } from "@/lib/render/frames";

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