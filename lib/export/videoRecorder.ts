"use client";

import type { EditorScene } from "@/lib/types/editor";
import { loadImage } from "@/lib/render/canvasMedia";
import { renderMockupToCanvas } from "@/lib/render/renderMockup";
import type { RenderTransform } from "@/lib/render/frameGeometry";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { getFrameSpec } from "@/lib/render/frames";
import { chooseWebmMimeType, computeCaptureDuration } from "@/lib/export/videoExportHelpers";

export async function recordCanvasToWebm(
  scene: EditorScene,
  canvas: HTMLCanvasElement,
  media: HTMLVideoElement | HTMLImageElement | null,
  frameElement: HTMLElement | null,
  pixelRatio: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  layerMedias?: Map<string, CanvasImageSource | null>,
  frameOverlays?: Map<string, CanvasImageSource | null>,
  activeLayerId: string | null = scene.activeLayerId
) {
  const spec = getFrameSpec(scene.frame, scene.customFrame);
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
  const activeForCapture = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  if (!activeForCapture) {
    canvas.remove();
    throw new Error("Cannot export a scene with no layers.");
  }

  // Draw a warm-up frame before creating the stream. Some GPU/compositor
  // pipelines won't deliver ANY frames to captureStream() when the canvas has
  // never been painted, which MediaRecorder would otherwise turn into an empty
  // blob (the "Recording produced no frames." guard below).
  try {
    renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, { zoom: 1, offsetX: 0, offsetY: 0 }, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays, activeLayerId);
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
  const duration = computeCaptureDuration(scene, activeLayerId);

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
          renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays, activeLayerId);
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

      renderMockupToCanvas(canvas, scene, activeForCapture?.hidden ? null : media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, backgroundFill, overlay, backgroundImage, layerMedias, frameOverlays, activeLayerId);
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
