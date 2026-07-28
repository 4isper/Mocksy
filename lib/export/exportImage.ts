"use client";

import type { EditorScene } from "@/lib/types/editor";
import { loadImage, renderMockupToCanvas, type RenderTransform } from "@/lib/export/renderMockup";
import { getFrameSpec } from "@/lib/render/frames";
import { sampleVideoTransform } from "@/lib/render/videoComposer";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Transform for the exported PNG. An animated scene samples its mid-animation
 * frame (progress 0.5) so the static image matches what the user sees
 * animating in the live preview, instead of always snapping to the base zoom.
 */
export function resolveExportTransform(scene: EditorScene): RenderTransform {
  const active = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  if (!active) return { zoom: 1, offsetX: 0, offsetY: 0 };
  if (active.animationPreset === "none") {
    return { zoom: active.zoom, offsetX: active.mediaOffsetX, offsetY: active.mediaOffsetY };
  }
  const sampled = sampleVideoTransform(active, 0.5);
  return { zoom: sampled.zoom, offsetX: sampled.x, offsetY: sampled.y };
}

export function waitForImage(img: HTMLImageElement, timeoutMs = 10000) {
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
 * Renders the current scene to a PNG `Blob` at the preview's pixel ratio,
 * reusing the exact geometry the preview uses (frame box, zoom/animation
 * transform, overlay skin, transparent background). Returns null (and routes the
 * reason through `onError`) when the preview can't be measured or the canvas
 * can't be read. Shared by `exportImage` (download) and `copyPngToClipboard`.
 */
export async function renderSceneToPngBlob(
  scene: EditorScene,
  containerId: string,
  onError?: (message: string) => void,
  /** Pixel ratio for the export. Defaults to `Math.max(2, devicePixelRatio)`
   *  when omitted so existing callers keep 2× output on standard displays. */
  scale?: number
): Promise<Blob | null> {
  try {
    const node = document.getElementById(containerId);
    if (!node) {
      onError?.("Preview area not found.");
      return null;
    }

    const video = node.querySelector("video");
    const img = node.querySelector("img");
    const frameElement = node.querySelector<HTMLElement>("[data-mockup-frame]");
    const isMultiFrame = scene.frameInstances.length > 0;
    const active = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
    let media: CanvasImageSource | null = null;

    // A hidden active layer renders nothing, matching the preview.
    if (!active?.hidden) {
      if (video instanceof HTMLVideoElement && video.readyState >= 2) {
        media = video;
      } else if (img instanceof HTMLImageElement) {
        await waitForImage(img);
        media = img;
      }
    }

    const baseFrameWidth = isMultiFrame ? undefined : frameElement?.offsetWidth;
    const baseFrameHeight = isMultiFrame ? undefined : frameElement?.offsetHeight;
    if (!isMultiFrame && (!baseFrameWidth || !baseFrameHeight)) {
      onError?.("Frame has no measurable size.");
      return null;
    }

    const containerWidth = node.clientWidth;
    const containerHeight = node.clientHeight;
    if (!containerWidth || !containerHeight) {
      onError?.("Preview has no measurable size.");
      return null;
    }

    const spec = getFrameSpec(scene.frame);
    let overlay: HTMLImageElement | null = null;
    if (spec.isOverlay && spec.asset) {
      try {
        overlay = await loadImage(spec.asset);
      } catch {
        overlay = null;
      }
    }

    const pixelRatio = typeof scale === "number" && scale > 0 ? scale : Math.max(2, window.devicePixelRatio || 1);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(containerWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(containerHeight * pixelRatio));

    const frameWidth = baseFrameWidth ? Math.max(1, Math.round(baseFrameWidth * pixelRatio)) : undefined;
    const frameHeight = baseFrameHeight ? Math.max(1, Math.round(baseFrameHeight * pixelRatio)) : undefined;

    let backgroundImage: HTMLImageElement | null = null;
    if (scene.backgroundMode === "image" && scene.backgroundImageUrl) {
      try {
        backgroundImage = await loadImage(scene.backgroundImageUrl);
      } catch {
        backgroundImage = null;
      }
    }

    const transform = resolveExportTransform(scene);

    // For multi-frame mode, load media for each frame's layer
    let layerMedias: Map<string, CanvasImageSource | null> | undefined;
    // For multi-frame mode, load overlay for each frame with isOverlay spec
    let frameOverlays: Map<string, CanvasImageSource | null> | undefined;
    if (scene.frameInstances.length > 0) {
      layerMedias = new Map();
      frameOverlays = new Map();
      for (const inst of scene.frameInstances) {
        const layer = scene.layers.find((l) => l.id === inst.layerId);
        if (layer?.mediaUrl) {
          try {
            const loaded = await loadImage(layer.mediaUrl);
            layerMedias.set(layer.id, loaded);
          } catch {
            layerMedias.set(layer.id, null);
          }
        }
        // Load overlay for this frame instance if it uses an overlay frame
        const instSpec = getFrameSpec(inst.frame);
        if (instSpec.isOverlay && instSpec.asset) {
          try {
            const ov = await loadImage(instSpec.asset);
            if (layer?.id) frameOverlays.set(layer.id, ov);
          } catch {
            // Overlay failed to load - leave empty
          }
        }
      }
    }

    renderMockupToCanvas(
      canvas,
      scene,
      media,
      undefined,
      undefined,
      frameWidth,
      frameHeight,
      pixelRatio,
      transform,
      undefined,
      overlay,
      backgroundImage,
      layerMedias,
      frameOverlays
    );

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (!pngBlob) {
      onError?.("Failed to render PNG.");
      return null;
    }
    return pngBlob;
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "Image export failed.");
    return null;
  }
}

export async function exportImage(
  scene: EditorScene,
  containerId: string,
  filename: string,
  onError?: (message: string) => void,
  /** Export pixel ratio (1×/2×/4×), read from the editor's PNG scale control. */
  scale?: number
) {
  const blob = await renderSceneToPngBlob(scene, containerId, onError, scale);
  if (blob) downloadBlob(blob, `${filename}.png`);
}

/**
 * Copies a PNG snapshot of the scene to the system clipboard. Handy for pasting
 * a mockup straight into Slack/Notion without a file download. Needs a secure
 * context (https or localhost) and the Clipboard Image write permission; falls
 * back through `onError` when unavailable.
 */
export async function copyPngToClipboard(
  scene: EditorScene,
  containerId: string,
  onError?: (message: string) => void,
  onStatus?: (message: string) => void,
  /** Export pixel ratio (1×/2×/4×), read from the editor's PNG scale control. */
  scale?: number
) {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard || typeof ClipboardItem === "undefined") {
      onError?.("Clipboard isn't available here (open over https or localhost).");
      return;
    }
    const blob = await renderSceneToPngBlob(scene, containerId, onError, scale);
    if (!blob) return;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    onStatus?.("Copied PNG to clipboard");
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "Could not copy the image.");
  }
}
