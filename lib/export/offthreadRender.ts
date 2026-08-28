"use client";

import type { RenderWorkerPayload, RenderWorkerResponse } from "@/lib/render/renderWorkerProtocol";

/**
 * Off-main-thread scene rendering. The whole renderMockupToCanvas pass —
 * background, frames, skins, annotations, watermark — runs inside a bundled
 * module worker on an OffscreenCanvas, so 4× PNG exports no longer block
 * input. Every failure mode (no Worker/OffscreenCanvas, worker crash,
 * timeout) resolves null and the caller falls back to the synchronous path.
 */

const RENDER_TIMEOUT_MS = 30_000;

let cachedWorker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (blob: Blob | null) => void }>();

export function isOffthreadRenderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function"
  );
}

function getRenderer(): Worker | null {
  if (cachedWorker !== undefined) return cachedWorker;
  cachedWorker = null;
  try {
    if (!isOffthreadRenderSupported()) return null;
    const worker = new Worker(new URL("../render/mockupRenderWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<RenderWorkerResponse>) => {
      const { id, blob, error } = event.data || {};
      const entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      // Any failure resolves null; callers re-render on the main thread.
      entry.resolve(blob ?? null);
      if (error) console.warn("offthread render:", error);
    };
    worker.onerror = () => {
      for (const [, entry] of pending) entry.resolve(null);
      pending.clear();
      cachedWorker = null;
    };
    cachedWorker = worker;
  } catch {
    cachedWorker = null;
  }
  return cachedWorker;
}

/**
 * Renders the payload's scene in the worker. `predecoded` carries bitmaps for
 * SVG assets (device skins, custom frames, SVG media) rasterized on the main
 * thread — workers can neither construct an Image nor createImageBitmap an
 * SVG blob — and the buffers are transferred, not copied. Resolves null
 * whenever the worker path is unavailable or fails — the export then proceeds
 * exactly as before on the main thread.
 */
export async function renderSceneInWorker(
  payload: Omit<RenderWorkerPayload, "id">,
  predecoded: Array<{ url: string; bitmap: ImageBitmap }> = []
): Promise<Blob | null> {
  const worker = getRenderer();
  if (!worker) return null;
  const id = ++nextId;
  const full: RenderWorkerPayload = { ...payload, id, bitmaps: predecoded };
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      resolve(null);
    }, RENDER_TIMEOUT_MS);
    pending.set(id, {
      resolve: (blob) => {
        window.clearTimeout(timer);
        resolve(blob);
      }
    });
    try {
      worker.postMessage(full, predecoded.map((e) => e.bitmap));
    } catch {
      window.clearTimeout(timer);
      pending.delete(id);
      resolve(null);
    }
  });
}
