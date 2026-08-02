"use client";

import type { EditorScene, ExportSize } from "@/lib/types/editor";
import { downloadBlob } from "@/lib/export/downloadBlob";
import {
  cleanupFfmpegTempFiles,
  getFfmpegInstance,
  getFfmpegSingleton,
  terminateFfmpeg,
  sanitizeFilename,
  activeLayerOf,
  exportBaseName,
  resolvePixelRatio,
  computeCaptureDuration,
  chooseWebmMimeType,
  QUALITY,
  captureWebm,
  captureWebmWithRetry,
} from "@/lib/export/exportVideoCore";

export { terminateFfmpeg };
export { sanitizeFilename };
export { activeLayerOf };
export { exportBaseName };
export { resolvePixelRatio };
export { computeCaptureDuration };
export { chooseWebmMimeType };
export { QUALITY };
export { captureWebm };
export { captureWebmWithRetry };
export { cleanupFfmpegTempFiles };

export async function exportVideo(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void,
  customSize?: ExportSize | null
) {
  try {
    const webmBlob = await captureWebmWithRetry(scene, scale, onStatus, onProgress, customSize);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no frames.");
      return;
    }

  onStatus?.("Encoding MP4…");
  onProgress?.(0);
  const exportQuality = (scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
  const quality = QUALITY[exportQuality] ?? QUALITY.medium;
  const ffmpeg = await getFfmpegInstance(onStatus);
  const inputName = "input.webm";
  const outputName = "mocksy-export.mp4";
  await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));
  onProgress?.(50);
  const code = await ffmpeg.exec([
    "-i", inputName,
    "-c:v", "mpeg4",
    "-q:v", String(quality.qscale),
    "-pix_fmt", "yuv420p",
    outputName,
  ]);
  // FFmpeg returns 0 on success; a non-zero code means the encode failed
  // (e.g. unsupported input) and would otherwise produce an empty/corrupt MP4.
  if (code !== 0) {
    throw new Error("Video encoding failed.");
  }
  onProgress?.(90);
  const data = await ffmpeg.readFile(outputName);
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  if (bytes.length === 0) {
    throw new Error("Video encoding produced no output.");
  }
  const blob = new Blob([bytes], { type: "video/mp4" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${exportBaseName(scene)}.mp4`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 200);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  onStatus?.("Done");
  onProgress?.(100);
  } catch (err) {
    // Best-effort temp-file cleanup so the FFmpeg singleton doesn't carry
    // stale input/output between failed exports.
    await cleanupFfmpegTempFiles(getFfmpegSingleton(), ["input.webm", "mocksy-export.mp4"]);
    onError?.(err instanceof Error ? err.message : "Video export failed.");
  }
}

export async function exportWebm(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void,
  customSize?: ExportSize | null
) {
  try {
    const webmBlob = await captureWebmWithRetry(scene, scale, onStatus, onProgress, customSize);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no video frames.");
      return;
    }
    downloadBlob(webmBlob, `${exportBaseName(scene)}.webm`);
    onStatus?.("Done");
    onProgress?.(100);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "WebM export failed.");
  }
}

export async function exportWebpAnim(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void,
  customSize?: ExportSize | null
) {
  try {
    const webmBlob = await captureWebm(scene, scale, onStatus, onProgress, customSize);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no frames.");
      return;
    }

    onStatus?.("Encoding WebP…");
    onProgress?.(0);
    const exportQuality = activeLayerOf(scene)?.videoQuality ?? "medium";
    const quality = QUALITY[exportQuality] ?? QUALITY.medium;
    const ffmpeg = await getFfmpegInstance(onStatus);
    const inputName = "input.webm";
    const outputName = "mocksy-export.webp";
    await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));
    onProgress?.(50);
    // Animated WebP is best kept small: cap the width per quality tier (2× is
    // the baseline, so 1× halves and 4× doubles it) and drop to 15fps. A custom
    // resolution is capped at its own width so it never exceeds it.
    const hasCustomSize = customSize !== null && customSize !== undefined && customSize.width > 0;
    const width = hasCustomSize
      ? Math.round(Math.min(customSize.width, 480 * quality.scale))
      : Math.round(480 * quality.scale * (typeof scale === "number" && scale > 0 ? scale / 2 : 1));
    const code = await ffmpeg.exec([
      "-i", inputName,
      "-vf", `fps=15,scale=${width}:-1:flags=lanczos`,
      "-c:v", "libwebp_anim",
      "-lossless", "0",
      "-q:v", "75",
      outputName
    ]);
    if (code !== 0) {
      throw new Error("WebP encoding failed.");
    }
    onProgress?.(90);
    const data = await ffmpeg.readFile(outputName);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    if (bytes.length === 0) {
      throw new Error("WebP encoding produced no output.");
    }
    downloadBlob(new Blob([bytes], { type: "image/webp" }), `${exportBaseName(scene)}.webp`);
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
    onStatus?.("Done");
    onProgress?.(100);
  } catch (err) {
    await cleanupFfmpegTempFiles(getFfmpegSingleton(), ["input.webm", "mocksy-export.webp"]);
    onError?.(err instanceof Error ? err.message : "Animated WebP export failed.");
  }
}

export async function exportGif(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void,
  customSize?: ExportSize | null
) {
  try {
    const webmBlob = await captureWebm(scene, scale, onStatus, onProgress, customSize);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no frames.");
      return;
    }

    onStatus?.("Encoding GIF…");
    onProgress?.(0);
    const exportQuality = (scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
    const quality = QUALITY[exportQuality] ?? QUALITY.medium;
    const ffmpeg = await getFfmpegInstance(onStatus);
    const inputName = "input.webm";
    const paletteName = "palette.png";
    const outputName = "mocksy-export.gif";
    await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));
    onProgress?.(50);
    // Scale down for GIF: keep it crisp but cap width so the palette step
    // stays cheap. Quality tier and the chosen export scale drive the width
    // (2× is the baseline, so 1× halves and 4× doubles it). A custom resolution
    // is capped at its own width.
    const hasCustomSize = customSize !== null && customSize !== undefined && customSize.width > 0;
    const width = hasCustomSize
      ? Math.round(Math.min(customSize.width, 480 * quality.scale))
      : Math.round(480 * quality.scale * (typeof scale === "number" && scale > 0 ? scale / 2 : 1));
    const code = await ffmpeg.exec([
      "-i", inputName,
      "-vf", `fps=15,scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      "-loop", "0",
      outputName
    ]);
    if (code !== 0) {
      throw new Error("GIF encoding failed.");
    }
    onProgress?.(90);
    const data = await ffmpeg.readFile(outputName);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    if (bytes.length === 0) {
      throw new Error("GIF encoding produced no output.");
    }
    const blob = new Blob([bytes], { type: "image/gif" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${exportBaseName(scene)}.gif`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 200);
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(paletteName);
    await ffmpeg.deleteFile(outputName);
    onStatus?.("Done");
    onProgress?.(100);
  } catch (err) {
    await cleanupFfmpegTempFiles(getFfmpegSingleton(), ["input.webm", "palette.png", "mocksy-export.gif"]);
    onError?.(err instanceof Error ? err.message : "GIF export failed.");
  }
}