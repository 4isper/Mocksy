/// <reference lib="webworker" />

import { renderMockupToCanvas } from "@/lib/render/renderMockup";
import {
  ACTIVE_MEDIA_KEY,
  OVERLAY_KEY_PREFIX,
  type RenderImageSlot,
  type RenderWorkerPayload
} from "@/lib/render/renderWorkerProtocol";

/**
 * Bundled module worker that renders a full scene composite on an
 * OffscreenCanvas. Shares the exact drawing modules with the main-thread
 * path, so the output is pixel-identical; only media decoding differs
 * (createImageBitmap instead of HTMLImageElement).
 */

async function decodeSlots(slots: RenderImageSlot[]): Promise<Map<string, ImageBitmap>> {
  const bitmaps = new Map<string, ImageBitmap>();
  await Promise.all(
    slots.map(async (slot) => {
      const res = await fetch(slot.url);
      if (!res.ok) throw new Error(`Failed to fetch render asset: ${slot.url}`);
      bitmaps.set(slot.key, await createImageBitmap(await res.blob()));
    })
  );
  return bitmaps;
}

async function decodeOptional(url: string | null): Promise<ImageBitmap | null> {
  if (!url) return null;
  try {
    return await createImageBitmap(await (await fetch(url)).blob());
  } catch {
    return null;
  }
}

self.onmessage = async (event: MessageEvent<RenderWorkerPayload>) => {
  const payload = event.data;
  try {
    const bitmaps = await decodeSlots(payload.images);

    const layerMedias = new Map<string, CanvasImageSource | null>();
    const frameOverlays = new Map<string, CanvasImageSource | null>();
    let media: CanvasImageSource | null = null;

    for (const [key, bitmap] of bitmaps) {
      if (key.startsWith(OVERLAY_KEY_PREFIX)) {
        frameOverlays.set(key.slice(OVERLAY_KEY_PREFIX.length), bitmap);
      } else {
        layerMedias.set(key, bitmap);
        if (key === ACTIVE_MEDIA_KEY) media = bitmap;
      }
    }
    // Single-frame scenes carry their skin through the dedicated slot.
    const overlay = payload.overlayUrl ? await decodeOptional(payload.overlayUrl) : null;

    const backgroundImage = await decodeOptional(payload.backgroundImageUrl);
    const watermarkImage = await decodeOptional(payload.watermarkImageUrl);

    const canvas = new OffscreenCanvas(payload.width, payload.height);
    renderMockupToCanvas(
      canvas,
      payload.scene,
      media,
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
