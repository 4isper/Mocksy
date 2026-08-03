"use client";

import type { EditorScene, ExportSize } from "@/lib/types/editor";
import { loadImage } from "@/lib/render/canvasMedia";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { recordCanvasToWebm } from "@/lib/export/videoRecorder";
import { QUALITY, resolvePixelRatio } from "@/lib/export/videoExportHelpers";

// Barrel for the video-export pipeline. The pieces live in focused modules:
//   - ffmpegLoader.ts          FFmpeg singleton lifecycle + temp-file cleanup
//   - videoExportHelpers.ts    pure capture/encoding tuning helpers
//   - videoRecorder.ts         MediaRecorder capture loop
//   - exportVideoCore.ts       captureWebm orchestration (this file)
// Re-exports keep the existing public surface (used by exportVideo.ts and
// tests) stable.
export * from "@/lib/export/ffmpegLoader";
export * from "@/lib/export/videoExportHelpers";

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
  activeLayerId: string | null = scene.activeLayerId
): Promise<Blob | null> {
  const previewNode = document.getElementById("preview-canvas");
  if (!previewNode) throw new Error("Preview area not found.");

  const exportQuality = (scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
  const quality = QUALITY[exportQuality] ?? QUALITY.medium;
  const hasCustomSize = customSize !== null && customSize !== undefined && customSize.width > 0 && customSize.height > 0;
  // Custom resolutions record the canvas at exactly that size and scale the
  // frame by the uniform fit ratio (aspect-preserving, letterboxed), matching
  // the PNG export. Otherwise the quality tier and export scale drive the size.
  const pixelRatio = hasCustomSize
    ? Math.min(customSize.width / previewNode.clientWidth, customSize.height / previewNode.clientHeight)
    : resolvePixelRatio(exportQuality) * (typeof scale === "number" && scale > 0 ? scale / 2 : 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(hasCustomSize ? 1 : 640, Math.round(hasCustomSize ? customSize.width : previewNode.clientWidth * pixelRatio));
  canvas.height = Math.max(hasCustomSize ? 1 : 360, Math.round(hasCustomSize ? customSize.height : previewNode.clientHeight * pixelRatio));

  const videoInPreview = previewNode.querySelector("video");
  const imageInPreview = previewNode.querySelector("img");
  // When exporting a video scene we create a detached <video> from the active
  // video layer's URL; track it so we can stop/remove it and free its blob: URL
  // afterwards. For image scenes we reuse the element already in the preview.
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  let sourceVideo: HTMLVideoElement | null = null;
  let media: HTMLVideoElement | HTMLImageElement | null = null;
  if (activeLayer && isVideoLayer(activeLayer) && activeLayer.mediaUrl) {
    sourceVideo = document.createElement("video");
    sourceVideo.src = activeLayer.mediaUrl;
    sourceVideo.crossOrigin = "anonymous";
    sourceVideo.muted = activeLayer?.videoMuted !== false;
    sourceVideo.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      sourceVideo!.onloadedmetadata = () => {
        const start = Math.max(0, activeLayer?.videoTrimStart || 0);
        if (start > 0) {
          sourceVideo!.currentTime = start;
          sourceVideo!.onseeked = () => resolve();
        } else {
          resolve();
        }
      };
      sourceVideo!.onerror = () => reject(new Error("Unable to load video for export"));
    });
    media = sourceVideo;
  } else if (imageInPreview instanceof HTMLImageElement) {
    media = imageInPreview;
  } else if (videoInPreview instanceof HTMLVideoElement) {
    media = videoInPreview;
  }

  const isMultiFrame = scene.frameInstances.length > 0;
  const frameElement = previewNode.querySelector<HTMLElement>("[data-mockup-frame]");
  const frameWidth = isMultiFrame ? undefined : frameElement ? Math.max(1, Math.round(frameElement.offsetWidth * pixelRatio)) : undefined;
  const frameHeight = isMultiFrame ? undefined : frameElement ? Math.max(1, Math.round(frameElement.offsetHeight * pixelRatio)) : undefined;

  // For multi-frame mode, load media for each frame's layer and per-instance overlays
  let layerMedias: Map<string, CanvasImageSource | null> | undefined;
  let frameOverlays: Map<string, CanvasImageSource | null> | undefined;
  if (isMultiFrame) {
    layerMedias = new Map();
    frameOverlays = new Map();
    for (const inst of scene.frameInstances) {
      const layer = scene.layers.find((l) => l.id === inst.layerId);
      if (layer?.mediaUrl) {
        try {
          const isVideo = isVideoLayer(layer);
          if (isVideo) {
            // Create a detached video element for the export. It must be
            // seeked to its trim start AND played: an element that never
            // plays stays undecoded, and drawImage of an undecoded video
            // renders an empty frame.
            const v = document.createElement("video");
            v.src = layer.mediaUrl;
            v.crossOrigin = "anonymous";
            v.muted = true;
            v.playsInline = true;
            await new Promise<void>((resolve, reject) => {
              v.onloadedmetadata = () => {
                const trimStart = Math.max(0, layer?.videoTrimStart || 0);
                if (trimStart > 0) {
                  v.onseeked = () => resolve();
                  v.currentTime = trimStart;
                } else {
                  resolve();
                }
              };
              v.onerror = () => reject();
            });
            v.play().catch(() => null);
            layerMedias.set(layer.id, v);
          } else {
            const img = await loadImage(layer.mediaUrl);
            layerMedias.set(layer.id, img);
          }
        } catch {
          layerMedias.set(layer.id, null);
        }
      }
      const instSpec = getFrameSpec(inst.frame, scene.customFrame);
      if (instSpec.isOverlay && instSpec.asset) {
        try {
          const ov = await loadImage(instSpec.asset);
          if (layer?.id) frameOverlays.set(layer.id, ov);
        } catch {
          // overlay failed to load
        }
      }
    }
  }

  let webmBlob: Blob | null = null;
  try {
    webmBlob = await recordCanvasToWebm(scene, canvas, media, frameElement, pixelRatio, onStatus, onProgress, layerMedias, frameOverlays, activeLayerId);
  } finally {
    if (sourceVideo) {
      sourceVideo.pause();
      if (sourceVideo.src.startsWith("blob:")) URL.revokeObjectURL(sourceVideo.src);
      sourceVideo.remove();
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
  activeLayerId: string | null = scene.activeLayerId
): Promise<Blob | null> {
  const first = await captureWebm(scene, scale, onStatus, onProgress, customSize, activeLayerId);
  if (first && first.size > 0) return first;
  return captureWebm(scene, scale, onStatus, onProgress, customSize, activeLayerId);
}
