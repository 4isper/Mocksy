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
    // No animation: the frame renders at identity. The layer's static media
    // zoom is a media-level transform applied inside the screen at draw time
    // (drawMediaSource / the CSS media element), not a frame-box transform.
    return { zoom: 1, offsetX: 0, offsetY: 0 };
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

/**
 * CSS attribute selector matching a layer's own media element in the preview
 * (see `data-layer-media` in SingleFrameView). Exporters must resolve media by
 * this identity instead of DOM order — the preview container also holds
 * unrelated elements (device-skin overlays, the watermark logo, other layers'
 * media) that a blind `querySelector("img"/"video")` would grab.
 */
export function layerMediaSelector(layerId: string): string {
  const escaped = layerId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[data-layer-media="${escaped}"]`;
}
