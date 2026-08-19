import type { EditorScene } from "@/lib/types/editor";
import { loadImage } from "@/lib/render/canvasMedia";
import { getFrameSpec } from "@/lib/render/frames";

export interface LoadedExportAssets {
  /** Device-skin overlay image (SVG rasterized to a bitmap) when the frame uses one. */
  overlay: HTMLImageElement | null;
  /** Background photo when the scene uses an image background. */
  backgroundImage: HTMLImageElement | null;
  /** Logo watermark image when the scene has one enabled. */
  watermarkImage: HTMLImageElement | null;
}

/**
 * Preloads the bitmaps a raster/canvas export needs alongside the scene media:
 * the device-skin overlay (for overlay frames), the background photo, and the
 * logo watermark. Each load is best-effort — a failure leaves that slot null
 * rather than aborting the whole export. Shared by `exportImage` and the video
 * recorder so the two pipelines can't drift in which assets they pull in.
 */
export async function loadExportAssets(scene: EditorScene): Promise<LoadedExportAssets> {
  const spec = getFrameSpec(scene.frame, scene.customFrame);
  let overlay: HTMLImageElement | null = null;
  if (spec.isOverlay && spec.asset) {
    try {
      overlay = await loadImage(spec.asset);
    } catch {
      overlay = null;
    }
  }

  let backgroundImage: HTMLImageElement | null = null;
  if (scene.backgroundMode === "image" && scene.backgroundImageUrl) {
    try {
      backgroundImage = await loadImage(scene.backgroundImageUrl);
    } catch {
      backgroundImage = null;
    }
  }

  let watermarkImage: HTMLImageElement | null = null;
  if (scene.watermarkEnabled && scene.watermarkImageUrl) {
    try {
      watermarkImage = await loadImage(scene.watermarkImageUrl);
    } catch {
      watermarkImage = null;
    }
  }

  return { overlay, backgroundImage, watermarkImage };
}
