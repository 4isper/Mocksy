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
  warmUpFfmpeg,
} from "@/lib/export/exportVideoCore";

export { terminateFfmpeg };
export { warmUpFfmpeg };
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

/** Unique per-run FFmpeg temp names so overlapping exports (shortcuts and the
 *  command palette aren't gated by isExporting) never share FS entries. */
function videoTempNames(ext: "mp4" | "webp" | "gif"): { inputName: string; outputName: string } {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { inputName: `input-${id}.webm`, outputName: `mocksy-export-${id}.${ext}` };
}

export async function exportVideo(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void,
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId,
  signal?: AbortSignal
) {
  // Unique per-run temp names: concurrent exports (keyboard shortcuts and the
  // command palette aren't gated by isExporting) share one FFmpeg filesystem,
  // and fixed names would make them overwrite each other's input/output.
  const { inputName, outputName } = videoTempNames("mp4");
  try {
    signal?.throwIfAborted();
    const webmBlob = await captureWebmWithRetry(scene, scale, onStatus, onProgress, customSize, activeLayerId, signal);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no frames.");
      return;
    }

  signal?.throwIfAborted();
  onStatus?.("Encoding MP4…");
  onProgress?.(0);
  const exportQuality = (scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
  const quality = QUALITY[exportQuality] ?? QUALITY.medium;
  const ffmpeg = await getFfmpegInstance(onStatus);
  await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));
  onProgress?.(50);
  signal?.throwIfAborted();
  // H.264 (libx264, bundled in @ffmpeg/core) with CRF quality control: far
  // smaller files with better quality than the legacy mpeg4 encoder. The WASM
  // build is single-threaded, so encode time is the dominant cost — an
  // ultrafast preset is the biggest safe lever (CRF, not the preset, governs
  // quality). +faststart moves the moov atom to the front so the video starts
  // streaming/playing immediately.
  const code = await ffmpeg.exec([
    "-i", inputName,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", String(quality.crf),
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputName,
  ]);
  // FFmpeg returns 0 on success; a non-zero code means the encode failed
  // (e.g. unsupported input) and would otherwise produce an empty/corrupt MP4.
  if (code !== 0) {
    throw new Error("Video encoding failed.");
  }
  onProgress?.(90);
  signal?.throwIfAborted();
  const data = await ffmpeg.readFile(outputName);
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  if (bytes.length === 0) {
    throw new Error("Video encoding produced no output.");
  }
  const blob = new Blob([bytes], { type: "video/mp4" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${exportBaseName(scene, activeLayerId)}.mp4`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  // Cleanup after the download is best-effort: a failed deleteFile must not
  // mask the successful export with an error toast.
  await cleanupFfmpegTempFiles(ffmpeg, [inputName, outputName]);
  onStatus?.("Done");
  onProgress?.(100);
  } catch (err) {
    // Best-effort temp-file cleanup so the FFmpeg singleton doesn't carry
    // stale input/output between failed exports.
    await cleanupFfmpegTempFiles(getFfmpegSingleton(), [inputName, outputName]);
    onError?.(err instanceof Error ? err.message : "Video export failed.");
  }
}

export async function exportWebm(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void,
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId,
  signal?: AbortSignal
) {
  try {
    signal?.throwIfAborted();
    const webmBlob = await captureWebmWithRetry(scene, scale, onStatus, onProgress, customSize, activeLayerId, signal);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no video frames.");
      return;
    }
    signal?.throwIfAborted();
    downloadBlob(webmBlob, `${exportBaseName(scene, activeLayerId)}.webm`);
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
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId,
  signal?: AbortSignal
) {
  const { inputName, outputName } = videoTempNames("webp");
  try {
    signal?.throwIfAborted();
    const webmBlob = await captureWebmWithRetry(scene, scale, onStatus, onProgress, customSize, activeLayerId, signal);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no frames.");
      return;
    }

  signal?.throwIfAborted();
  onStatus?.("Encoding WebP…");
    onProgress?.(0);
    const exportQuality = activeLayerOf(scene, activeLayerId)?.videoQuality ?? "medium";
    const quality = QUALITY[exportQuality] ?? QUALITY.medium;
    const ffmpeg = await getFfmpegInstance(onStatus);
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
    downloadBlob(new Blob([bytes], { type: "image/webp" }), `${exportBaseName(scene, activeLayerId)}.webp`);
    // Cleanup after the download is best-effort: a failed deleteFile must not
    // mask the successful export with an error toast.
    await cleanupFfmpegTempFiles(ffmpeg, [inputName, outputName]);
    onStatus?.("Done");
    onProgress?.(100);
  } catch (err) {
    await cleanupFfmpegTempFiles(getFfmpegSingleton(), [inputName, outputName]);
    onError?.(err instanceof Error ? err.message : "Animated WebP export failed.");
  }
}

export async function exportGif(
  scene: EditorScene,
  scale?: number,
  onStatus?: (message: string) => void,
  onProgress?: (progress: number) => void,
  onError?: (message: string) => void,
  customSize?: ExportSize | null,
  activeLayerId: string | null = scene.activeLayerId,
  signal?: AbortSignal
) {
  const { inputName, outputName } = videoTempNames("gif");
  try {
    signal?.throwIfAborted();
    const webmBlob = await captureWebmWithRetry(scene, scale, onStatus, onProgress, customSize, activeLayerId, signal);
    if (!webmBlob || webmBlob.size === 0) {
      onError?.("Recording produced no frames.");
      return;
    }

  signal?.throwIfAborted();
  onStatus?.("Encoding GIF…");
    onProgress?.(0);
    const exportQuality = (scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0])?.videoQuality ?? "medium";
    const quality = QUALITY[exportQuality] ?? QUALITY.medium;
    const ffmpeg = await getFfmpegInstance(onStatus);
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
    signal?.throwIfAborted();
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
    signal?.throwIfAborted();
    const data = await ffmpeg.readFile(outputName);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    if (bytes.length === 0) {
      throw new Error("GIF encoding produced no output.");
    }
    const blob = new Blob([bytes], { type: "image/gif" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${exportBaseName(scene, activeLayerId)}.gif`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    // The single-pass palettegen/paletteuse filter graph keeps the palette in
    // an in-memory label — no palette file is ever written, so only the input
    // and output need cleanup. Best-effort: a failed deleteFile must not mask
    // the successful export with an error toast.
    await cleanupFfmpegTempFiles(ffmpeg, [inputName, outputName]);
    onStatus?.("Done");
    onProgress?.(100);
  } catch (err) {
    await cleanupFfmpegTempFiles(getFfmpegSingleton(), [inputName, outputName]);
    onError?.(err instanceof Error ? err.message : "GIF export failed.");
  }
}