"use client";

import type { EditorScene, ExportSize, MediaLayer } from "@/lib/types/editor";
import { loadImage } from "@/lib/render/canvasMedia";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { recordCanvasToWebm } from "@/lib/export/videoRecorder";
import { QUALITY, resolvePixelRatio, toEvenDimension } from "@/lib/export/videoExportHelpers";
import { layerMediaSelector } from "@/lib/export/exportImageCore";
import { fitRatioForCustomSize, intrinsicExportSize } from "@/lib/export/exportSize";
import { singleFrameCssSize } from "@/lib/render/frameGeometry";
import { isVisibleFrameInstance } from "@/lib/render/frameGeometry";

// Barrel for the video-export pipeline. The pieces live in focused modules:
//   - ffmpegLoader.ts          FFmpeg singleton lifecycle + temp-file cleanup
//   - videoExportHelpers.ts    pure capture/encoding tuning helpers
//   - videoRecorder.ts         MediaRecorder capture loop
//   - exportVideoCore.ts       captureWebm orchestration (this file)
// Re-exports keep the existing public surface (used by exportVideo.ts and
// tests) stable.
export * from "@/lib/export/ffmpegLoader";
export * from "@/lib/export/videoExportHelpers";

/** Detached <video> loads must reject instead of hanging the export forever. */
const MEDIA_LOAD_TIMEOUT = 10_000;

/** Creates a detached <video> for one layer's video export, seeked to the
 *  layer's trim start. The CORS mode is captured at fetch start, so
 *  crossOrigin must be set BEFORE src: assigning it afterwards is a silent
 *  no-op and an uncors http(s) source would taint the canvas (SecurityError
 *  at captureStream) instead of loading anonymously. */
async function loadExportVideo(layer: MediaLayer, muted: boolean): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.src = layer.mediaUrl!;
  v.muted = muted;
  v.playbackRate = Math.max(0.5, Math.min(2, layer.playbackSpeed ?? 1));
  v.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    // A stalled load/seek must not hang the export forever.
    const timer = setTimeout(() => reject(new Error("Timed out loading video for export")), MEDIA_LOAD_TIMEOUT);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    v.onloadedmetadata = () => {
      const start = Math.max(0, layer.videoTrimStart || 0);
      if (start > 0) {
        v.currentTime = start;
        v.onseeked = finish;
      } else {
        finish();
      }
    };
    v.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Unable to load video for export"));
    };
  });
  return v;
}

/**
 * Captures the preview animation to a WebM blob, shared by the MP4, GIF, WebM
 * and animated-WebP exporters. Builds the off-screen canvas, resolves the media
 * element (a detached <video> for video scenes, or the one already in the
 * preview), and records via MediaRecorder. Returns null if no frames were
 * captured.
 */
export async function captureWebm(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId,
  signal?: AbortSignal
): Promise<Blob | null> {
  const previewNode = document.getElementById("preview-canvas");
  if (!previewNode) throw new Error("Preview area not found.");

  const exportQuality = (scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
  const quality = QUALITY[exportQuality] ?? QUALITY.medium;
  const hasCustomSize = customSize !== null && customSize !== undefined && customSize.width > 0 && customSize.height > 0;
  // Custom resolutions record the canvas at exactly that size and scale the
  // frame by the uniform fit ratio (aspect-preserving, letterboxed), matching
  // the PNG export. Otherwise the quality tier and export scale drive the size.
  // Both anchor to the scene's intrinsic artboard (exportSize.ts), so output
  // size never depends on the preview's on-screen dimensions.
  const base = intrinsicExportSize(scene, 1);
  const pixelRatio = hasCustomSize
    ? fitRatioForCustomSize(scene, customSize)
    : resolvePixelRatio(exportQuality) * (typeof scale === "number" && scale > 0 ? scale / 2 : 1);
  const canvas = document.createElement("canvas");
  let canvasW = Math.max(hasCustomSize ? 1 : 640, Math.round(hasCustomSize ? customSize.width : base.width * pixelRatio));
  let canvasH = Math.max(hasCustomSize ? 1 : 360, Math.round(hasCustomSize ? customSize.height : base.height * pixelRatio));
  // Cap the auto-sized video canvas so a high-DPI scene doesn't hand the WASM
  // H.264 encoder a 2-3k (multi-megapixel) frame — a 4-minute encode for a
  // short clip. Full HD's long edge is more than enough detail for a moving
  // mockup and encodes in a fraction of the time. Explicit custom resolutions
  // are respected as the user chose them exactly.
  if (!hasCustomSize) {
    const maxEdge = 1440;
    if (canvasW >= canvasH && canvasW > maxEdge) {
      canvasH = Math.round((canvasH * maxEdge) / canvasW);
      canvasW = maxEdge;
    } else if (canvasH > canvasW && canvasH > maxEdge) {
      canvasW = Math.round((canvasW * maxEdge) / canvasH);
      canvasH = maxEdge;
    }
  }
  // H.264/yuv420p (MP4 re-encode) rejects odd dimensions, so the recorded
  // canvas must be even in every path — quality tiers, custom sizes included.
  canvasW = toEvenDimension(canvasW);
  canvasH = toEvenDimension(canvasH);
  canvas.width = canvasW;
  canvas.height = canvasH;

  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  // Resolve the active layer's media element by identity, never by DOM order:
  // the preview also holds device-skin overlays, the watermark logo and other
  // layers' media, which a blind querySelector would export instead.
  let sourceVideo: HTMLVideoElement | null = null;
  let media: HTMLVideoElement | HTMLImageElement | null = null;
  // Per-layer media for the render: single-frame scenes paint EVERY visible
  // layer's media (the preview stacks them), multi-frame scenes paint each
  // instance's layer. Videos play during capture; images load statically.
  let layerMedias: Map<string, CanvasImageSource | null> | undefined;
  let frameOverlays: Map<string, CanvasImageSource | null> | undefined;
  // Detached <video> elements created for the export: they play while the
  // recorder samples them, so the finally block below must stop and drop
  // every one of them after the capture.
  const instanceVideos: HTMLVideoElement[] = [];

  if (scene.frameInstances.length === 0) {
    layerMedias = new Map();
    for (const layer of scene.layers) {
      if (layer.hidden || !layer.mediaUrl) continue;
      try {
        if (isVideoLayer(layer)) {
          const v = await loadExportVideo(
            layer,
            layer.id === activeLayer?.id ? (activeLayer?.videoMuted !== false) : true
          );
          if (layer.id === activeLayer?.id) {
            // The active layer's video also drives the recorder's stop
            // conditions and (unmuted) its audio capture — keep it in `media`.
            sourceVideo = v;
            media = v;
          } else {
            // Must be played before the recorder samples it: an element that
            // never plays stays undecoded, and drawImage renders an empty
            // frame.
            v.play().catch(() => null);
            instanceVideos.push(v);
          }
          layerMedias.set(layer.id, v);
        } else {
          // Reuse the element already in the preview when present.
          const el = previewNode.querySelector(layerMediaSelector(layer.id));
          if (el instanceof HTMLImageElement) {
            layerMedias.set(layer.id, el);
          } else {
            layerMedias.set(layer.id, await loadImage(layer.mediaUrl));
          }
          if (layer.id === activeLayer?.id && layerMedias.get(layer.id) instanceof HTMLImageElement) {
            media = layerMedias.get(layer.id) as HTMLImageElement;
          }
        }
      } catch {
        layerMedias.set(layer.id, null);
      }
    }
  } else if (activeLayer && isVideoLayer(activeLayer) && activeLayer.mediaUrl) {
    sourceVideo = await loadExportVideo(activeLayer, activeLayer.videoMuted !== false);
    media = sourceVideo;
  } else {
    const mediaInPreview = activeLayer ? previewNode.querySelector(layerMediaSelector(activeLayer.id)) : null;
    if (mediaInPreview instanceof HTMLImageElement) {
      media = mediaInPreview;
    } else if (mediaInPreview instanceof HTMLVideoElement) {
      media = mediaInPreview;
    }
  }

  const isMultiFrame = scene.frameInstances.length > 0;
  // Frame box from the same pure math as the CSS layout — no DOM measuring.
  const frameCss = isMultiFrame ? undefined : singleFrameCssSize(scene, base.width, base.height);
  const frameWidth = frameCss ? Math.max(1, Math.round(frameCss.w * pixelRatio)) : undefined;
  const frameHeight = frameCss ? Math.max(1, Math.round(frameCss.h * pixelRatio)) : undefined;

  // For multi-frame mode, load media for each frame's layer and per-instance overlays
  if (scene.frameInstances.length > 0) {
    layerMedias = new Map();
    frameOverlays = new Map();
    // Hidden layers' instances aren't rendered — skip their media too. All
    // loads run concurrently: each video/image decodes in parallel instead of
    // queueing behind the previous frame's metadata round-trip.
    const visible = scene.frameInstances.filter((inst) => isVisibleFrameInstance(scene, inst));
    const loaded = await Promise.all(
      visible.map(async (inst) => {
        const layer = scene.layers.find((l) => l.id === inst.layerId);
        let media: CanvasImageSource | null = null;
        let hasMedia = false;
        if (layer?.mediaUrl) {
          hasMedia = true;
          try {
            if (isVideoLayer(layer)) {
              // Create a detached video element for the export. It must be
              // seeked to its trim start AND played: an element that never
              // plays stays undecoded, and drawImage of an undecoded video
              // renders an empty frame.
              const v = document.createElement("video");
              // crossOrigin before src — the CORS mode is captured at fetch start.
              v.crossOrigin = "anonymous";
              v.src = layer.mediaUrl;
              v.muted = true;
              v.playbackRate = Math.max(0.5, Math.min(2, layer.playbackSpeed ?? 1));
              v.playsInline = true;
              try {
                await new Promise<void>((resolve, reject) => {
                  const timer = setTimeout(() => reject(new Error("Timed out loading video for export")), MEDIA_LOAD_TIMEOUT);
                  const finish = () => {
                    clearTimeout(timer);
                    resolve();
                  };
                  v.onloadedmetadata = () => {
                    const trimStart = Math.max(0, layer?.videoTrimStart || 0);
                    if (trimStart > 0) {
                      v.onseeked = finish;
                      v.currentTime = trimStart;
                    } else {
                      finish();
                    }
                  };
                  v.onerror = () => {
                    clearTimeout(timer);
                    reject(new Error("Unable to load video for export"));
                  };
                });
              } catch (err) {
                // The element never joined the recording; drop it before the
                // outer catch degrades this slot to null.
                v.remove();
                throw err;
              }
              v.play().catch(() => null);
              instanceVideos.push(v);
              media = v;
            } else {
              media = await loadImage(layer.mediaUrl);
            }
          } catch {
            media = null;
          }
        }
        let overlay: CanvasImageSource | null = null;
        let hasOverlay = false;
        const instSpec = getFrameSpec(inst.frame, scene.customFrame, inst.material);
        if (instSpec.isOverlay && instSpec.asset) {
          try {
            overlay = await loadImage(instSpec.asset);
            hasOverlay = true;
          } catch {
            // overlay failed to load
          }
        }
        return { inst, layerId: layer?.id ?? null, media, hasMedia, overlay, hasOverlay };
      })
    );
    // Apply in instance order. Skins are keyed by instance id (two instances
    // can share a layer with different materials); media stays keyed by layer
    // id (shared between instances).
    for (const { inst, layerId, media, hasMedia, overlay, hasOverlay } of loaded) {
      if (hasMedia && layerId) layerMedias.set(layerId, media);
      if (hasOverlay && overlay && inst.id) frameOverlays.set(inst.id, overlay);
    }
  }

  let webmBlob: Blob | null = null;
  try {
    webmBlob = await recordCanvasToWebm(scene, canvas, media, frameWidth, frameHeight, pixelRatio, onStatus, onProgress, layerMedias, frameOverlays, activeLayerId, signal);
  } finally {
    if (sourceVideo) {
      sourceVideo.pause();
      // Only the element is ours — the URL belongs to the layer and stays
      // alive in the preview after the export. Revoking it here would blank
      // the preview's <video> mid-session; dropping the element reference
      // lets GC reclaim it.
      sourceVideo.remove();
    }
    // Same ownership rule for the multi-frame elements created above: they
    // keep decoding (and playing!) until explicitly stopped.
    for (const v of instanceVideos) {
      v.pause();
      v.remove();
    }
  }
  return webmBlob;
}

/**
 * Captures the preview animation to a WebM blob. An empty first pass is usually
 * a one-off GPU/compositor race (the stream delivers zero frames once), so it
 * retries a single time before giving up.
 */
export async function captureWebmWithRetry(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId,
  signal?: AbortSignal
): Promise<Blob | null> {
  const first = await captureWebm(scene, scale, onStatus, onProgress, customSize, activeLayerId, signal);
  if (first && first.size > 0) return first;
  signal?.throwIfAborted();
  return captureWebm(scene, scale, onStatus, onProgress, customSize, activeLayerId, signal);
}
