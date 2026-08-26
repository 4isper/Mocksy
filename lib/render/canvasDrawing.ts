import type { Annotation, EditorScene, MediaLayer, ScreenChrome, StylePreset } from "@/lib/types/editor";
import type { FrameBox } from "./frameGeometry";
import { getFrameSpec, frameOs } from "@/lib/render/frames";
import { createLayerCanvas, layerContext } from "@/lib/render/canvasFactory";
import { watermarkEdges } from "@/lib/render/watermark";
import { buildLayerFilterCss } from "@/lib/render/layerFilters";
import { drawTextLayer, isTextLayer } from "@/lib/render/layerText";
import { drawScreenChrome } from "@/lib/render/screenChrome";
import { drawBrowserUrl } from "@/lib/render/browserChrome";
import { CORNER_POWER_CIRCLE, traceSquirclePath } from "@/lib/render/squircle";
import { overlayScaleFor } from "@/lib/render/overlayMetrics";

export const RENDER = {
  defaultFrameWidth: 900,
  defaultFrameFill: 0.8,
  defaultAspect: 10 / 16,
  shadowBlur: 70,
  shadowOffsetY: 28,
  outlineStroke: 2,
  glassStroke: 1,
  glassDarkFill: "rgba(6,6,6,0.25)",
  glassLightFill: "rgba(255,255,255,0.06)",
  glassDarkStroke: "rgba(255,255,255,0.15)",
  glassLightStroke: "rgba(255,255,255,0.45)",
  emptyMediaFill: "rgba(255,255,255,0.04)",
  gradientAngleDeg: 120,
  annoShadowBlur: 3,
  annoShadowOffsetY: 1,
  watermarkInset: 16,
  lineHeightMultiplier: 1.2,
  arrowHead: 14,
  minZoom: 0.01,
  /** Floor reflection: alpha at the device's bottom edge (fades to 0). */
  reflectionOpacity: 0.28,
  /** Reflection fade length as a fraction of the box height below the edge.
   *  Shared by the canvas and SVG renderers so exports can't drift apart. */
  reflectionFade: 0.55
} as const;

export interface ResolvedFrameStyle {
  fill: string;
  stroke: boolean;
  strokeWidth: number;
  strokeStyle: string;
}

/**
 * Maps a style preset to its frame chrome (fill + optional stroke). Shared by
 * the canvas and SVG renderers so adding a preset stays in one place and the
 * raster/vector exports can never drift from each other.
 */
export function resolveFrameStyle(stylePreset: StylePreset): ResolvedFrameStyle {
  return {
    fill: stylePreset === "glassDark" ? RENDER.glassDarkFill : RENDER.glassLightFill,
    stroke: stylePreset === "outline" || stylePreset.startsWith("glass"),
    strokeWidth: stylePreset === "outline" ? RENDER.outlineStroke : RENDER.glassStroke,
    strokeStyle: stylePreset === "glassDark" ? RENDER.glassDarkStroke : RENDER.glassLightStroke
  };
}

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
  height: number
) {
  // Overlay chrome scales with the artboard (reference width), not with the
  // export DPI — see overlayMetrics.ts. This keeps exports deterministic no
  // matter the window size at export time.
  const s = overlayScaleFor(width);
  for (const a of annotations) {
    const bx = Math.min(a.x, a.x + a.w) * width;
    const by = Math.min(a.y, a.y + a.h) * height;
    const bw = Math.abs(a.w) * width;
    const bh = Math.abs(a.h) * height;
    ctx.save();
    if (a.type === "text") {
      const fontSize = a.fontSize * s;
       const weight = a.fontWeight === "normal" ? "400" : "bold";
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
      const padding = (a.bgPadding ?? 0) * s;
      if (a.bgColor && textWidth > 0) {
        const radius = (a.bgRadius ?? 0) * s;
        const boxX = align === "center" ? textX - textWidth / 2 - padding : align === "right" ? textX - textWidth - padding : textX - padding;
        const boxY = by;
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
      ctx.shadowBlur = RENDER.annoShadowBlur * s;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = RENDER.annoShadowOffsetY * s;
      // With a background, the preview insets the text by `bgPadding`, so the
      // text starts at `by + padding`; keep the export in step.
      const textTop = by + (a.bgColor ? padding : 0);
      lines.forEach((line, i) => ctx.fillText(line, textX, textTop + i * lineHeight));
    } else if (a.type === "rect") {
      ctx.strokeStyle = a.color;
      const sw = Math.max(1, a.strokeWidth * s);
      ctx.lineWidth = sw;
      // Match the preview's `border-box`: the outer edge of the stroke sits on
      // the box edge (CSS centers the border on the box edge), so inset by half
      // the stroke width instead of stroking centered on the path.
      ctx.strokeRect(bx + sw / 2, by + sw / 2, Math.max(0, bw - sw), Math.max(0, bh - sw));
    } else if (a.type === "circle") {
      ctx.strokeStyle = a.color;
      const sw = Math.max(1, a.strokeWidth * s);
      ctx.lineWidth = sw;
      ctx.beginPath();
      ctx.ellipse(bx + bw / 2, by + bh / 2, Math.max(0, bw / 2 - sw / 2), Math.max(0, bh / 2 - sw / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (a.type === "blur") {
      // Frosted region: snapshot what's already painted (background + frames +
      // media) and redraw it blurred inside the rounded rect — the canvas
      // equivalent of the preview's backdrop-filter.
      const source = ctx.canvas as HTMLCanvasElement | OffscreenCanvas | undefined;
      if (source && bw > 0 && bh > 0) {
        const snap = createLayerCanvas(source.width, source.height);
        const sctx = layerContext(snap);
        if (sctx) {
          sctx.drawImage(source as CanvasImageSource, 0, 0);
          ctx.save();
          roundedRectPath(ctx, bx, by, bw, bh, Math.min(bw, bh) * 0.12);
          ctx.clip();
          // Matches CSS blur(Npx)/SVG stdDeviation N at the same strength.
          ctx.filter = `blur(${Math.max(1, a.strokeWidth * s)}px)`;
          ctx.drawImage(snap, 0, 0);
          ctx.restore();
        }
      }
    } else {
      const startX = a.x * width;
      const startY = a.y * height;
      const endX = (a.x + a.w) * width;
      const endY = (a.y + a.h) * height;
      const angle = Math.atan2(endY - startY, endX - startX);
      const head = RENDER.arrowHead * s;
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
  watermarkImage?: CanvasImageSource | null
) {
  if (!scene.watermarkEnabled) return;
  const hasImage = scene.watermarkImageUrl != null;
  if (!hasImage && !scene.watermarkText) return;
  const s = overlayScaleFor(width);
  const watermarkSize = scene.watermarkSize * s;
  const inset = RENDER.watermarkInset * s;
  const { onLeft, onTop } = watermarkEdges(scene.watermarkPosition);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = RENDER.annoShadowBlur * s;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = RENDER.annoShadowOffsetY * s;

  if (hasImage && watermarkImage) {
    const m = watermarkImage as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
    const iw = m.naturalWidth || m.width || 1;
    const ih = m.naturalHeight || m.height || 1;
    const aspect = iw / ih;
    let drawW = watermarkSize * aspect;
    // Wide logos must not dominate the corner: cap at 45% of the canvas width.
    const maxW = width * 0.45;
    if (drawW > maxW) drawW = maxW;
    const drawH = drawW / aspect;
    const imgX = onLeft ? inset : width - inset - drawW;
    const imgY = onTop ? inset : height - inset - drawH;
    ctx.drawImage(watermarkImage, imgX, imgY, drawW, drawH);
    ctx.restore();
    return;
  }

  const textX = onLeft ? inset : width - inset;
  const textY = onTop ? inset : height - inset;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `500 ${watermarkSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = onLeft ? "left" : "right";
  ctx.textBaseline = onTop ? "top" : "bottom";
  ctx.fillText(scene.watermarkText, textX, textY);
  ctx.restore();
}

/**
 * Draws the device drop shadow by casting it from an explicit OPAQUE
 * silhouette on an isolated layer, then erasing the silhouette with its own
 * mask so only the halo composites onto the scene. Canvas shadows derive
 * their alpha from the drawn shape — the real shapes here are either
 * semi-transparent (glass body fills) or an SVG skin raster whose thin,
 * partly translucent artwork renders the shadow far weaker than the preview's
 * CSS drop-shadow. The silhouette mirrors what the preview's drop-shadow
 * sees (skin artwork ∪ screen cutout, or the whole glass box), so the shadow
 * hugs the device with no light ring and no silhouette color bleeding
 * through transparent artwork margins. Falls back to the legacy direct
 * shadow when layer canvases are unavailable (tests/SSR).
 */
function drawFrameShadow(
  ctx: CanvasRenderingContext2D,
  box: FrameBox,
  scene: EditorScene,
  dpiScale: number,
  zoom: number,
  silhouette?: { image: CanvasImageSource; cutout?: { x: number; y: number; w: number; h: number; r: number } } | null
) {
  const opacity = Math.max(0, Math.min(1, scene.shadowOpacity));
  if (opacity <= 0) return;
  const padX = RENDER.shadowBlur * dpiScale * zoom + 4;
  const padY = (RENDER.shadowBlur + RENDER.shadowOffsetY) * dpiScale * zoom + 4;
  const w = Math.ceil(box.width + padX * 2);
  const h = Math.ceil(box.height + padY * 2);

  // 1) Opaque black silhouette mask in layer-local coordinates: the skin
  //    artwork plus the screen cutout (the areas the group fills opaquely),
  //    or simply the rounded box for glass body frames.
  const mask = createLayerCanvas(w, h);
  const mctx = layerContext(mask);
  if (!mctx) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${opacity})`;
    ctx.shadowBlur = RENDER.shadowBlur * dpiScale * zoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = RENDER.shadowOffsetY * dpiScale * zoom;
    roundedRectPath(ctx, box.x, box.y, box.width, box.height, box.outerRadius);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
    return;
  }
  mctx.fillStyle = "#000";
  if (silhouette) {
    mctx.drawImage(silhouette.image, padX, padY, box.width, box.height);
    mctx.globalCompositeOperation = "source-in";
    mctx.fillRect(0, 0, w, h);
    mctx.globalCompositeOperation = "source-over";
    if (silhouette.cutout) {
      const c = silhouette.cutout;
      roundedRectPath(mctx, padX + (c.x - box.x), padY + (c.y - box.y), c.w, c.h, c.r);
      mctx.fill();
    }
  } else {
    roundedRectPath(mctx, padX, padY, box.width, box.height, box.outerRadius);
    mctx.fill();
  }

  // 2) Cast the shadow from the mask; 3) erase the mask itself so only the
  //    halo remains (the frame body/media/skin repaint the interior).
  const layer = createLayerCanvas(w, h);
  const lctx = layerContext(layer);
  if (!lctx) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${opacity})`;
    ctx.shadowBlur = RENDER.shadowBlur * dpiScale * zoom;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = RENDER.shadowOffsetY * dpiScale * zoom;
    ctx.drawImage(mask as CanvasImageSource, box.x - padX, box.y - padY);
    ctx.restore();
    return;
  }
  lctx.save();
  lctx.shadowColor = `rgba(0,0,0,${opacity})`;
  lctx.shadowBlur = RENDER.shadowBlur * dpiScale * zoom;
  lctx.shadowOffsetX = 0;
  lctx.shadowOffsetY = RENDER.shadowOffsetY * dpiScale * zoom;
  lctx.drawImage(mask as CanvasImageSource, 0, 0);
  lctx.restore();
  lctx.globalCompositeOperation = "destination-out";
  lctx.drawImage(mask as CanvasImageSource, 0, 0);
  lctx.globalCompositeOperation = "source-over";
  ctx.drawImage(layer as CanvasImageSource, box.x - padX, box.y - padY);
}

export function drawFrameAndMedia(  ctx: CanvasRenderingContext2D,
  scene: EditorScene,
  instSpec: ReturnType<typeof getFrameSpec>,
  layer: MediaLayer | undefined,
  box: FrameBox,
  dpiScale: number,
  zoom: number,
  media: CanvasImageSource | null,
  overlay: CanvasImageSource | null,
  screen: ScreenChrome = scene.screen
) {
  const { x, y, width: frameW, height: frameH, outerRadius, innerX, innerY, innerW, innerH, innerRadius } = box;
  // Overlay screens clip to the skin's squircle cutout so the media fills the
  // transparent hole exactly; CSS-only frames keep the circular clip.
  const cutout = instSpec.isOverlay ? instSpec.cutout : null;
  const screenRx = cutout ? (cutout.rx / cutout.w) * innerW : innerRadius;
  const screenRy = cutout ? (cutout.rx / cutout.h) * innerH : innerRadius;
  const clipScreen = () => {
    if (cutout) traceSquirclePath(ctx, innerX, innerY, innerW, innerH, screenRx, screenRy, cutout.power ?? CORNER_POWER_CIRCLE);
    else roundedRectPath(ctx, innerX, innerY, innerW, innerH, innerRadius);
    ctx.clip();
  };

  if (!instSpec.isOverlay) {
    // Cast the drop shadow from an opaque rounded-rect silhouette (see
    // drawFrameShadow), then paint the actual body — whose glass fills are
    // nearly transparent and would produce a barely-visible shadow.
    drawFrameShadow(ctx, box, scene, dpiScale, zoom);

    ctx.save();
    roundedRectPath(ctx, x, y, frameW, frameH, outerRadius);
    ctx.fillStyle = resolveFrameStyle(scene.stylePreset).fill;
    ctx.fill();
    ctx.restore();

    const frameStyle = resolveFrameStyle(scene.stylePreset);
    if (frameStyle.stroke) {
      ctx.save();
      roundedRectPath(ctx, x, y, frameW, frameH, outerRadius);
      ctx.lineWidth = frameStyle.strokeWidth * dpiScale * zoom;
      ctx.strokeStyle = frameStyle.strokeStyle;
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  clipScreen();
  // Layer opacity applies to the media only — chrome/glare/bezel below stay
  // at full strength, mirroring the CSS preview's per-element opacity.
  const layerOpacity = Math.max(0, Math.min(1, (layer?.opacity ?? 100) / 100));
  if (media) {
    ctx.globalAlpha = layerOpacity;
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
    const rotation = layer?.rotation ?? 0;
    if (rotation) {
      // Rotate the media about the inner screen's center so the rotation pivot
      // matches the CSS preview (transform-origin: center) and stays inside the
      // rounded-screen clip.
      ctx.translate(innerX + innerW / 2, innerY + innerH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-(innerX + innerW / 2), -(innerY + innerH / 2));
    }
    ctx.filter = buildLayerFilterCss(layer);
    ctx.drawImage(media, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
  } else if (isTextLayer(layer)) {
    // Text layers paint styled text instead of media, using the exact layout
    // the CSS/SVG renderers embed (same constants from layerText.ts).
    ctx.globalAlpha = layerOpacity;
    drawTextLayer(ctx, layer as MediaLayer, innerX, innerY, innerW, innerH);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = RENDER.emptyMediaFill;
    ctx.fillRect(innerX, innerY, innerW, innerH);
  }
  ctx.restore();

  // On-screen decoration (status bar, lock clock, home dock) sits on top of
  // the media but under the device bezel, clipped to the rounded screen.
  if (screen.enabled) {
    ctx.save();
    clipScreen();
    drawScreenChrome(ctx, { ...screen, os: frameOs(box.frame) }, innerX, innerY, innerW, innerH);
    ctx.restore();
  }

  // Screen glare: diagonal light sweep clipped to the rounded screen, painted
  // above media/chrome and below the device skin. Stops mirror
  // SCREEN_GLARE_CSS in mockupRenderer so preview ≡ export.
  if (scene.screenGlare) {
    ctx.save();
    clipScreen();
    const glare = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY + innerH);
    glare.addColorStop(0, "rgba(255,255,255,0.32)");
    glare.addColorStop(0.3, "rgba(255,255,255,0.14)");
    glare.addColorStop(0.52, "rgba(255,255,255,0)");
    ctx.fillStyle = glare;
    ctx.fillRect(innerX, innerY, innerW, innerH);
    ctx.restore();
  }

  if (overlay) {
    // Silhouette = skin artwork ∪ screen cutout — exactly what the preview's
    // CSS drop-shadow sees, so the halo hugs the device with no light ring
    // and no silhouette color showing through the skin's transparent margins.
    drawFrameShadow(ctx, box, scene, dpiScale, zoom, {
      image: overlay,
      cutout: { x: innerX, y: innerY, w: innerW, h: innerH, r: screenRx }
    });
    ctx.save();
    ctx.drawImage(overlay, x, y, frameW, frameH);
    ctx.restore();
  }

  // Browser frame: the URL text sits above the window skin (the skin paints
  // the toolbar and pill; only the text is dynamic). Drawn without shadow so
  // it stays crisp over the pill.
  if (instSpec.urlBar) {
    drawBrowserUrl(ctx, box, instSpec, scene.browserUrl, scene.browserChromeTheme);
  }
}