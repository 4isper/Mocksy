import type { EditorScene } from "@/lib/types/editor";
import type { RenderTransform } from "@/lib/render/frameGeometry";
import { sampleVideoTransform } from "@/lib/render/videoComposer";

/**
 * Transform for the exported still. An animated scene samples its mid-animation
 * frame (progress 0.5) so the static image matches what the user sees
 * animating in the live preview, instead of always snapping to the base zoom.
 *
 * Kept DOM-free so both `renderMockupToCanvas` and the SVG/HTML exporters can
 * resolve the same transform without pulling in browser globals.
 */
export function resolveExportTransform(scene: EditorScene, activeLayerId: string | null = scene.activeLayerId): RenderTransform {
  const active = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  if (!active) return { zoom: 1, offsetX: 0, offsetY: 0 };
  if (active.animationPreset === "none") {
    // The static preview does not translate the frame (only the media inside
    // it pans, and that is drawn from mediaOffsetX/Y separately), so the frame
    // transform offset stays zero here.
    return { zoom: active.zoom, offsetX: 0, offsetY: 0 };
  }
  const sampled = sampleVideoTransform(active, 0.5);
  return { zoom: sampled.zoom, offsetX: sampled.x, offsetY: sampled.y };
}

/** Resolves once an <img> has decoded (or immediately if it already has). */
export function waitForImage(img: HTMLImageElement, timeoutMs = 10000): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Image load timed out")), timeoutMs);
    const clear = () => clearTimeout(timer);
    img.onload = () => {
      clear();
      resolve();
    };
    img.onerror = () => {
      clear();
      reject(new Error("Image load failed"));
    };
  });
}
