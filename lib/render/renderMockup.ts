"use client";

import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { frameViewBox, getFrameSpec } from "@/lib/render/frames";
import { RENDER, drawAnnotations, drawFrameAndMedia, drawWatermark } from "@/lib/render/canvasDrawing";
import { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
import type { FrameBox, RenderTransform } from "@/lib/render/frameGeometry";
import { computeFrameBox, computeFrameInstances } from "@/lib/render/frameGeometry";

export { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
export type { FrameBox, RenderTransform } from "@/lib/render/frameGeometry";

/** Deterministic PRNG (mulberry32) so pattern fills render identically on
 *  every pass — preview, PNG export and every frame of a video export must
 *  agree, which Math.random() can never guarantee. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillGradientBackground(ctx: CanvasRenderingContext2D, scene: EditorScene, width: number, height: number) {
  if (scene.gradientType === "radial") {
    const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
    grad.addColorStop(0, scene.gradientFrom);
    if (scene.gradientVia) grad.addColorStop(0.5, scene.gradientVia);
    grad.addColorStop(1, scene.gradientTo);
    ctx.fillStyle = grad;
  } else {
    const rad = ((scene.gradientAngle ?? RENDER.gradientAngleDeg) * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const lineLen = Math.abs(width * dx) + Math.abs(height * dy);
    const cx = width / 2;
    const cy = height / 2;
    const grad = ctx.createLinearGradient(
      cx - (dx * lineLen) / 2,
      cy - (dy * lineLen) / 2,
      cx + (dx * lineLen) / 2,
      cy + (dy * lineLen) / 2
    );
    grad.addColorStop(0, scene.gradientFrom);
    if (scene.gradientVia) grad.addColorStop(0.5, scene.gradientVia);
    grad.addColorStop(1, scene.gradientTo);
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, 0, width, height);
}

function fillPatternBackground(ctx: CanvasRenderingContext2D, scene: EditorScene, width: number, height: number) {
  const patternId = scene.patternId;
  if (!patternId) {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  switch (patternId) {
    case "dots": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (let x = 0; x < width; x += 20) {
        for (let y = 0; y < height; y += 20) {
          ctx.beginPath();
          ctx.arc(x + 10, y + 10, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "grid": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      break;
    }
    case "diagonal": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      const step = RENDER.shadowOffsetY;
      for (let i = -height; i < width + height; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + height, height);
        ctx.stroke();
      }
      break;
    }
    case "noise": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      // Deterministic noise: Math.random() would make every rendered frame
      // differ, so video exports flicker and a PNG never matches the preview.
      // The seed is derived from the canvas size so the pattern stays stable
      // across renders (and across export + preview) of the same canvas.
      const rand = mulberry32((width * 374761393 + height * 668265263) >>> 0);
      for (let i = 0; i < data.length; i += 4) {
        const d0 = data[i] ?? 0;
        const d1 = data[i + 1] ?? 0;
        const d2 = data[i + 2] ?? 0;
        const noise = (rand() - 0.5) * 30;
        data[i] = Math.max(0, Math.min(255, d0 + noise));
        data[i + 1] = Math.max(0, Math.min(255, d1 + noise));
        data[i + 2] = Math.max(0, Math.min(255, d2 + noise));
      }
      ctx.putImageData(imageData, 0, 0);
      break;
    }
    case "plus": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      for (let x = 0; x < width; x += 20) {
        for (let y = 0; y < height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(x + 10, y + 6);
          ctx.lineTo(x + 10, y + 14);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 10);
          ctx.lineTo(x + 14, y + 10);
          ctx.stroke();
        }
      }
      break;
    }
    case "cross": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (let x = 0; x < width; x += 20) {
        for (let y = 0; y < height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(x + 7, y + 7);
          ctx.lineTo(x + 13, y + 13);
          ctx.moveTo(x + 13, y + 7);
          ctx.lineTo(x + 7, y + 13);
          ctx.stroke();
        }
      }
      break;
    }
    case "triangle": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 20) {
        for (let y = 0; y < height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(x + 5, y);
          ctx.lineTo(x + 10, y + 20);
          ctx.lineTo(x, y + 20);
          ctx.closePath();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 15, y + 20);
          ctx.lineTo(x + 10, y);
          ctx.lineTo(x + 20, y);
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;
    }
    default:
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
  }
}

export function renderMockupToCanvas(
  canvas: HTMLCanvasElement,
  scene: EditorScene,
  media: CanvasImageSource | null,
  frameX?: number,
  frameY?: number,
  frameWidth?: number,
  frameHeight?: number,
  pixelRatio = 2,
  transform?: RenderTransform,
  backgroundFill?: string,
  frameOverlay?: CanvasImageSource | null,
  backgroundImage?: CanvasImageSource | null,
  layerMedias?: Map<string, CanvasImageSource | null>,
  frameOverlays?: Map<string, CanvasImageSource | null>,
  activeLayerId: string | null = scene.activeLayerId
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const spec = getFrameSpec(scene.frame);
  const width = canvas.width;
  const height = canvas.height;
  const dpiScale = pixelRatio;
  const activeLayerForRender = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  ctx.clearRect(0, 0, width, height);

  if (scene.frameInstances.length > 0) {
    if (scene.backgroundMode === "gradient") {
      fillGradientBackground(ctx, scene, width, height);
    } else if (scene.backgroundMode === "pattern") {
      fillPatternBackground(ctx, scene, width, height);
    } else if (scene.backgroundMode === "solid") {
      ctx.fillStyle = scene.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    } else if (scene.backgroundMode === "transparent" && backgroundFill) {
      ctx.fillStyle = backgroundFill;
      ctx.fillRect(0, 0, width, height);
    } else if (scene.backgroundMode === "image" && backgroundImage) {
      const img = backgroundImage as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
      const iw = img.naturalWidth || img.width || width;
      const ih = img.naturalHeight || img.height || height;
      const scale = Math.max(width / iw, height / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const blur = scene.backgroundBlur * dpiScale;
      const pad = blur * 2;
      ctx.save();
      if (blur > 0) ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(backgroundImage, (width - dw) / 2 - pad, (height - dh) / 2 - pad, dw + pad * 2, dh + pad * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(0, 0, width, height);
    }

    const frameBoxes = computeFrameInstances(scene, width, height, pixelRatio, transform, activeLayerId);
    for (let i = 0; i < frameBoxes.length; i++) {
      const box = frameBoxes[i];
      const inst = scene.frameInstances[i];
      if (!box || !inst) continue;

      const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayerForRender;
      const instSpec = getFrameSpec(inst.frame);
      const instZoom = transform?.zoom ?? layer?.zoom ?? 1;

      const frameMedia = layer?.id ? (layerMedias?.get(layer.id) ?? null) : media;
      const overlay = layer?.id && instSpec.isOverlay ? (frameOverlays?.get(layer.id) ?? null) : null;

      drawFrameAndMedia(ctx, scene, instSpec, layer, box, dpiScale, instZoom, frameMedia, overlay);
    }
    drawWatermark(ctx, scene, width, height, dpiScale);
    if (scene.annotations.length > 0) drawAnnotations(ctx, scene.annotations, width, height, dpiScale);
    return;
  }

  if (scene.backgroundMode === "image" && backgroundImage) {
    const img = backgroundImage as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
    const iw = img.naturalWidth || img.width || width;
    const ih = img.naturalHeight || img.height || height;
    const scale = Math.max(width / iw, height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const blur = scene.backgroundBlur * dpiScale;
    const pad = blur * 2;
    ctx.save();
    if (blur > 0) ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(backgroundImage, (width - dw) / 2 - pad, (height - dh) / 2 - pad, dw + pad * 2, dh + pad * 2);
    ctx.restore();
  } else if (scene.backgroundMode === "gradient") {
    fillGradientBackground(ctx, scene, width, height);
  } else if (scene.backgroundMode === "pattern") {
    fillPatternBackground(ctx, scene, width, height);
  } else if (scene.backgroundMode === "solid") {
    ctx.fillStyle = scene.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else if (scene.backgroundMode === "transparent" && backgroundFill) {
    ctx.fillStyle = backgroundFill;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, width, height);
  }

  const box = computeFrameBox(scene, width, height, pixelRatio, frameWidth, frameHeight, transform, frameX, frameY, activeLayerId);
  const activeLayerForRender2 = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
   const actualZoom = Math.max(RENDER.minZoom, transform?.zoom ?? activeLayerForRender2?.zoom ?? 1);

  drawFrameAndMedia(ctx, scene, spec, activeLayerForRender2, box, dpiScale, actualZoom, media, frameOverlay ?? null);

  if (scene.watermarkEnabled && scene.watermarkText) {
    drawWatermark(ctx, scene, width, height, dpiScale);
  }

  if (scene.annotations.length > 0) {
    drawAnnotations(ctx, scene.annotations, width, height, dpiScale);
  }
}