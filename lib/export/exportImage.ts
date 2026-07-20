"use client";

import type { EditorScene } from "@/lib/types/editor";
import { loadImage, renderMockupToCanvas, type RenderTransform } from "@/lib/export/renderMockup";
import { getFrameSpec } from "@/lib/render/frames";
import { sampleVideoTransform } from "@/lib/render/videoComposer";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Transform for the exported PNG. An animated scene samples its mid-animation
 * frame (progress 0.5) so the static image matches what the user sees
 * animating in the live preview, instead of always snapping to the base zoom.
 */
export function resolveExportTransform(scene: EditorScene): RenderTransform {
  const active = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  if (!active) return { zoom: 1, offsetX: 0, offsetY: 0 };
  if (active.animationPreset === "none") {
    return { zoom: active.zoom, offsetX: active.mediaOffsetX, offsetY: active.mediaOffsetY };
  }
  const sampled = sampleVideoTransform(active, 0.5);
  return { zoom: sampled.zoom, offsetX: sampled.x, offsetY: sampled.y };
}

export function waitForImage(img: HTMLImageElement, timeoutMs = 10000) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Image load timed out")), timeoutMs);
    const clear = () => clearTimeout(timer);
    img.onload = () => {
      clear();
      resolve();
    };
    img.onerror = () => {
      clear();
      reject(new Error("Image load failed"));
    };
  });
}

export async function exportImage(
  scene: EditorScene,
  containerId: string,
  filename: string,
  onError?: (message: string) => void
) {
  try {
    const node = document.getElementById(containerId);
    if (!node) {
      onError?.("Preview area not found.");
      return;
    }

    const video = node.querySelector("video");
    const img = node.querySelector("img");
    const frameElement = node.querySelector<HTMLElement>("[data-mockup-frame]");
    const active = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
    let media: CanvasImageSource | null = null;

    // A hidden active layer renders nothing, matching the preview.
    if (!active?.hidden) {
      if (video instanceof HTMLVideoElement && video.readyState >= 2) {
        media = video;
      } else if (img instanceof HTMLImageElement) {
        await waitForImage(img);
        media = img;
      }
    }

    if (!frameElement) {
      onError?.("Frame element not found.");
      return;
    }

    const baseFrameWidth = frameElement.offsetWidth;
    const baseFrameHeight = frameElement.offsetHeight;
    if (!baseFrameWidth || !baseFrameHeight) {
      onError?.("Frame has no measurable size.");
      return;
    }

    const containerWidth = node.clientWidth;
    const containerHeight = node.clientHeight;
    if (!containerWidth || !containerHeight) {
      onError?.("Preview has no measurable size.");
      return;
    }

    const spec = getFrameSpec(scene.frame);
    let overlay: HTMLImageElement | null = null;
    if (spec.isOverlay && spec.asset) {
      try {
        overlay = await loadImage(spec.asset);
      } catch {
        overlay = null;
      }
    }

    const pixelRatio = Math.max(2, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(containerWidth * pixelRatio));
    canvas.height = Math.max(1, Math.round(containerHeight * pixelRatio));

    const frameWidth = Math.max(1, Math.round(baseFrameWidth * pixelRatio));
    const frameHeight = Math.max(1, Math.round(baseFrameHeight * pixelRatio));

    const transform = resolveExportTransform(scene);

    renderMockupToCanvas(
      canvas,
      scene,
      media,
      undefined,
      undefined,
      frameWidth,
      frameHeight,
      pixelRatio,
      transform,
      undefined,
      overlay
    );

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (!pngBlob) {
      onError?.("Failed to render PNG.");
      return;
    }
    downloadBlob(pngBlob, `${filename}.png`);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "Image export failed.");
  }
}
