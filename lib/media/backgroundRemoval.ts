import type { MediaLayer } from "@/lib/types/editor";

/**
 * Client-side background removal for image layers. The model (RMBG-1.4) and
 * the ONNX wasm runtime are fetched lazily on first use via a dynamic import,
 * so the main bundle and initial page load stay clean; afterwards the
 * pipeline is cached module-wide and reuse is fast. Everything runs in the
 * browser — images never leave the device.
 *
 * Offline reuse after the first run is provided by two cache layers:
 *   - model weights: transformers.js's own Cache API store (useBrowserCache),
 *     checked before any network request;
 *   - the ONNX Runtime wasm binaries from jsdelivr: the app service worker
 *     serves them stale-while-revalidate (see scripts/sw-template.js).
 */

/** A layer is eligible when it carries a raster image (videos are skipped). */
export function canRemoveBackground(layer: MediaLayer | undefined): boolean {
  return !!layer && layer.mediaType === "image" && typeof layer.mediaUrl === "string" && layer.mediaUrl.length > 0;
}

/** Derives the media name for the cutout result, e.g. "photo.png" → "photo (cutout).png". */
export function cutoutMediaName(name: string | null): string | null {
  if (!name) return null;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name} (cutout)`;
  return `${name.slice(0, dot)} (cutout)${name.slice(dot)}`;
}

export interface BackgroundRemovalProgress {
  /** "init" while deps download, "ready" once the pipeline is warm. */
  status: "init" | "ready";
  /** 0..100 when available (model file download progress). */
  progress?: number;
}

type RemovalPipeline = (image: string) => Promise<{ toBlob: (type?: string, quality?: number) => Promise<Blob> }>;

// Cached across calls so the model stays warm between images.
let pipelinePromise: Promise<RemovalPipeline> | null = null;

async function loadPipeline(onProgress?: (p: BackgroundRemovalProgress) => void): Promise<RemovalPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      // Models always come from the HF hub; there are no local model files.
      env.allowLocalModels = false;
      // Cache-first model loading: once downloaded, weights are served from
      // the browser's Cache API even when offline.
      env.useBrowserCache = true;
      const remover = await pipeline("background-removal", "briaai/RMBG-1.4", {
        progress_callback: (info: { status?: string; progress?: number }) => {
          if (info.status === "progress" || typeof info.progress === "number") {
            onProgress?.({ status: "init", progress: info.progress });
          }
        }
      });
      onProgress?.({ status: "ready" });
      return remover as unknown as RemovalPipeline;
    })();
    // Don't cache a failed load: let the next attempt retry from scratch.
    pipelinePromise.catch(() => {
      pipelinePromise = null;
    });
  }
  return pipelinePromise;
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read the cutout image."));
    reader.readAsDataURL(blob);
  });
}

/** Removes the background from an image data/blob URL and resolves with a
 *  PNG data URL whose background is transparent. */
export async function removeImageBackground(
  mediaUrl: string,
  onProgress?: (p: BackgroundRemovalProgress) => void
): Promise<string> {
  const remover = await loadPipeline(onProgress);
  const result = await remover(mediaUrl);
  const blob = await result.toBlob("image/png");
  return blobToDataURL(blob);
}
