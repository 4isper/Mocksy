"use client";

import type { EditorScene, ExportSize } from "@/lib/types/editor";
import { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
import { renderMockupToCanvas } from "@/lib/render/renderMockup";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { downloadBlob } from "@/lib/export/downloadBlob";
import { encodeCanvasToBlob } from "@/lib/export/offthreadEncode";
import { resolveExportTransform, waitForImage } from "@/lib/export/exportImageCore";
import { loadExportAssets } from "@/lib/export/exportAssets";

/**
 * Renders the current scene to a raster `Blob` (PNG or WebP) at the preview's
 * pixel ratio, reusing the exact geometry the preview uses (frame box,
 * zoom/animation transform, overlay skin, transparent background). Returns null
 * (and routes the reason through `onError`) when the preview can't be measured
 * or the canvas can't be read. Shared by `exportImage`, `exportWebp` and
 * `copyPngToClipboard`.
 */
export async function renderSceneToImageBlob(
  scene: EditorScene,
  containerId: string,
  mimeType: "image/png" | "image/webp",
  onError?: (message: string) => void,
  /** Pixel ratio for the export. Defaults to `Math.max(2, devicePixelRatio)`
   *  when omitted so existing callers keep 2× output on standard displays. */
  scale?: number,
  /** Absolute output size in pixels. When width/height > 0, overrides `scale`:
   *  the canvas is exactly that size and the frame scales to fit (keeping its
   *  aspect ratio, letterboxed within the canvas). */
  customSize?: ExportSize | null,
  /** Live layer selection from the store root; defaults to the scene snapshot. */
  activeLayerId: string | null = scene.activeLayerId
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
    const active = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
    let media: CanvasImageSource | null = null;

    // A hidden active layer renders nothing, matching the preview.
    if (!active?.hidden) {
      if (video instanceof HTMLVideoElement) {
        if (video.readyState >= 2) {
          media = video;
        } else if (active && isVideoLayer(active) && active.mediaUrl) {
          // Export fired before the preview video decoded; load a frame
          // explicitly instead of drawing an empty screen.
          try {
            media = await loadVideoFrame(active.mediaUrl, active.videoPosterTime ?? 0);
          } catch {
            media = null;
          }
        }
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

    const hasCustomSize = customSize !== null && customSize !== undefined && customSize.width > 0 && customSize.height > 0;
    // A custom resolution is rendered at exactly that canvas size; the frame is
    // scaled by the fit ratio (uniform, aspect-preserving) so it keeps its
    // on-screen proportion and is letterboxed when the aspect ratios differ.
    const pixelRatio = hasCustomSize
      ? Math.min(customSize.width / containerWidth, customSize.height / containerHeight)
      : typeof scale === "number" && scale > 0
        ? scale
        : Math.max(2, window.devicePixelRatio || 1);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(hasCustomSize ? customSize.width : containerWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(hasCustomSize ? customSize.height : containerHeight * pixelRatio));

    const frameWidth = baseFrameWidth ? Math.max(1, Math.round(baseFrameWidth * pixelRatio)) : undefined;
    const frameHeight = baseFrameHeight ? Math.max(1, Math.round(baseFrameHeight * pixelRatio)) : undefined;

    const { overlay, backgroundImage, watermarkImage } = await loadExportAssets(scene);

    const transform = resolveExportTransform(scene, activeLayerId);

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
            // An <img> can't decode a video URL; load video frames through a
            // <video> element that has actually decoded a frame, so the static
            // export shows the poster frame instead of an empty screen.
            if (isVideoLayer(layer)) {
              const videoFrame = await loadVideoFrame(layer.mediaUrl, layer.videoPosterTime ?? 0);
              layerMedias.set(layer.id, videoFrame);
            } else {
              const loaded = await loadImage(layer.mediaUrl);
              layerMedias.set(layer.id, loaded);
            }
          } catch {
            layerMedias.set(layer.id, null);
          }
        }
        // Load overlay for this frame instance if it uses an overlay frame
        const instSpec = getFrameSpec(inst.frame, scene.customFrame);
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
      frameOverlays,
      activeLayerId,
      watermarkImage
    );

    const imageBlob = await encodeCanvasToBlob(canvas, mimeType);
    if (!imageBlob) {
      onError?.("Failed to render image.");
      return null;
    }
    return imageBlob;
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "Image export failed.");
    return null;
  }
}

/** PNG-specific wrapper around `renderSceneToImageBlob`. */
export async function renderSceneToPngBlob(
  scene: EditorScene,
  containerId: string,
  onError?: (message: string) => void,
  scale?: number,
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId
): Promise<Blob | null> {
  return renderSceneToImageBlob(scene, containerId, "image/png", onError, scale, customSize, activeLayerId);
}

export async function exportImage(
  scene: EditorScene,
  containerId: string,
  filename: string,
  onError?: (message: string) => void,
  /** Export pixel ratio (1×/2×/4×), read from the editor's PNG scale control. */
  scale?: number,
  /** Absolute output size in pixels; overrides `scale` when set. */
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId
) {
  const blob = await renderSceneToPngBlob(scene, containerId, onError, scale, customSize, activeLayerId);
  if (blob) downloadBlob(blob, `${filename}.png`);
}

/**
 * Exports the scene as a static WebP image (lossy, ~half the PNG size for
 * photos). Rendered through the same canvas pipeline as PNG so the output
 * matches the preview pixel-for-pixel.
 */
export async function exportWebp(
  scene: EditorScene,
  containerId: string,
  filename: string,
  onError?: (message: string) => void,
  /** Export pixel ratio (1×/2×/4×), read from the editor's scale control. */
  scale?: number,
  /** Absolute output size in pixels; overrides `scale` when set. */
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId
) {
  const blob = await renderSceneToImageBlob(scene, containerId, "image/webp", onError, scale, customSize, activeLayerId);
  if (blob) downloadBlob(blob, `${filename}.webp`);
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
  scale?: number,
  /** Absolute output size in pixels; overrides `scale` when set. */
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId
) {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard || typeof ClipboardItem === "undefined") {
      onError?.("Clipboard isn't available here (open over https or localhost).");
      return;
    }
    const blob = await renderSceneToPngBlob(scene, containerId, onError, scale, customSize, activeLayerId);
    if (!blob) return;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    onStatus?.("Copied PNG to clipboard");
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "Could not copy the image.");
  }
}

// Re-exported for callers that previously imported these pure helpers from the
// image export module; they now live in exportImageCore (DOM-free, shared with
// the SVG/HTML exporters).
export { resolveExportTransform, waitForImage } from "@/lib/export/exportImageCore";
