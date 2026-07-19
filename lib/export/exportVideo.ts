"use client";

import type { EditorScene } from "@/lib/types/editor";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { renderMockupToCanvas } from "@/lib/export/renderMockup";

let ffmpegSingleton: FFmpeg | null = null;

async function getFfmpegInstance() {
  if (ffmpegSingleton) return ffmpegSingleton;

  const ffmpeg = new FFmpeg();
  console.log("loading ffmpeg...");
  await ffmpeg.load({
    coreURL: "/ffmpeg-core.js",
    wasmURL: "/ffmpeg-core.wasm",
  });
  console.log("ffmpeg loaded");
  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isVideoScene(scene: EditorScene) {
  if (scene.mediaType === "video") return true;
  return Boolean(scene.mediaName && /\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/i.test(scene.mediaName));
}

async function recordCanvasToWebm(
  scene: EditorScene,
  canvas: HTMLCanvasElement,
  media: HTMLVideoElement | HTMLImageElement | null,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void
) {
  const fps = 30;
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
  const duration = Math.max(0.2, end - start);

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
      const progress = Math.min(100, (elapsed / duration) * 100);
      onProgress?.(progress);

      if (media instanceof HTMLVideoElement) {
        if (media.currentTime >= end || elapsed >= duration) {
          media.pause();
          renderMockupToCanvas(canvas, scene, media);
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

      renderMockupToCanvas(canvas, scene, media);
      raf = requestAnimationFrame(tick);
    };

    onStatus?.("Recording mockup frames...");
    raf = requestAnimationFrame(tick);
  });

  return new Blob(chunks, { type: "video/webm" });
}

export async function exportVideo(
  scene: EditorScene,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void
) {
  const previewNode = document.getElementById("preview-canvas");
  if (!previewNode) return;

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

  const webmBlob = await recordCanvasToWebm(scene, canvas, media, onStatus, onProgress);

  onStatus?.("Converting to MP4...");
  onProgress?.(0);
  const ffmpeg = await getFfmpegInstance();
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
}
