"use client";

import type { EditorScene } from "@/lib/types/editor";

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

function framePadding(frame: EditorScene["frame"]) {
  if (frame === "iphone") return 18;
  if (frame === "tablet") return 14;
  if (frame === "desktop") return 10;
  return 0;
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
  zoom = 1,
  backgroundFill?: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

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

  const actualZoom = Math.max(0.01, zoom);
  const baseFrameW = typeof frameWidth === "number" && frameWidth > 0
    ? frameWidth
    : Math.min(900, width / dpiScale * 0.8) * dpiScale;
  const baseFrameH = typeof frameHeight === "number" && frameHeight > 0
    ? frameHeight
    : baseFrameW * (10 / 16);
  const frameW = baseFrameW * actualZoom;
  const frameH = baseFrameH * actualZoom;
  const x = typeof frameX === "number" ? frameX : (width - frameW) / 2;
  const y = typeof frameY === "number" ? frameY : (height - frameH) / 2;
  const pad = framePadding(scene.frame) * dpiScale * actualZoom;
  const outerRadius = (scene.borderRadius + framePadding(scene.frame)) * dpiScale * actualZoom;
  const innerX = x + pad;
  const innerY = y + pad;
  const innerW = frameW - pad * 2;
  const innerH = frameH - pad * 2;
  const innerRadius = Math.max(0, scene.borderRadius * dpiScale * actualZoom);

  // Draw shadow (matches HTML box-shadow: 0 28px 70px), scaled with transform and DPI
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

  if (scene.watermarkEnabled && scene.watermarkText) {
    const watermarkSize = 24 * dpiScale;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${watermarkSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(scene.watermarkText, width - watermarkSize, height - watermarkSize);
  }
}
