import type { EditorScene } from "@/lib/types/editor";
import { parseAspectRatioOr } from "@/lib/render/aspectRatio";

/**
 * Intrinsic artboard width every exporter anchors to. Raster/video exports
 * used to derive their bitmap from the live preview's CSS box, which made the
 * output depend on the window size, browser page zoom and even the monitor's
 * devicePixelRatio. Anchoring to this constant makes "same scene + same
 * settings ⇒ same file" hold everywhere; the chosen export scale becomes a
 * pure quality multiplier on top.
 */
export const EXPORT_BASE_WIDTH = 800;

/** Aspect ratio (width / height) of the scene canvas. */
export function sceneAspectRatio(scene: EditorScene): number {
  const { w, h } = parseAspectRatioOr(scene.aspectRatio);
  return h === 0 ? 1 : w / h;
}

/** Deterministic bitmap size for a scene at the given quality scale —
 *  independent of any DOM measurement. */
export function intrinsicExportSize(
  scene: EditorScene,
  scale = 1
): { width: number; height: number } {
  const width = Math.max(1, Math.round(EXPORT_BASE_WIDTH * scale));
  const height = Math.max(1, Math.round(width / sceneAspectRatio(scene)));
  return { width, height };
}

/** Uniform fit ratio for a custom pixel size: scales the aspect-correct base
 *  artboard down/up so it fits inside the requested box (letterboxing happens
 *  in the renderer when the aspect ratios differ). */
export function fitRatioForCustomSize(
  scene: EditorScene,
  custom: { width: number; height: number }
): number {
  const base = intrinsicExportSize(scene, 1);
  return Math.min(custom.width / base.width, custom.height / base.height);
}
