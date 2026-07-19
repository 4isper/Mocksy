"use client";

import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec } from "@/lib/render/frames";

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

export interface RenderTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
  pad: number;
  outerRadius: number;
  innerX: number;
  innerY: number;
  innerW: number;
  innerH: number;
  innerRadius: number;
}

/**
 * Computes the canvas-space geometry for a frame. All values are in device px.
 * `frameWidth`/`frameHeight` arrive in device px (callers multiply offset sizes
 * by pixelRatio); keeping them in device px makes pad/radius/shadow scale
 * together and the media inset ratio match the CSS preview (spec.padding / frameWidth).
 */
export function computeFrameBox(
  scene: EditorScene,
  canvasWidth: number,
  canvasHeight: number,
  pixelRatio: number,
  frameWidth?: number,
  frameHeight?: number,
  transform?: RenderTransform,
  frameX?: number,
  frameY?: number
): FrameBox {
  const spec = getFrameSpec(scene.frame);
  const dpiScale = pixelRatio;
  const actualZoom = Math.max(0.01, transform?.zoom ?? scene.zoom);
  const defaultFrameW = Math.min(900, (canvasWidth / dpiScale) * 0.8) * dpiScale;
  const frameW = (typeof frameWidth === "number" && frameWidth > 0 ? frameWidth : defaultFrameW) * actualZoom;
  const frameH = (typeof frameHeight === "number" && frameHeight > 0 ? frameHeight : frameW * (10 / 16)) * actualZoom;
  const offsetX = (transform?.offsetX ?? 0) * dpiScale * actualZoom;
  const offsetY = (transform?.offsetY ?? 0) * dpiScale * actualZoom;
  const x = (typeof frameX === "number" ? frameX : (canvasWidth - frameW) / 2) + offsetX;
  const y = (typeof frameY === "number" ? frameY : (canvasHeight - frameH) / 2) + offsetY;
  const pad = spec.padding * dpiScale * actualZoom;
  // Circular frames (watch) ignore the corner radius and clip to a full circle.
  const isCircular = scene.frame === "watch";
  const outerRadius = isCircular
    ? Math.min(frameW, frameH) / 2
    : (spec.isOverlay ? spec.screenRadius : scene.borderRadius + spec.padding) * dpiScale * actualZoom;
  const innerX = x + pad;
  const innerY = y + pad;
  const innerW = frameW - pad * 2;
  const innerH = frameH - pad * 2;
  const innerRadius = isCircular ? Math.min(innerW, innerH) / 2 : Math.max(0, spec.screenRadius * dpiScale * actualZoom);
  return { x, y, width: frameW, height: frameH, pad, outerRadius, innerX, innerY, innerW, innerH, innerRadius };
}

/**
 * Renders the mockup onto a 2D canvas. For overlay frames (SVG device skins)
 * the caller should pass `frameOverlay` so the skin is drawn above the media.
 */
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
  frameOverlay?: CanvasImageSource | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const spec = getFrameSpec(scene.frame);
  const width = canvas.width;
  const height = canvas.height;
  const dpiScale = pixelRatio;
  ctx.clearRect(0, 0, width, height);

  if (scene.backgroundMode === "gradient") {
    const angle = ((120 - 90) * Math.PI) / 180;
    const x2 = width * Math.cos(angle);
    const y2 = height * Math.sin(angle);
    const grad = ctx.createLinearGradient(0, 0, x2, y2);
    grad.addColorStop(0, scene.gradientFrom);
    grad.addColorStop(1, scene.gradientTo);
    ctx.fillStyle = grad;
  } else if (scene.backgroundMode === "solid") {
    ctx.fillStyle = scene.backgroundColor;
  } else if (scene.backgroundMode === "transparent" && backgroundFill) {
    ctx.fillStyle = backgroundFill;
  } else {
    ctx.fillStyle = "rgba(0,0,0,0)";
  }
  ctx.fillRect(0, 0, width, height);

  const { x, y, width: frameW, height: frameH, pad, outerRadius, innerX, innerY, innerW, innerH, innerRadius } = computeFrameBox(
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
  const actualZoom = Math.max(0.01, transform?.zoom ?? scene.zoom);

  // Draw shadow (matches HTML box-shadow: 0 28px 70px), scaled with transform and DPI
  if (!spec.isOverlay) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(1, scene.shadowOpacity))})`;
    ctx.shadowBlur = 70 * dpiScale * actualZoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 28 * dpiScale * actualZoom;
    roundedRectPath(ctx, x, y, frameW, frameH, outerRadius);
    ctx.fillStyle = scene.stylePreset === "glassDark" ? "rgba(7,7,9,0.35)" : "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.restore();

    if (scene.stylePreset === "outline" || scene.stylePreset.startsWith("glass")) {
      ctx.save();
      roundedRectPath(ctx, x, y, frameW, frameH, outerRadius);
      ctx.lineWidth = (scene.stylePreset === "outline" ? 2 : 1) * dpiScale * actualZoom;
      ctx.strokeStyle = scene.stylePreset === "glassDark" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.45)";
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
    // Use natural dimensions for images, video dimensions for videos
    const mw = m.videoWidth || m.naturalWidth || m.width || innerW;
    const mh = m.videoHeight || m.naturalHeight || m.height || innerH;
    const scale = Math.max(innerW / mw, innerH / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    const dx = innerX + (innerW - dw) / 2;
    const dy = innerY + (innerH - dh) / 2;
    ctx.drawImage(media, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(innerX, innerY, innerW, innerH);
  }
  ctx.restore();

  if (frameOverlay) {
    ctx.drawImage(frameOverlay, x, y, frameW, frameH);
  }

  if (scene.watermarkEnabled && scene.watermarkText) {
    const watermarkSize = 24 * dpiScale;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${watermarkSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(scene.watermarkText, width - watermarkSize, height - watermarkSize);
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

