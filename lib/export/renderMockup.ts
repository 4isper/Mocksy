"use client";

import type { Annotation, EditorScene, MediaLayer } from "@/lib/types/editor";
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
  // Zoom scales the whole mockup (device + media together), matching the
  // preview where the transform is applied to the frame container. The media
  // pan (mediaOffsetX/Y) is applied inside the screen cutout, not to the
  // frame position, so the frame stays centered on the canvas.
  const x = typeof frameX === "number" ? frameX : (canvasWidth - frameW) / 2;
  const y = typeof frameY === "number" ? frameY : (canvasHeight - frameH) / 2;
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
 * Computes canvas-space geometry for multiple frame instances.
 * Positions are fractions (x/y 0..1) scaled to canvas size.
 */
export function computeFrameInstances(
  scene: EditorScene,
  canvasWidth: number,
  canvasHeight: number,
  pixelRatio: number,
  transform?: RenderTransform
): FrameBox[] {
  const instances = scene.frameInstances.length > 0 ? scene.frameInstances : [];
  if (instances.length === 0) return [];
  const dpiScale = pixelRatio;
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const actualZoom = Math.max(0.01, transform?.zoom ?? activeLayer?.zoom ?? 1);
  const frameAr = 10 / 16; // portrait phone default

  // Compute base frame size so N items fit
  const n = instances.length;
  const gap = 0.02; // 2% gap between frames
  const baseFrameW = Math.min(900, (canvasWidth / dpiScale) * 0.8) * dpiScale * actualZoom;
  const availableW = canvasWidth * (1 - gap * (n - 1));
  const frameW = (availableW / n) * actualZoom;
  const frameH = frameW * frameAr;

  return instances.map((inst, i) => {
    const spec = getFrameSpec(inst.frame);
    const instScale = inst.scale ?? 1;
    const w = frameW * instScale * dpiScale;
    const h = frameH * instScale * dpiScale;

    // Position based on x/y fraction
    const x = (canvasWidth - frameW * n * instScale) / 2 + inst.x * (frameW * instScale * (n - 1));
    const y = (canvasHeight - h) / 2 + inst.y * (canvasHeight - h);

    const cutout = spec.cutout;
    const padX = cutout ? (cutout.x / SVG_VIEWBOX_WIDTH) * w : spec.padding * dpiScale * actualZoom;
    const padY = cutout ? (cutout.y / SVG_VIEWBOX_HEIGHT) * h : spec.padding * dpiScale * actualZoom;
    const outerRadius = spec.isOverlay ? 0 : (scene.frame === "watch" ? Math.min(w, h) / 2 : scene.borderRadius + spec.padding) * dpiScale * actualZoom;

    return {
      x,
      y,
      width: w,
      height: h,
      outerRadius,
      innerX: x + padX,
      innerY: y + padY,
      innerW: w - padX * 2,
      innerH: h - padY * 2,
      innerRadius: cutout
        ? Math.max(0, (cutout.rx / cutout.w) * (w - padX * 2), (cutout.rx / cutout.h) * (h - padY * 2))
        : spec.screenRadius * dpiScale * actualZoom
    };
  });
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
  frameOverlay?: CanvasImageSource | null,
  backgroundImage?: CanvasImageSource | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const spec = getFrameSpec(scene.frame);
  const width = canvas.width;
  const height = canvas.height;
  const dpiScale = pixelRatio;
  const activeLayerForRender = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  ctx.clearRect(0, 0, width, height);

  // If frameInstances are defined, render a grid of frames instead of a single frame.
  // Each frame draws media from its associated layer (or the active layer if no layerId).
  if (scene.frameInstances.length > 0) {
    const frameBoxes = computeFrameInstances(scene, width, height, pixelRatio, transform);
    for (let i = 0; i < frameBoxes.length; i++) {
      const box = frameBoxes[i];
      const inst = scene.frameInstances[i];
      if (!box || !inst) continue;

      const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayerForRender;
      const instSpec = getFrameSpec(inst.frame);
      const instZoom = transform?.zoom ?? layer?.zoom ?? 1;

      // Load overlay if needed
      let overlay: HTMLImageElement | null = null;
      if (instSpec.isOverlay && instSpec.asset && instSpec.asset === spec.asset && frameOverlay) {
        overlay = frameOverlay as HTMLImageElement;
      }

      // Draw frame (shadow, border, media) — simplified version for grid
      drawFrameAndMedia(ctx, scene, layer, box, dpiScale, instZoom, media, overlay);
    }
    // Still draw watermark and annotations
    drawWatermark(ctx, scene, width, height, dpiScale);
    if (scene.annotations.length > 0) drawAnnotations(ctx, scene.annotations, width, height, dpiScale);
    return;
  }

  if (scene.backgroundMode === "image" && backgroundImage) {
    // Draw the uploaded background image to cover the canvas, then blur it. The
    // draw rect is expanded by twice the blur radius so the soft edges never
    // reveal transparency at the canvas border (matching the preview's
    // expanded background layer). Blur radius scales with DPI so the exported
    // PNG matches the on-screen blur in CSS px.
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
    ctx.fillRect(0, 0, width, height);
  } else if (scene.backgroundMode === "solid") {
    ctx.fillStyle = scene.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else if (scene.backgroundMode === "transparent" && backgroundFill) {
    ctx.fillStyle = backgroundFill;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Fallback for image mode without a loaded image, or unknown modes.
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
    // Use natural dimensions for images, video dimensions for videos. The
    // media is drawn at the cover scale for the (already zoomed) frame box,
    // so zoom from the frame multiplier above scales device + media together,
    // matching the preview where the transform is applied to the frame.
    const mw = m.videoWidth || m.naturalWidth || m.width || innerW;
    const mh = m.videoHeight || m.naturalHeight || m.height || innerH;
    // cover fills the frame and crops the overflow; contain fits the whole
    // media inside the frame and letterboxes the gaps. Both share the same
    // centering/pan math below, so only the scale choice differs.
    const fit = activeLayerForRender?.mediaFit ?? "cover";
    const scale = fit === "contain" ? Math.min(innerW / mw, innerH / mh) : Math.max(innerW / mw, innerH / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    // Pan the media inside the screen cutout. Using `(innerW - dw) / 2` exactly
    // matches the preview's `object-position: 50% + offset * 50%`: both place
    // the media edge at `(0.5 + offset/2) * (innerW - dw)` from the cutout left.
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

  if (scene.annotations.length > 0) {
    drawAnnotations(ctx, scene.annotations, width, height, dpiScale);
  }
}

/**
 * Draws non-media overlays (text, arrows, rectangles) onto the canvas. All
 * positions are fractions of the canvas and scaled by `dpiScale` so the export
 * matches the preview pixel-for-pixel. Drawn last, above the frame and
 * watermark, so callouts sit on top of the mockup.
 */
function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  width: number,
  height: number,
  dpiScale: number
) {
  for (const a of annotations) {
    const bx = Math.min(a.x, a.x + a.w) * width;
    const by = Math.min(a.y, a.y + a.h) * height;
    const bw = Math.abs(a.w) * width;
    const bh = Math.abs(a.h) * height;
    ctx.save();
    if (a.type === "text") {
      const fontSize = a.fontSize * dpiScale;
      ctx.fillStyle = a.color;
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 3 * dpiScale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1 * dpiScale;
      const lines = a.text.split("\n");
      const lineHeight = fontSize * 1.2;
      lines.forEach((line, i) => ctx.fillText(line, bx, by + i * lineHeight));
    } else if (a.type === "rect") {
      ctx.strokeStyle = a.color;
      ctx.lineWidth = Math.max(1, a.strokeWidth * dpiScale);
      ctx.strokeRect(bx, by, bw, bh);
    } else {
      const startX = a.x * width;
      const startY = a.y * height;
      const endX = (a.x + a.w) * width;
      const endY = (a.y + a.h) * height;
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = Math.max(1, a.strokeWidth * dpiScale);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      const angle = Math.atan2(endY - startY, endX - startX);
      const head = 14 * dpiScale;
      const a1 = angle + Math.PI - 0.45;
      const a2 = angle + Math.PI + 0.45;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX + head * Math.cos(a1), endY + head * Math.sin(a1));
      ctx.lineTo(endX + head * Math.cos(a2), endY + head * Math.sin(a2));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Draws a single frame's shadow, border, and media content. Used by multi-frame rendering. */
function drawFrameAndMedia(
  ctx: CanvasRenderingContext2D,
  scene: EditorScene,
  layer: MediaLayer | undefined,
  box: FrameBox,
  dpiScale: number,
  zoom: number,
  media: CanvasImageSource | null,
  overlay: CanvasImageSource | null
) {
  const spec = getFrameSpec(scene.frame);
  const { x, y, width: frameW, height: frameH, outerRadius, innerX, innerY, innerW, innerH, innerRadius } = box;

  // Draw shadow and glass border
  if (!spec.isOverlay) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(1, scene.shadowOpacity))})`;
    ctx.shadowBlur = RENDER.shadowBlur * dpiScale * zoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = RENDER.shadowOffsetY * dpiScale * zoom;
    roundedRectPath(ctx, x, y, frameW, frameH, outerRadius);
    ctx.fillStyle = scene.stylePreset === "glassDark" ? RENDER.glassDarkFill : RENDER.glassLightFill;
    ctx.fill();
    ctx.restore();

    if (scene.stylePreset === "outline" || scene.stylePreset.startsWith("glass")) {
      ctx.save();
      roundedRectPath(ctx, x, y, frameW, frameH, outerRadius);
      ctx.lineWidth = (scene.stylePreset === "outline" ? RENDER.outlineStroke : RENDER.glassStroke) * dpiScale * zoom;
      ctx.strokeStyle = scene.stylePreset === "glassDark" ? RENDER.glassDarkStroke : RENDER.glassLightStroke;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw media inside the frame
  ctx.save();
  roundedRectPath(ctx, innerX, innerY, innerW, innerH, innerRadius);
  ctx.clip();
  if (media) {
    const m = media as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number };
    const mw = m.videoWidth || m.naturalWidth || m.width || innerW;
    const mh = m.videoHeight || m.naturalHeight || m.height || innerH;
    const fit = layer?.mediaFit ?? "cover";
    const scale = fit === "contain" ? Math.min(innerW / mw, innerH / mh) : Math.max(innerW / mw, innerH / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    const offsetX = layer?.mediaOffsetX ?? 0;
    const offsetY = layer?.mediaOffsetY ?? 0;
    const dx = innerX + (innerW - dw) / 2 + offsetX * (innerW - dw) / 2;
    const dy = innerY + (innerH - dh) / 2 + offsetY * (innerH - dh) / 2;
    ctx.drawImage(media, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = RENDER.emptyMediaFill;
    ctx.fillRect(innerX, innerY, innerW, innerH);
  }
  ctx.restore();

  // Draw overlay skin if provided
  if (overlay) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(1, scene.shadowOpacity))})`;
    ctx.shadowBlur = RENDER.shadowBlur * dpiScale * zoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = RENDER.shadowOffsetY * dpiScale * zoom;
    ctx.drawImage(overlay, x, y, frameW, frameH);
    ctx.restore();
  }
}

/** Watermark drawing extracted for reuse in multi-frame mode. */
function drawWatermark(
  ctx: CanvasRenderingContext2D,
  scene: EditorScene,
  width: number,
  height: number,
  dpiScale: number
) {
  if (!scene.watermarkEnabled || !scene.watermarkText) return;
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

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

