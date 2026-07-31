"use client";

import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { frameViewBox, getFrameSpec } from "@/lib/render/frames";
import { RENDER, drawAnnotations, drawFrameAndMedia, drawWatermark } from "@/lib/render/canvasDrawing";
import { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
import type { FrameBox, RenderTransform } from "@/lib/render/frameGeometry";
import { computeFrameBox, computeFrameInstances } from "@/lib/render/frameGeometry";

export { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
export type { FrameBox, RenderTransform } from "@/lib/render/frameGeometry";

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
  frameOverlays?: Map<string, CanvasImageSource | null>
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const spec = getFrameSpec(scene.frame);
  const width = canvas.width;
  const height = canvas.height;
  const dpiScale = pixelRatio;
  const activeLayerForRender = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  ctx.clearRect(0, 0, width, height);

  if (scene.frameInstances.length > 0) {
    if (scene.backgroundMode === "gradient") {
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
      grad.addColorStop(1, scene.gradientTo);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
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

    const frameBoxes = computeFrameInstances(scene, width, height, pixelRatio, transform);
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
    grad.addColorStop(1, scene.gradientTo);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
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

  const { x, y, width: frameW, height: frameH, outerRadius, innerX, innerY, innerW, innerH, innerRadius } = computeFrameBox(
    scene,
    width,
    height,
    pixelRatio,
    frameWidth,
    frameHeight,
    transform,
    frameX,
    frameY
  );
  const activeLayerForRender2 = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const actualZoom = Math.max(0.01, transform?.zoom ?? activeLayerForRender2?.zoom ?? 1);

  if (!spec.isOverlay) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(1, scene.shadowOpacity))})`;
    ctx.shadowBlur = RENDER.shadowBlur * dpiScale * actualZoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = RENDER.shadowOffsetY * dpiScale * actualZoom;
    roundedRectPath(ctx, x, y, frameW, frameH, outerRadius);
    ctx.fillStyle = scene.stylePreset === "glassDark" ? RENDER.glassDarkFill : RENDER.glassLightFill;
    ctx.fill();
    ctx.restore();

    if (scene.stylePreset === "outline" || scene.stylePreset.startsWith("glass")) {
      ctx.save();
      roundedRectPath(ctx, x, y, frameW, frameH, outerRadius);
      ctx.lineWidth = (scene.stylePreset === "outline" ? RENDER.outlineStroke : RENDER.glassStroke) * dpiScale * actualZoom;
      ctx.strokeStyle = scene.stylePreset === "glassDark" ? RENDER.glassDarkStroke : RENDER.glassLightStroke;
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  roundedRectPath(ctx, innerX, innerY, innerW, innerH, innerRadius);
  ctx.clip();
  if (media) {
    const m = media as {
      width?: number;
      height?: number;
      naturalWidth?: number;
      naturalHeight?: number;
      videoWidth?: number;
      videoHeight?: number;
    };
    const mw = m.videoWidth || m.naturalWidth || m.width || innerW;
    const mh = m.videoHeight || m.naturalHeight || m.height || innerH;
    const fit = activeLayerForRender?.mediaFit ?? "cover";
    const scale = fit === "contain" ? Math.min(innerW / mw, innerH / mh) : Math.max(innerW / mw, innerH / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    const offsetX = activeLayerForRender?.mediaOffsetX ?? 0;
    const offsetY = activeLayerForRender?.mediaOffsetY ?? 0;
    const dx = innerX + (innerW - dw) / 2 + offsetX * (innerW - dw) / 2;
    const dy = innerY + (innerH - dh) / 2 + offsetY * (innerH - dh) / 2;
    ctx.drawImage(media, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = RENDER.emptyMediaFill;
    ctx.fillRect(innerX, innerY, innerW, innerH);
  }
  ctx.restore();

  if (frameOverlay) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(1, scene.shadowOpacity))})`;
    ctx.shadowBlur = RENDER.shadowBlur * dpiScale * actualZoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = RENDER.shadowOffsetY * dpiScale * actualZoom;
    ctx.drawImage(frameOverlay, x, y, frameW, frameH);
    ctx.restore();
  }

  if (scene.watermarkEnabled && scene.watermarkText) {
    const watermarkSize = scene.watermarkSize * dpiScale;
    const inset = 16 * dpiScale;
    const onLeft = scene.watermarkPosition === "bottom-left" || scene.watermarkPosition === "top-left";
    const onTop = scene.watermarkPosition === "top-right" || scene.watermarkPosition === "top-left";
    const textX = onLeft ? inset : width - inset;
    const textY = onTop ? inset + watermarkSize : height - inset;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `500 ${watermarkSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = onLeft ? "left" : "right";
    ctx.textBaseline = onTop ? "top" : "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 3 * dpiScale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1 * dpiScale;
    ctx.fillText(scene.watermarkText, textX, textY);
    ctx.restore();
  }

  if (scene.annotations.length > 0) {
    drawAnnotations(ctx, scene.annotations, width, height, dpiScale);
  }
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}