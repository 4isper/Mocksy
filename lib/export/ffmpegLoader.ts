"use client";

// Type-only import: erased at compile time so the heavy `@ffmpeg/ffmpeg`
// runtime is NOT pulled into the initial client bundle. The value is loaded
// lazily via dynamic import inside getFfmpegInstance, keeping ffmpeg (and its
// 32MB WASM worker) out of the page-load path until a video/GIF export runs.
import type { FFmpeg } from "@ffmpeg/ffmpeg";

let ffmpegSingleton: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;
/** Idle window before a loaded encoder is released. Generous enough that
 *  back-to-back exports never pay a reload, short enough that the WASM heap
 *  (tens of MB) doesn't sit pinned for the whole session. */
export const FFMPEG_IDLE_RELEASE_MS = 5 * 60_000;
let ffmpegIdleTimer: ReturnType<typeof setTimeout> | null = null;

function cancelFfmpegIdleRelease(): void {
  if (ffmpegIdleTimer !== null) {
    clearTimeout(ffmpegIdleTimer);
    ffmpegIdleTimer = null;
  }
}

/**
 * Arms (or re-arms) the timer that releases the cached FFmpeg instance and its
 * WASM worker once no export has used the encoder for a while. The next export
 * transparently re-loads it — the core files are HTTP/service-worker cached,
 * so only the worker boot is paid again.
 */
export function scheduleFfmpegIdleRelease(): void {
  cancelFfmpegIdleRelease();
  ffmpegIdleTimer = setTimeout(() => {
    ffmpegIdleTimer = null;
    terminateFfmpeg();
  }, FFMPEG_IDLE_RELEASE_MS);
}

/** Returns the cached FFmpeg singleton, or null if not yet initialized. */
export function getFfmpegSingleton(): FFmpeg | null {
  return ffmpegSingleton;
}

export async function getFfmpegInstance(onStatus?: (message: string) => void) {
  // Using the encoder cancels any pending idle release: an armed timer must
  // never fire under an in-flight or imminent export.
  cancelFfmpegIdleRelease();
  if (ffmpegSingleton) return ffmpegSingleton;

  // Share the in-flight load between concurrent callers (e.g. a background
  // warm-up racing the user's first export) so the 32MB WASM isn't fetched
  // twice. On failure the promise is cleared so the next call retries.
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
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
  // The warm-up itself arms the release timer: visitors who never export
  // don't keep the decoded WASM resident for the whole session.
  void getFfmpegInstance()
    .then(() => scheduleFfmpegIdleRelease())
    .catch(() => null);
}

/** Releases the cached FFmpeg instance and its WASM worker. Call when the
  *  editor is torn down or memory is tight; the next export will re-load it. */
export function terminateFfmpeg() {
  cancelFfmpegIdleRelease();
  if (!ffmpegSingleton) return;
  // terminate() exists on the real FFmpeg class; guard for test stubs.
  (ffmpegSingleton as unknown as { terminate?: () => void }).terminate?.();
  ffmpegSingleton = null;
  ffmpegLoadPromise = null;
}

/** Deletes temporary FFmpeg files best-effort, then re-arms the idle timer
  *  that eventually releases the encoder. Ignores cleanup errors. */
export async function cleanupFfmpegTempFiles(ffmpeg: FFmpeg | null, files: string[]) {
  if (!ffmpeg) return;
  try {
    for (const f of files) await ffmpeg.deleteFile(f);
  } catch {
    // ignore cleanup errors
  }
  scheduleFfmpegIdleRelease();
}
