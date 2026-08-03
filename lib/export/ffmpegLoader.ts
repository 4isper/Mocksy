"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpegSingleton: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

/** Returns the cached FFmpeg singleton, or null if not yet initialized. */
export function getFfmpegSingleton(): FFmpeg | null {
  return ffmpegSingleton;
}

export async function getFfmpegInstance(onStatus?: (message: string) => void) {
  if (ffmpegSingleton) return ffmpegSingleton;

  // Share the in-flight load between concurrent callers (e.g. a background
  // warm-up racing the user's first export) so the 32MB WASM isn't fetched
  // twice. On failure the promise is cleared so the next call retries.
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      onStatus?.("Preparing encoder…");
      await ffmpeg.load({
        coreURL: "/ffmpeg-core.js",
        wasmURL: "/ffmpeg-core.wasm",
      });
      ffmpegSingleton = ffmpeg;
      return ffmpeg;
    })().catch((err: unknown) => {
      ffmpegLoadPromise = null;
      throw err;
    });
  }
  return ffmpegLoadPromise;
}

/**
 * Best-effort background preload of the FFmpeg singleton. Called when the
 * editor mounts so the first video/GIF export doesn't pay the 32MB WASM
 * download and worker boot cost. Failures are swallowed — the export path
 * still lazy-loads on demand.
 */
export function warmUpFfmpeg(): void {
  if (ffmpegSingleton || ffmpegLoadPromise) return;
  void getFfmpegInstance().catch(() => null);
}

/** Releases the cached FFmpeg instance and its WASM worker. Call when the
  *  editor is torn down or memory is tight; the next export will re-load it. */
export function terminateFfmpeg() {
  if (!ffmpegSingleton) return;
  // terminate() exists on the real FFmpeg class; guard for test stubs.
  (ffmpegSingleton as unknown as { terminate?: () => void }).terminate?.();
  ffmpegSingleton = null;
  ffmpegLoadPromise = null;
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
