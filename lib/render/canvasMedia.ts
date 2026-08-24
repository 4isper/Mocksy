import type { MediaLayer } from "@/lib/types/editor";
import type { FrameBox } from "./frameGeometry";
import { roundedRectPath } from "./canvasDrawing";

const imageCache = new Map<string, Promise<HTMLImageElement>>();
/** Decoded elements are large; an unbounded session-long cache would pin every
 *  image ever shown. LRU-capped: the working set (active scene + recent
 *  exports) fits easily, stale media gets evicted. */
export const IMAGE_CACHE_LIMIT = 32;
/** Detached media loads must never hang the export forever (damaged index,
 *  codec quirk): reject so callers can degrade gracefully instead. */
const MEDIA_LOAD_TIMEOUT = 10_000;

function touchCache(src: string, pending: Promise<HTMLImageElement>): Promise<HTMLImageElement> {
  // Re-insert to bump recency for keys that are already cached.
  imageCache.delete(src);
  imageCache.set(src, pending);
  while (imageCache.size > IMAGE_CACHE_LIMIT) {
    const oldest = imageCache.keys().next().value;
    if (oldest === undefined) break;
    imageCache.delete(oldest);
  }
  return pending;
}

/** Loads an image, reusing a cached element for the same source. Media is
 *  held as immutable data URLs, so a cached element can be shared safely
 *  across the preview and every export path without re-decoding. Failed
 *  loads are evicted so a transient error doesn't poison the cache. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return touchCache(src, cached);
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      imageCache.delete(src);
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
  return touchCache(src, pending);
}

/** Drops every cached image element. */
export function clearImageCache(): void {
  imageCache.clear();
}

export function loadVideoFrame(url: string, time = 0): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    const target = Math.max(0, time || 0);
    let settled = false;
    // A seek/metadata event that never fires (damaged file) must not leave the
    // export promise pending forever.
    const timer = setTimeout(() => {
      fail(new Error(`Timed out loading video: ${url}`));
      video.remove();
    }, MEDIA_LOAD_TIMEOUT);
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.pause();
      resolve(video);
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    };
    video.onerror = () => fail(new Error(`Failed to load video: ${url}`));
    video.onloadedmetadata = () => {
      const seekTo = target > 0 && video.duration && target < video.duration ? target : 0.001;
      video.onseeked = done;
      video.currentTime = seekTo;
    };
    video.src = url;
  });
}

export async function drawFrameMediaFromLayer(
  ctx: CanvasRenderingContext2D,
  layer: MediaLayer | undefined,
  box: FrameBox,
  dpiScale: number
): Promise<void> {
  if (!layer?.mediaUrl) return;
  const { innerX, innerY, innerW, innerH, innerRadius } = box;
  try {
    const media = await loadImage(layer.mediaUrl);
    ctx.save();
    roundedRectPath(ctx, innerX, innerY, innerW, innerH, innerRadius);
    ctx.clip();
    const fit = layer.mediaFit ?? "cover";
    const mw = media.width || innerW;
    const mh = media.height || innerH;
    const scale = fit === "contain" ? Math.min(innerW / mw, innerH / mh) : Math.max(innerW / mw, innerH / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    const offsetX = layer.mediaOffsetX ?? 0;
    const offsetY = layer.mediaOffsetY ?? 0;
    const dx = innerX + (innerW - dw) / 2 + offsetX * (innerW - dw) / 2;
    const dy = innerY + (innerH - dh) / 2 + offsetY * (innerH - dh) / 2;
    const rotation = layer.rotation ?? 0;
    if (rotation) {
      ctx.translate(innerX + innerW / 2, innerY + innerH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-(innerX + innerW / 2), -(innerY + innerH / 2));
    }
    ctx.drawImage(media, dx, dy, dw, dh);
    ctx.restore();
  } catch {
    // Media load failed - leave empty
  }
}