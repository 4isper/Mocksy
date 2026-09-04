/// <reference lib="webworker" />

import { renderMockupToCanvas } from "@/lib/render/renderMockup";
import {
  OVERLAY_KEY_PREFIX,
  isSvgMimeType,
  type RenderImageSlot,
  type RenderWorkerPayload
} from "@/lib/render/renderWorkerProtocol";

/**
 * Bundled module worker that renders a full scene composite on an
 * OffscreenCanvas. Shares the exact drawing modules with the main-thread
 * path, so the output is pixel-identical; only media decoding differs
 * (createImageBitmap instead of HTMLImageElement).
 */

/** Decodes one asset URL to a drawable CanvasImageSource. SVG assets must
 *  arrive pre-decoded in `predecoded` (workers have no Image constructor and
 *  createImageBitmap refuses SVG blobs — a silently-missing device skin would
 *  also drop its drop shadow from every raster export). */
async function decodeImageSource(url: string, predecoded: Map<string, ImageBitmap>): Promise<CanvasImageSource> {
  const pre = predecoded.get(url);
  if (pre) return pre;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch render asset: ${url}`);
  const blob = await res.blob();
  if (isSvgMimeType(blob.type)) {
    // No pre-decoded bitmap for an SVG: fail loudly so the caller falls back
    // to the main-thread render instead of exporting a skinless frame.
    throw new Error(`SVG asset was not pre-decoded for the worker: ${url}`);
  }
  return createImageBitmap(blob);
}

async function decodeSlots(slots: RenderImageSlot[], predecoded: Map<string, ImageBitmap>): Promise<Map<string, CanvasImageSource>> {
  const sources = new Map<string, CanvasImageSource>();
  await Promise.all(
    slots.map(async (slot) => {
      sources.set(slot.key, await decodeImageSource(slot.url, predecoded));
    })
  );
  return sources;
}

/** Decodes an optional asset; a failure degrades to null (the render then
 *  proceeds without it) instead of aborting the whole export. */
async function decodeOptional(url: string | null, predecoded: Map<string, ImageBitmap>): Promise<CanvasImageSource | null> {
  if (!url) return null;
  try {
    return await decodeImageSource(url, predecoded);
  } catch {
    return null;
  }
}

self.onmessage = async (event: MessageEvent<RenderWorkerPayload>) => {
  const payload = event.data;
  try {
    const predecoded = new Map<string, ImageBitmap>((payload.bitmaps ?? []).map((e) => [e.url, e.bitmap]));
    const bitmaps = await decodeSlots(payload.images, predecoded);

    const layerMedias = new Map<string, CanvasImageSource | null>();
    const frameOverlays = new Map<string, CanvasImageSource | null>();

    for (const [key, bitmap] of bitmaps) {
      if (key.startsWith(OVERLAY_KEY_PREFIX)) {
        frameOverlays.set(key.slice(OVERLAY_KEY_PREFIX.length), bitmap);
      } else {
        layerMedias.set(key, bitmap);
      }
    }
    // Single-frame scenes carry their skin through the dedicated slot. The
    // skin is NOT optional: a failed decode must abort this worker render
    // (the caller falls back to the main-thread path) rather than silently
    // export a skinless frame without its drop shadow.
    const overlay = payload.overlayUrl ? await decodeImageSource(payload.overlayUrl, predecoded) : null;

    const backgroundImage = await decodeOptional(payload.backgroundImageUrl, predecoded);
    const watermarkImage = await decodeOptional(payload.watermarkImageUrl, predecoded);

    const canvas = new OffscreenCanvas(payload.width, payload.height);
    renderMockupToCanvas(
      canvas,
      payload.scene,
      layerMedias.get(payload.activeLayerId ?? "") ?? null,
      undefined,
      undefined,
      payload.frameWidth,
      payload.frameHeight,
      payload.pixelRatio,
      payload.transform,
      payload.backgroundFill,
      overlay,
      backgroundImage,
      layerMedias.size > 0 ? layerMedias : undefined,
      frameOverlays.size > 0 ? frameOverlays : undefined,
      payload.activeLayerId,
      watermarkImage
    );

    const blob = await canvas.convertToBlob({ type: payload.mimeType });
    self.postMessage({ id: payload.id, blob });
  } catch (err) {
    self.postMessage({ id: payload.id, error: err instanceof Error ? err.message : "Render failed" });
  }
};
