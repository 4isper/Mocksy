"use client";

import type { EditorScene } from "@/lib/types/editor";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { loadImage, renderMockupToCanvas, type RenderTransform } from "@/lib/export/renderMockup";
import { buildVideoTimeline } from "@/lib/render/videoComposer";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoScene } from "@/lib/render/mediaKind";

let ffmpegSingleton: FFmpeg | null = null;

async function getFfmpegInstance(onStatus?: (message: string) => void) {
  if (ffmpegSingleton) return ffmpegSingleton;

  const ffmpeg = new FFmpeg();
  onStatus?.("Loading encoder…");
  await ffmpeg.load({
    coreURL: "/ffmpeg-core.js",
    wasmURL: "/ffmpeg-core.wasm",
  });
  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

/** Duration of an animated still-image export, in seconds. */
const ANIMATION_DURATION_SEC = 3;

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Interpolate the animation transform at a normalized progress (0..1). */
function sampleTransform(scene: EditorScene, progress: number): RenderTransform {
  const timeline = buildVideoTimeline(scene);
  if (timeline.length === 0) return { zoom: scene.zoom, offsetX: 0, offsetY: 0 };
  if (timeline.length === 1) {
    const k = timeline[0];
    return { zoom: k.zoom, offsetX: k.x, offsetY: k.y };
  }
  const p = Math.max(0, Math.min(1, progress));
  let lower = timeline[0];
  let upper = timeline[timeline.length - 1];
  for (let i = 0; i < timeline.length - 1; i++) {
    if (p >= timeline[i].at && p <= timeline[i + 1].at) {
      lower = timeline[i];
      upper = timeline[i + 1];
      break;
    }
  }
  const span = upper.at - lower.at;
  const t = span > 0 ? (p - lower.at) / span : 0;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    zoom: lerp(lower.zoom, upper.zoom),
    offsetX: lerp(lower.x, upper.x),
    offsetY: lerp(lower.y, upper.y)
  };
}

async function recordCanvasToWebm(
  scene: EditorScene,
  canvas: HTMLCanvasElement,
  media: HTMLVideoElement | HTMLImageElement | null,
  frameElement: HTMLElement | null,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void
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

  // Match the PNG export: size the frame from its on-screen box so overlay
  // skins (iphone15/16pro) keep their native aspect ratio instead of being
  // stretched to the default 10/16 fallback in computeFrameBox.
  const pixelRatio = 2;
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

  const stream = canvas.captureStream(fps);
  const chunks: BlobPart[] = [];
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm;codecs=vp8";
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const start = Math.max(0, scene.videoTrimStart || 0);
  const end = scene.videoTrimEnd > start ? scene.videoTrimEnd : scene.videoDuration;
  const isVideo = media instanceof HTMLVideoElement;
  const duration = isVideo ? Math.max(0.2, end - start) : ANIMATION_DURATION_SEC;

  await new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("MediaRecorder failed"));
    recorder.start(200);

    let raf = 0;
    const startedAt = performance.now();
    if (media instanceof HTMLVideoElement) {
      media.currentTime = start;
      media.muted = true;
      media.play().catch(() => null);
    }

    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const normalized = duration > 0 ? Math.min(1, elapsed / duration) : 1;
      const progress = Math.min(100, normalized * 100);
      const transform = sampleTransform(scene, normalized);
      onProgress?.(progress);

      if (media instanceof HTMLVideoElement) {
        if (media.currentTime >= end || elapsed >= duration) {
          media.pause();
          renderMockupToCanvas(canvas, scene, media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, undefined, overlay);
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

      renderMockupToCanvas(canvas, scene, media, undefined, undefined, frameWidth, frameHeight, pixelRatio, transform, undefined, overlay);
      raf = requestAnimationFrame(tick);
    };

    onStatus?.("Recording mockup frames...");
    raf = requestAnimationFrame(tick);
  });

  canvas.remove();
  return new Blob(chunks, { type: "video/webm" });
}

export async function exportVideo(
  scene: EditorScene,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void
) {
  try {
    const previewNode = document.getElementById("preview-canvas");
    if (!previewNode) {
      onError?.("Preview area not found.");
      return;
    }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(640, previewNode.clientWidth * 2);
  canvas.height = Math.max(360, previewNode.clientHeight * 2);

  const videoInPreview = previewNode.querySelector("video");
  const imageInPreview = previewNode.querySelector("img");
  let media: HTMLVideoElement | HTMLImageElement | null = null;
  if (isVideoScene(scene) && scene.mediaUrl) {
    const sourceVideo = document.createElement("video");
    sourceVideo.src = scene.mediaUrl;
    sourceVideo.crossOrigin = "anonymous";
    sourceVideo.muted = true;
    sourceVideo.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      sourceVideo.onloadedmetadata = () => resolve();
      sourceVideo.onerror = () => reject(new Error("Unable to load video for export"));
    });
    media = sourceVideo;
  } else if (imageInPreview instanceof HTMLImageElement) {
    media = imageInPreview;
  } else if (videoInPreview instanceof HTMLVideoElement) {
    media = videoInPreview;
  }

  const frameElement = previewNode.querySelector<HTMLElement>("[data-mockup-frame]");
  const webmBlob = await recordCanvasToWebm(scene, canvas, media, frameElement, onStatus, onProgress);
  if (!webmBlob || webmBlob.size === 0) {
    onError?.("Recording produced no video frames.");
    return;
  }

  onStatus?.("Converting to MP4...");
  onProgress?.(0);
  const ffmpeg = await getFfmpegInstance(onStatus);
  const inputName = "input.webm";
  const outputName = "mocksy-export.mp4";
  await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));
  onProgress?.(50);
  await ffmpeg.exec([
    "-i", inputName,
    "-c:v", "mpeg4",
    "-q:v", "5",
    "-pix_fmt", "yuv420p",
    outputName,
  ]);
  onProgress?.(90);
  const data = await ffmpeg.readFile(outputName);
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const blob = new Blob([bytes], { type: "video/mp4" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = sanitizeFilename((scene.mediaName || "mocksy-export").replace(/\.[^.]+$/, "")) + ".mp4";
  link.click();
  URL.revokeObjectURL(link.href);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  onStatus?.("MP4 exported");
  onProgress?.(100);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "Video export failed.");
  }
}
