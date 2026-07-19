"use client";

import type { EditorScene } from "@/lib/types/editor";
import { renderMockupToCanvas } from "@/lib/export/renderMockup";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function waitForImage(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
  });
}

export async function exportImage(scene: EditorScene, containerId: string, filename: string) {
  const node = document.getElementById(containerId);
  if (!node) return;

  const video = node.querySelector("video");
  const img = node.querySelector("img");
  const frameElement = node.querySelector<HTMLElement>("[data-mockup-frame]");
  let media: CanvasImageSource | null = null;

  if (video instanceof HTMLVideoElement && video.readyState >= 2) {
    media = video;
  } else if (img instanceof HTMLImageElement) {
    await waitForImage(img);
    media = img;
  }

  if (!frameElement) return;

  const baseFrameWidth = frameElement.offsetWidth;
  const baseFrameHeight = frameElement.offsetHeight;
  if (!baseFrameWidth || !baseFrameHeight) return;

  const containerWidth = node.clientWidth;
  const containerHeight = node.clientHeight;
  if (!containerWidth || !containerHeight) return;

  const pixelRatio = Math.max(2, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(containerWidth * pixelRatio));
  canvas.height = Math.max(1, Math.round(containerHeight * pixelRatio));

  const frameWidth = Math.max(1, Math.round(baseFrameWidth * pixelRatio));
  const frameHeight = Math.max(1, Math.round(baseFrameHeight * pixelRatio));

  renderMockupToCanvas(canvas, scene, media, undefined, undefined, frameWidth, frameHeight, pixelRatio, scene.zoom);

  const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (!pngBlob) return;
  downloadBlob(pngBlob, `${filename}.png`);
}
