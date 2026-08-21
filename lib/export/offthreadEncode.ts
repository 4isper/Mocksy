"use client";

/**
 * Off-main-thread canvas → Blob encoding. The scene is still rendered on the
 * main thread (it needs DOM images and fonts); only the pixel copy + PNG/WebP
 * encode run inside a worker, via a transferred ImageBitmap. Every failure
 * mode — no Worker/OffscreenCanvas/createImageBitmap, worker error, timeout,
 * small canvas where transfer overhead isn't worth it — falls back to the
 * regular `canvas.toBlob` so exports never regress.
 */

/** Canvases smaller than this encode faster than the round-trip to a worker
 *  (≈1 MP: preview-scale 1×/2× exports stay on-thread, 4× goes off). */
const MIN_WORKER_PIXELS = 1_000_000;
/** Hard ceiling for a worker encode before falling back to the main thread. */
const ENCODE_TIMEOUT_MS = 20_000;

let cachedWorker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (blob: Blob) => void; reject: (err: Error) => void }>();

function getEncoder(): Worker | null {
  if (cachedWorker !== undefined) return cachedWorker;
  cachedWorker = null;
  try {
    if (
      typeof window === "undefined" ||
      typeof Worker === "undefined" ||
      typeof createImageBitmap !== "function" ||
      typeof OffscreenCanvas === "undefined"
    ) {
      return null;
    }
    const worker = new Worker("/workers/blobEncoder.js");
    worker.onmessage = (event: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
      const { id, blob, error } = event.data || {};
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (blob) entry.resolve(blob);
      else entry.reject(new Error(error || "Worker encode failed"));
    };
    worker.onerror = () => {
      // Fail every in-flight request; future calls re-detect below.
      for (const [, entry] of pending) entry.reject(new Error("Encoder worker crashed"));
      pending.clear();
      cachedWorker = null;
    };
    cachedWorker = worker;
  } catch {
    cachedWorker = null;
  }
  return cachedWorker;
}

function mainThreadEncode(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), mimeType, quality);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Encodes a rendered canvas to an image Blob, preferring the encoder worker
 * for large canvases. Resolves null exactly like `canvas.toBlob` would when
 * encoding fails.
 */
export async function encodeCanvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob | null> {
  const eligible =
    typeof createImageBitmap === "function" &&
    canvas.width > 0 &&
    canvas.height > 0 &&
    canvas.width * canvas.height >= MIN_WORKER_PIXELS;
  if (eligible) {
    const worker = getEncoder();
    if (worker) {
      try {
        const bitmap = await createImageBitmap(canvas);
        return await new Promise<Blob>((resolve, reject) => {
          const id = ++nextId;
          pending.set(id, { resolve, reject });
          worker.postMessage({ id, bitmap, mimeType, quality }, [bitmap]);
          window.setTimeout(() => {
            if (pending.delete(id)) reject(new Error("Encode timed out"));
          }, ENCODE_TIMEOUT_MS);
        });
      } catch {
        // Fall through to the main thread — never fail an export because of
        // worker plumbing.
      }
    }
  }
  return mainThreadEncode(canvas, mimeType, quality);
}
