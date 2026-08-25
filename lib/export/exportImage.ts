"use client";

import type { EditorScene, ExportSize } from "@/lib/types/editor";
import { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
import { renderMockupToCanvas } from "@/lib/render/renderMockup";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { downloadBlob } from "@/lib/export/downloadBlob";
import { encodeCanvasToBlob } from "@/lib/export/offthreadEncode";
import { renderSceneInWorker } from "@/lib/export/offthreadRender";
import {
  buildRenderWorkerPayload,
  canRenderSceneInWorker,
  isSvgAssetUrl,
  type RenderWorkerPayload
} from "@/lib/render/renderWorkerProtocol";
import { resolveExportTransform, waitForImage, layerMediaSelector } from "@/lib/export/exportImageCore";
import { fitRatioForCustomSize, intrinsicExportSize } from "@/lib/export/exportSize";
import { singleFrameCssSize, isVisibleFrameInstance } from "@/lib/render/frameGeometry";
import { loadExportAssets } from "@/lib/export/exportAssets";

/** Escapes a value for use inside a double-quoted CSS attribute selector. */
function escapeSelectorValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Rasterizes every SVG asset referenced by the payload (device skins, custom
 * frames, SVG media/backgrounds/watermarks) into transferred ImageBitmaps.
 * Workers can't decode SVG themselves (no Image constructor, and
 * createImageBitmap rejects SVG blobs), so this runs on the main thread right
 * before the payload ships. Failures are skipped: the worker then throws for
 * mandatory slots (overlay) or degrades optional ones, and the export falls
 * back to the main-thread render. Exported for tests — this contract is what
 * keeps device skins (and their drop shadows) alive in off-thread exports.
 */
export async function decodeSvgAssetsForWorker(payload: RenderWorkerPayload): Promise<Array<{ url: string; bitmap: ImageBitmap }>> {
  const urls = new Set<string>();
  if (payload.overlayUrl && isSvgAssetUrl(payload.overlayUrl)) urls.add(payload.overlayUrl);
  if (payload.backgroundImageUrl && isSvgAssetUrl(payload.backgroundImageUrl)) urls.add(payload.backgroundImageUrl);
  if (payload.watermarkImageUrl && isSvgAssetUrl(payload.watermarkImageUrl)) urls.add(payload.watermarkImageUrl);
  for (const slot of payload.images) {
    if (isSvgAssetUrl(slot.url)) urls.add(slot.url);
  }
  const out: Array<{ url: string; bitmap: ImageBitmap }> = [];
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const img = await loadImage(url);
        out.push({ url, bitmap: await createImageBitmap(img) });
      } catch {
        // Skipped: the worker's strict/optional decode handles the miss.
      }
    })
  );
  return out;
}

/**
 * Renders the current scene to a raster `Blob` (PNG, JPEG or WebP) at an
 * intrinsic, viewport-independent resolution (see exportSize.ts), reusing the
 * exact geometry the preview uses (frame box, zoom/animation transform, overlay
 * skin, transparent background). Returns null
 * (and routes the reason through `onError`) when the scene can't be rendered
 * or the canvas can't be read. Shared by `exportImage`, `exportWebp`,
 * `exportJpeg` and `copyPngToClipboard`.
 */
export async function renderSceneToImageBlob(
  scene: EditorScene,
  containerId: string,
  mimeType: "image/png" | "image/webp" | "image/jpeg",
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

    const isMultiFrame = scene.frameInstances.length > 0;
    const active = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
    let media: CanvasImageSource | null = null;

    // A hidden active layer renders nothing, matching the preview.
    if (!active?.hidden && active) {
      // Resolve the active layer's media element by identity, never by DOM
      // order: the preview container also holds unrelated <img>s (device-skin
      // overlays, the watermark logo) and other layers' media, which a blind
      // querySelector would export with this layer's fit/filters applied.
      const el = node.querySelector(layerMediaSelector(active.id));
      if (el instanceof HTMLVideoElement) {
        if (el.readyState >= 2) {
          media = el;
        } else if (isVideoLayer(active) && active.mediaUrl) {
          // Export fired before the preview video decoded; load a frame
          // explicitly instead of drawing an empty screen.
          try {
            media = await loadVideoFrame(active.mediaUrl, active.videoPosterTime ?? 0);
          } catch {
            media = null;
          }
        }
      } else if (el instanceof HTMLImageElement) {
        await waitForImage(el);
        media = el;
      }
    }

    const hasCustomSize = customSize !== null && customSize !== undefined && customSize.width > 0 && customSize.height > 0;
    // Exports anchor to the scene's intrinsic artboard (exportSize.ts), not to
    // the live preview's CSS box — so the output is identical regardless of
    // window size, browser page zoom or devicePixelRatio. The scale argument
    // is a pure quality multiplier on top of that base.
    const base = intrinsicExportSize(scene, 1);
    const pixelRatio = hasCustomSize
      ? fitRatioForCustomSize(scene, customSize)
      : typeof scale === "number" && scale > 0
        ? scale
        : 2;

    const canvas = document.createElement("canvas");
    const canvasWidth = Math.max(1, Math.round(hasCustomSize ? customSize.width : base.width * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(hasCustomSize ? customSize.height : base.height * pixelRatio));
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Frame box comes from the same pure math as the CSS layout instead of a
    // DOM measurement, keeping exports deterministic (and correct in tests).
    const frameCss = isMultiFrame ? undefined : singleFrameCssSize(scene, base.width, base.height);
    const frameWidth = frameCss ? Math.max(1, Math.round(frameCss.w * pixelRatio)) : undefined;
    const frameHeight = frameCss ? Math.max(1, Math.round(frameCss.h * pixelRatio)) : undefined;

    const transform = resolveExportTransform(scene, activeLayerId);

    // JPEG has no alpha channel: a transparent background would encode as
    // black. Flatten onto white instead (same call the video pipeline makes
    // with black) so both render paths — worker and main thread — agree.
    const jpegFlattenFill = mimeType === "image/jpeg" && scene.backgroundMode === "transparent" ? "#ffffff" : undefined;

    // Fast path: render the whole composite inside a worker so big exports
    // don't block input. Video layers can't decode off-thread and any worker
    // hiccup resolves null, both falling through to the synchronous path.
    if (canRenderSceneInWorker(scene, activeLayerId)) {
      const payload = buildRenderWorkerPayload({
        id: 0,
        scene,
        activeLayerId,
        width: canvasWidth,
        height: canvasHeight,
        pixelRatio,
        mimeType,
        transform,
        frameWidth,
        frameHeight,
        backgroundFill: jpegFlattenFill
      });
      if (payload) {
        const predecoded = await decodeSvgAssetsForWorker(payload);
        const blob = await renderSceneInWorker(payload, predecoded);
        if (blob) return blob;
      }
    }

    const { overlay, backgroundImage, watermarkImage } = await loadExportAssets(scene);

    // For multi-frame mode, load media for each frame's layer
    let layerMedias: Map<string, CanvasImageSource | null> | undefined;
    // For multi-frame mode, load overlay for each frame with isOverlay spec
    let frameOverlays: Map<string, CanvasImageSource | null> | undefined;
    if (scene.frameInstances.length > 0) {
      layerMedias = new Map();
      frameOverlays = new Map();
      for (const inst of scene.frameInstances) {
        // Hidden layers' instances aren't rendered — skip their media too.
        if (!isVisibleFrameInstance(scene, inst)) continue;
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
        const instSpec = getFrameSpec(inst.frame, scene.customFrame, inst.material);
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
      jpegFlattenFill,
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
 * Exports the scene as a static JPEG image (lossy, universally supported).
 * Rendered through the same canvas pipeline as PNG; a transparent background
 * is flattened onto white because JPEG has no alpha channel.
 */
export async function exportJpeg(
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
  const blob = await renderSceneToImageBlob(scene, containerId, "image/jpeg", onError, scale, customSize, activeLayerId);
  if (blob) downloadBlob(blob, `${filename}.jpg`);
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
