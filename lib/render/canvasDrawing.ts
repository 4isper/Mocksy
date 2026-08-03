import type { Annotation, EditorScene, MediaLayer } from "@/lib/types/editor";
import type { FrameBox } from "./frameGeometry";
import { getFrameSpec } from "@/lib/render/frames";

export const RENDER = {
  defaultFrameWidth: 900,
  defaultFrameFill: 0.8,
  defaultAspect: 10 / 16,
  shadowBlur: 70,
  shadowOffsetY: 28,
  outlineStroke: 2,
  glassStroke: 1,
  glassDarkFill: "rgba(7,7,9,0.35)",
  glassLightFill: "rgba(255,255,255,0.06)",
  glassDarkStroke: "rgba(255,255,255,0.2)",
  glassLightStroke: "rgba(255,255,255,0.45)",
  emptyMediaFill: "rgba(255,255,255,0.04)",
  gradientAngleDeg: 120,
  annoShadowBlur: 3,
  annoShadowOffsetY: 1,
  watermarkInset: 16,
  lineHeightMultiplier: 1.2,
  arrowHead: 14,
  minZoom: 0.01
} as const;

export function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

export function drawAnnotations(
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
      const weight = a.fontWeight === "normal" ? "400" : "600";
      const style = a.fontStyle === "italic" ? "italic " : "";
      ctx.font = `${style}${weight} ${fontSize}px ${a.fontFamily ?? "Inter, system-ui, sans-serif"}`;
      ctx.textBaseline = "top";
      const align = a.textAlign ?? "left";
      ctx.textAlign = align === "center" ? "center" : align === "right" ? "right" : "left";
      const textX = align === "center" ? bx + bw / 2 : align === "right" ? bx + bw : bx;
      const lines = a.text.split("\n");
      const lineHeight = fontSize * RENDER.lineHeightMultiplier;
      const textHeight = lines.length * lineHeight;
      const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
      const padding = (a.bgPadding ?? 0) * dpiScale;
      if (a.bgColor && textWidth > 0) {
        const radius = (a.bgRadius ?? 0) * dpiScale;
        const boxX = align === "center" ? textX - textWidth / 2 - padding : align === "right" ? textX - textWidth - padding : textX - padding;
        const boxY = by - padding;
        const boxW = textWidth + padding * 2;
        const boxH = textHeight + padding * 2;
        ctx.save();
        ctx.fillStyle = a.bgColor;
        roundedRectPath(ctx, boxX, boxY, boxW, boxH, radius);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = a.color;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = RENDER.annoShadowBlur * dpiScale;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = RENDER.annoShadowOffsetY * dpiScale;
      lines.forEach((line, i) => ctx.fillText(line, textX, by + i * lineHeight));
    } else if (a.type === "rect") {
      ctx.strokeStyle = a.color;
      ctx.lineWidth = Math.max(1, a.strokeWidth * dpiScale);
      ctx.strokeRect(bx, by, bw, bh);
    } else if (a.type === "circle") {
      ctx.strokeStyle = a.color;
      ctx.lineWidth = Math.max(1, a.strokeWidth * dpiScale);
      ctx.beginPath();
      ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const startX = a.x * width;
      const startY = a.y * height;
      const endX = (a.x + a.w) * width;
      const endY = (a.y + a.h) * height;
      const angle = Math.atan2(endY - startY, endX - startX);
      const head = RENDER.arrowHead * dpiScale;
      const a1 = angle + Math.PI - 0.45;
      const a2 = angle + Math.PI + 0.45;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
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

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  scene: EditorScene,
  width: number,
  height: number,
  dpiScale: number,
  watermarkImage?: CanvasImageSource | null
) {
  if (!scene.watermarkEnabled) return;
  const hasImage = scene.watermarkImageUrl != null;
  if (!hasImage && !scene.watermarkText) return;
  const watermarkSize = scene.watermarkSize * dpiScale;
  const inset = RENDER.watermarkInset * dpiScale;
  const onLeft = scene.watermarkPosition === "bottom-left" || scene.watermarkPosition === "top-left";
  const onTop = scene.watermarkPosition === "top-right" || scene.watermarkPosition === "top-left";

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = RENDER.annoShadowBlur * dpiScale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = RENDER.annoShadowOffsetY * dpiScale;

  if (hasImage && watermarkImage) {
    const m = watermarkImage as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
    const iw = m.naturalWidth || m.width || 1;
    const ih = m.naturalHeight || m.height || 1;
    const aspect = iw / ih;
    let drawW = watermarkSize * aspect;
    // Wide logos must not dominate the corner: cap at 40% of the canvas width.
    const maxW = width * 0.4;
    if (drawW > maxW) drawW = maxW;
    const drawH = drawW / aspect;
    const imgX = onLeft ? inset : width - inset - drawW;
    const imgY = onTop ? inset : height - inset - drawH;
    ctx.drawImage(watermarkImage, imgX, imgY, drawW, drawH);
    ctx.restore();
    return;
  }

  const textX = onLeft ? inset : width - inset;
  const textY = onTop ? inset + watermarkSize : height - inset;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `500 ${watermarkSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = onLeft ? "left" : "right";
  ctx.textBaseline = onTop ? "top" : "alphabetic";
  ctx.fillText(scene.watermarkText, textX, textY);
  ctx.restore();
}

export function drawFrameAndMedia(
  ctx: CanvasRenderingContext2D,
  scene: EditorScene,
  instSpec: ReturnType<typeof getFrameSpec>,
  layer: MediaLayer | undefined,
  box: FrameBox,
  dpiScale: number,
  zoom: number,
  media: CanvasImageSource | null,
  overlay: CanvasImageSource | null
) {
  const { x, y, width: frameW, height: frameH, outerRadius, innerX, innerY, innerW, innerH, innerRadius } = box;

  if (!instSpec.isOverlay) {
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