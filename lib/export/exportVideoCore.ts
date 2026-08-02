"use client";

import type { EditorScene, ExportSize, MediaLayer, VideoQuality } from "@/lib/types/editor";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { loadImage } from "@/lib/render/canvasMedia";
import { renderMockupToCanvas } from "@/lib/render/renderMockup";
import type { RenderTransform } from "@/lib/render/frameGeometry";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { downloadBlob } from "@/lib/export/downloadBlob";
import { sanitizeFilename } from "@/lib/export/filename";

export { sanitizeFilename };

let ffmpegSingleton: FFmpeg | null = null;

/** Returns the cached FFmpeg singleton, or null if not yet initialized. */
export function getFfmpegSingleton(): FFmpeg | null {
  return ffmpegSingleton;
}

async function getFfmpegInstance(onStatus?: (message: string) => void) {
  if (ffmpegSingleton) return ffmpegSingleton;

  const ffmpeg = new FFmpeg();
  onStatus?.("Preparing encoder…");
  await ffmpeg.load({
    coreURL: "/ffmpeg-core.js",
    wasmURL: "/ffmpeg-core.wasm",
  });
  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

export { getFfmpegInstance };

/** Releases the cached FFmpeg instance and its WASM worker. Call when the
  *  editor is torn down or memory is tight; the next export will re-load it. */
export function terminateFfmpeg() {
  if (!ffmpegSingleton) return;
  // terminate() exists on the real FFmpeg class; guard for test stubs.
  (ffmpegSingleton as unknown as { terminate?: () => void }).terminate?.();
  ffmpegSingleton = null;
}

/** Deletes temporary FFmpeg files best-effort; ignores cleanup errors. */
export async function cleanupFfmpegTempFiles(ffmpeg: FFmpeg | null, files: string[]) {
  if (!ffmpeg) return;
  try {
    for (const f of files) await ffmpeg.deleteFile(f);
  } catch {
    // ignore cleanup errors
  }
}

/** Media layer driving the export (active layer, falling back to the first). */
export function activeLayerOf(scene: EditorScene): MediaLayer | null {
  return scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0] ?? null;
}

/** Base export filename (media name with its extension stripped, or the default). */
export function exportBaseName(scene: EditorScene): string {
  const name = activeLayerOf(scene)?.mediaName || "mocksy-export";
  return sanitizeFilename(name.replace(/\.[^.]+$/, ""));
}

/**
 * Capture pixel ratio for a quality tier. Higher tiers keep more of the
 * device's native ratio; lower tiers downscale to shrink the output file.
 * The 2x floor keeps overlays readable; reads window.devicePixelRatio so it
 * can be stubbed in tests.
 */
export function resolvePixelRatio(videoQuality: VideoQuality): number {
  const quality = QUALITY[videoQuality] ?? QUALITY.medium;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(2, dpr) * quality.scale;
}

/**
 * Records video scenes for their trimmed length; still-image scenes play the
 * configured animation loop. Returns seconds.
 */
export function computeCaptureDuration(scene: EditorScene): number {
  const active = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const isVideo = active ? isVideoLayer(active) && active.mediaUrl != null : false;
  const fallbackSec = Math.max(0.5, scene.animationDurationMs / 1000);
  if (!isVideo || !active) return fallbackSec;
  const start = Math.max(0, active.videoTrimStart || 0);
  const end = active.videoTrimEnd > start ? active.videoTrimEnd : active.videoDuration;
  // Metadata may not have loaded yet (undefined/0) or a trim may be
  // misconfigured; never let a non-finite or empty duration collapse the
  // recording to zero frames.
  if (typeof end !== "number" || !isFinite(end) || end <= 0) return fallbackSec;
  return Math.max(0.2, end - start);
}

/** Picks the best WebM codec the browser can record. */
export function chooseWebmMimeType(): string {
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
    return "video/webm;codecs=vp9";
  }
  return "video/webm;codecs=vp8";
}

/**
 * Per-quality export tuning. fps and the VPX/webm capture rate stay fixed; the
 * MP4 encode quality (mpeg4 has no real bitrate control, so we use -q:v, lower
 * is better) and the capture resolution scale drive the output size. "high"
 * keeps the full device-pixel-ratio canvas; lower tiers downscale it.
 */
export const QUALITY: Record<VideoQuality, { qscale: number; scale: number }> = {
  low: { qscale: 10, scale: 0.5 },
  medium: { qscale: 5, scale: 0.75 },
  high: { qscale: 2, scale: 1 }
};

async function recordCanvasToWebm(
  scene: EditorScene,
  canvas: HTMLCanvasElement,
  media: HTMLVideoElement | HTMLImageElement | null,
  frameElement: HTMLElement | null,
  pixelRatio: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  layerMedias?: Map<string, CanvasImageSource | null>,
  frameOverlays?: Map<string, CanvasImageSource | null>
) {
  const spec = getFrameSpec(scene.frame);
  let overlay: CanvasImageSource | null = null;
  if (spec.isOverlay && spec.asset) {
    try {
      overlay = await loadImage(spec.asset);
    } catch {
      overlay = null;
    }
  }

  // Annotations are drawn from the scene automatically; the background image
  // must be preloaded and passed in (the canvas renderer is synchronous).
  let backgroundImage: CanvasImageSource | null = null;
  if (scene.backgroundMode === "image" && scene.backgroundImageUrl) {
    try {
      backgroundImage = await loadImage(scene.backgroundImageUrl);
    } catch {
      backgroundImage = null;
    }
  }

  // Match the PNG export: size the frame from its on-screen box so overlay
  // skins (iphone15/16pro) keep their native aspect ratio instead of being
  // stretched to the default 10/16 fallback in computeFrameBox.
  // MP4 (mpeg4) can't carry an alpha channel, so a transparent scene is
  // composited onto black for the video export (PNG keeps real transparency).
  const backgroundFill = scene.backgroundMode === "transparent" ? "#000000" : undefined;
  const frameWidth = frameElement ? Math.max(1, Math.round(frameElement.offsetWidth * pixelRatio)) : undefined;
  const frameHeight = frameElement ? Math.max(1, Math.round(frameElement.offsetHeight * pixelRatio)) : undefined;

  const fps = 30;
  // Attach the canvas to the DOM (off-screen) before capturing: some browsers
  // won't deliver frames from captureStream() on a detached canvas, which
  // yields an empty recording.
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  canvas.style.top = "0";
  canvas.style.opacity = "0";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);

  // Resolve the active layer before stream setup so the audio capture branch
  // below can check its muted state.
  const activeForCapture = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  if (!activeForCapture) {
    canvas.remove();
    throw new Error("Cannot export a scene with no layers.");
  }

  // Draw a warm-up frame before creating the stream. Some GPU/compositor
  // pipelines won't deliver ANY frames to captureStream() when the canvas has
  // never been painted, which MediaRecorder would otherwise turn into an empty
  // blob (the "Recording produced no frames." guard below).
  try {
    renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, { zoom: 1, offsetX: 0, offsetY: 0 }, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays);
  } catch {
    // The per-tick render runs again right after; a warm-up failure alone
    // must not abort the export.
  }

  let stream: MediaStream;
  try {
    stream = canvas.captureStream(fps);
  } catch (err) {
    canvas.remove();
    if (err instanceof DOMException && err.name === "SecurityError") {
      throw new Error("This video can't be exported: its host doesn't allow cross-origin capture. Use a file you uploaded instead.");
    }
    throw err;
  }

  // Background audio: if the user uploaded an audio track, capture it and
  // use it instead of any video-layer audio (replaces, not mixes).
  let bgAudioEl: HTMLAudioElement | null = null;
  if (scene.backgroundAudioUrl) {
    try {
      bgAudioEl = document.createElement("audio");
      bgAudioEl.src = scene.backgroundAudioUrl;
      bgAudioEl.loop = true;
      bgAudioEl.crossOrigin = "anonymous";
      await bgAudioEl.play();
      const bgStream = (bgAudioEl as HTMLAudioElement & { captureStream: () => MediaStream }).captureStream();
      const bgTracks = bgStream.getAudioTracks();
      if (bgTracks.length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          stream = new MediaStream([videoTrack, ...bgTracks]);
        }
      }
    } catch {
      // background audio not supported — export video-only
    }
  } else if (media instanceof HTMLVideoElement && activeForCapture.videoMuted === false) {
    try {
      const audioMs = (media as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
      const audioTracks = audioMs.getAudioTracks();
      if (audioTracks.length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          stream = new MediaStream([videoTrack, ...audioTracks]);
        }
      }
    } catch {
      // audio capture not supported — export video-only
    }
  }

  const chunks: BlobPart[] = [];
  const mimeType = chooseWebmMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const start = Math.max(0, activeForCapture.videoTrimStart || 0);
  const end = activeForCapture.videoTrimEnd > start ? activeForCapture.videoTrimEnd : activeForCapture.videoDuration;
  const isVideo = media instanceof HTMLVideoElement;
  const duration = computeCaptureDuration(scene);

  await new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("MediaRecorder failed"));
    recorder.start(200);

    let raf = 0;
    const startedAt = performance.now();
    if (media instanceof HTMLVideoElement) {
      media.currentTime = start;
      media.muted = activeForCapture?.videoMuted !== false;
      media.play().catch(() => null);
    }

    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const normalized = duration > 0 ? Math.min(1, elapsed / duration) : 1;
      const progress = Math.min(100, normalized * 100);
      const sampled = sampleVideoTransform(activeForCapture ?? scene.layers[0], normalized);
      const transform: RenderTransform = { zoom: sampled.zoom, offsetX: sampled.x, offsetY: sampled.y };
      onProgress?.(progress);

      if (media instanceof HTMLVideoElement) {
        // Guard against a not-yet-measured duration (end undefined/0): only
        // stop on the video's playhead when we actually know where it ends.
        const stopAt = typeof end === "number" && isFinite(end) && end > 0 ? end : Infinity;
        if (media.currentTime >= stopAt || elapsed >= duration) {
          media.pause();
          renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays);
          recorder.stop();
          cancelAnimationFrame(raf);
          onProgress?.(100);
          return;
        }
      } else if (elapsed >= duration) {
        recorder.stop();
        cancelAnimationFrame(raf);
        onProgress?.(100);
        return;
      }

      renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays);
      raf = requestAnimationFrame(tick);
    };

    onStatus?.("Recording preview…");
    raf = requestAnimationFrame(tick);
  });

  canvas.remove();
  // Free the capture stream's tracks so the canvas track doesn't leak between
  // exports.
  stream.getTracks().forEach((track) => track.stop());
  if (bgAudioEl) {
    bgAudioEl.pause();
    bgAudioEl.remove();
  }
  return new Blob(chunks, { type: "video/webm" });
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
  customSize?: ExportSize | null
): Promise<Blob | null> {
  const previewNode = document.getElementById("preview-canvas");
  if (!previewNode) throw new Error("Preview area not found.");

  const exportQuality = (scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
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
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
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
      const instSpec = getFrameSpec(inst.frame);
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
    webmBlob = await recordCanvasToWebm(scene, canvas, media, frameElement, pixelRatio, onStatus, onProgress, layerMedias, frameOverlays);
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
  customSize?: ExportSize | null
): Promise<Blob | null> {
  const first = await captureWebm(scene, scale, onStatus, onProgress, customSize);
  if (first && first.size > 0) return first;
  return captureWebm(scene, scale, onStatus, onProgress, customSize);
}