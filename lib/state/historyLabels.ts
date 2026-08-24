import type { EditorScene } from "@/lib/types/editor";

/** Broad categories a history step can belong to. Each maps to a translation
 *  key under `history.change.*` so the panel can show a human-readable label
 *  without storing per-step descriptions in the history stack itself. */
export type HistoryChangeCategory =
  | "layers"
  | "annotations"
  | "frame"
  | "background"
  | "style"
  | "screen"
  | "watermark"
  | "canvas";

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Classifies the change between two adjacent scenes for the history panel.
 *  Checks the most visually significant areas first; the first match wins. */
export function describeHistoryStep(prev: EditorScene, next: EditorScene): HistoryChangeCategory {
  if (!sameJson(prev.layers, next.layers)) return "layers";
  if (!sameJson(prev.annotations, next.annotations)) return "annotations";
  if (
    prev.frame !== next.frame ||
    !sameJson(prev.frameInstances, next.frameInstances) ||
    !sameJson(prev.customFrame, next.customFrame)
  ) {
    return "frame";
  }
  if (
    prev.backgroundMode !== next.backgroundMode ||
    prev.backgroundColor !== next.backgroundColor ||
    prev.gradientFrom !== next.gradientFrom ||
    prev.gradientTo !== next.gradientTo ||
    prev.gradientVia !== next.gradientVia ||
    prev.gradientType !== next.gradientType ||
    prev.gradientAngle !== next.gradientAngle ||
    prev.patternId !== next.patternId ||
    prev.backgroundImageUrl !== next.backgroundImageUrl ||
    prev.backgroundBlur !== next.backgroundBlur
  ) {
    return "background";
  }
  if (
    prev.stylePreset !== next.stylePreset ||
    prev.shadowOpacity !== next.shadowOpacity ||
    prev.borderRadius !== next.borderRadius ||
    prev.screenGlare !== next.screenGlare ||
    prev.floorReflection !== next.floorReflection
  ) {
    return "style";
  }
  if (!sameJson(prev.screen, next.screen)) return "screen";
  if (
    prev.watermarkText !== next.watermarkText ||
    prev.watermarkEnabled !== next.watermarkEnabled ||
    prev.watermarkPosition !== next.watermarkPosition ||
    prev.watermarkSize !== next.watermarkSize ||
    prev.watermarkImageUrl !== next.watermarkImageUrl
  ) {
    return "watermark";
  }
  return "canvas";
}
