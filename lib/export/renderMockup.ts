"use client";

import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec, SVG_VIEWBOX_HEIGHT, SVG_VIEWBOX_WIDTH } from "@/lib/render/frames";

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

// Canvas render tuning. Values mirror the CSS preview (box-shadow, aspect, glass
// fills) so the exported PNG matches what the user sees on screen.
const RENDER = {
  /** Default frame width (px) when callers don't pass an explicit size. */
  defaultFrameWidth: 900,
  /** Fraction of the canvas the default frame should occupy. */
  defaultFrameFill: 0.8,
  /** Default frame aspect ratio (width / height) when height is omitted. */
  defaultAspect: 10 / 16,
  /** Box-shadow blur radius (px) and vertical offset (px), matching CSS 0 28px 70px. */
  shadowBlur: 70,
  shadowOffsetY: 28,
  /** Border stroke widths (px) for outline vs glass presets. */
  outlineStroke: 2,
  glassStroke: 1,
  /** Glass frame fills and stroke colors. */
  glassDarkFill: "rgba(7,7,9,0.35)",
  glassLightFill: "rgba(255,255,255,0.06)",
  glassDarkStroke: "rgba(255,255,255,0.2)",
  glassLightStroke: "rgba(255,255,255,0.45)",
  /** Background of the media placeholder when no media is loaded. */
  emptyMediaFill: "rgba(255,255,255,0.04)",
  /** Gradient angle in degrees (120deg in CSS). */
  gradientAngleDeg: 120
} as const;

export interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
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
  const activeLayerForRender = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const actualZoom = Math.max(0.01, transform?.zoom ?? activeLayerForRender?.zoom ?? 1);
  const defaultFrameW = Math.min(RENDER.defaultFrameWidth, (canvasWidth / dpiScale) * RENDER.defaultFrameFill) * dpiScale;
  const frameW = (typeof frameWidth === "number" && frameWidth > 0 ? frameWidth : defaultFrameW) * actualZoom;
  const frameH = (typeof frameHeight === "number" && frameHeight > 0 ? frameHeight : frameW * RENDER.defaultAspect) * actualZoom;
  const offsetX = (transform?.offsetX ?? 0) * dpiScale * actualZoom;
  const offsetY = (transform?.offsetY ?? 0) * dpiScale * actualZoom;
  const x = (typeof frameX === "number" ? frameX : (canvasWidth - frameW) / 2) + offsetX;
  const y = (typeof frameY === "number" ? frameY : (canvasHeight - frameH) / 2) + offsetY;
  // Overlay skins define their screen cutout in viewBox units; convert to
  // device px off the rendered frame so the media matches the skin at any size.
  // Other frames use a simple padding-based inset.
  const cutout = spec.cutout;
  const padX = cutout ? (cutout.x / SVG_VIEWBOX_WIDTH) * frameW : spec.padding * dpiScale * actualZoom;
  const padY = cutout ? (cutout.y / SVG_VIEWBOX_HEIGHT) * frameH : spec.padding * dpiScale * actualZoom;
  // X and Y insets differ because the skin viewBox is not square; innerX/Y/W/H
  // use the correct per-axis values below.
  // Circular frames (watch) ignore the corner radius and clip to a full circle.
  const isCircular = scene.frame === "watch";
  const outerRadius = isCircular
    ? Math.min(frameW, frameH) / 2
    : (spec.isOverlay ? spec.screenRadius : scene.borderRadius + spec.padding) * dpiScale * actualZoom;
  const innerX = x + padX;
  const innerY = y + padY;
  const innerW = frameW - padX * 2;
  const innerH = frameH - padY * 2;
  const innerRadius = isCircular
    ? Math.min(innerW, innerH) / 2
    : cutout
      ? Math.max(0, (cutout.rx / cutout.w) * innerW, (cutout.rx / cutout.h) * innerH)
      : Math.max(0, spec.screenRadius * dpiScale * actualZoom);
  return { x, y, width: frameW, height: frameH, outerRadius, innerX, innerY, innerW, innerH, innerRadius };
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
  const activeLayerForRender = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  ctx.clearRect(0, 0, width, height);

  if (scene.backgroundMode === "gradient") {
    // Emulate CSS linear-gradient(angleDeg, from, to): the gradient line runs
    // through the center at `angle`, and 0%/100% stops reach the box edges so
    // the color spread matches the preview exactly. CSS 0deg points up and the
    // angle increases clockwise; in canvas coords (y down) the direction unit
    // vector is (sin a, -cos a).
    const rad = (RENDER.gradientAngleDeg * Math.PI) / 180;
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
  } else if (scene.backgroundMode === "solid") {
    ctx.fillStyle = scene.backgroundColor;
  } else if (scene.backgroundMode === "transparent" && backgroundFill) {
    ctx.fillStyle = backgroundFill;
  } else {
    ctx.fillStyle = "rgba(0,0,0,0)";
  }
  ctx.fillRect(0, 0, width, height);

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

  // Draw shadow (matches HTML box-shadow: 0 28px 70px), scaled with transform and DPI
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
    // Use natural dimensions for images, video dimensions for videos
    const mw = m.videoWidth || m.naturalWidth || m.width || innerW;
    const mh = m.videoHeight || m.naturalHeight || m.height || innerH;
    const scale = Math.max(innerW / mw, innerH / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    // Pan the media inside the screen area by a fraction of half its size,
    // matching the CSS object-position used in the live preview.
    const offsetX = activeLayerForRender?.mediaOffsetX ?? 0;
    const offsetY = activeLayerForRender?.mediaOffsetY ?? 0;
    const dx = innerX + (innerW - dw) / 2 + offsetX * (innerW / 2);
    const dy = innerY + (innerH - dh) / 2 + offsetY * (innerH / 2);
    ctx.drawImage(media, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = RENDER.emptyMediaFill;
    ctx.fillRect(innerX, innerY, innerW, innerH);
  }
  ctx.restore();

  if (frameOverlay) {
    // Match the on-screen drop-shadow: a CSS box-shadow would paint a second
    // rectangle, so the preview uses a body-shaped drop-shadow on the overlay
    // image. Replicate it here with a canvas shadow before drawing the skin.
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(1, scene.shadowOpacity))})`;
    ctx.shadowBlur = RENDER.shadowBlur * dpiScale * actualZoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = RENDER.shadowOffsetY * dpiScale * actualZoom;
    ctx.drawImage(frameOverlay, x, y, frameW, frameH);
    ctx.restore();
  }

  if (scene.watermarkEnabled && scene.watermarkText) {
    // Mirror the on-screen .preview-watermark: weight 500, white at 0.85,
    // 16px inset from the canvas edge, and a soft text shadow for legibility.
    // Scale by dpiScale so the exported watermark matches the preview exactly;
    // position and size come from the scene so the PNG matches the preview.
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
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

