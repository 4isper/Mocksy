"use client";

import type { EditorScene } from "@/lib/types/editor";
import { computeFrameBox, computeFrameInstances, type FrameBox } from "@/lib/render/frameGeometry";
import { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
import { frameViewBox, getFrameSpec, DEFAULT_VIEWBOX } from "@/lib/render/frames";
import { resolveExportTransform, waitForImage } from "@/lib/export/exportImage";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { buildEmbeddedFontCss, collectFontStacks } from "@/lib/export/fontEmbed";
import { downloadBlob } from "@/lib/export/downloadBlob";
import { RENDER } from "@/lib/render/canvasDrawing";

/** Rounds to 2 decimals so generated SVG stays compact but accurate. */
function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface SvgFrameGroup {
  /** Canvas-space frame geometry (design px, computed with pixelRatio 1). */
  box: FrameBox;
  /** data: URL of the media to place inside the screen, or null for empty. */
  mediaHref: string | null;
  /** Intrinsic media width/height used for cover/contain math. */
  mediaWidth: number;
  mediaHeight: number;
  /** Whether the frame is an SVG device skin that sits above the media. */
  isOverlay: boolean;
  /** The skin's SVG viewBox size (defaults to the shared 390x844 phone viewBox). */
  viewBox?: { w: number; h: number };
  /** True for the CSS watch frame, whose screen clips to a full circle. */
  isCircular?: boolean;
  /** Inner markup (children of the device SVG's <svg> root) to inline, or null. */
  overlayInner: string | null;
  /** Per-frame media fill behavior; defaults to the layer's when omitted. */
  mediaFit?: "cover" | "contain";
  offsetX?: number;
  offsetY?: number;
}

export interface SvgExportOptions {
  width: number;
  height: number;
  /** data: URL of the uploaded background image, or null. */
  backgroundHref: string | null;
  /** Intrinsic background image size (for cover placement). */
  backgroundWidth?: number;
  backgroundHeight?: number;
  /** Current frame zoom, used to scale the drop shadow with the mockup. */
  zoom?: number;
  groups: SvgFrameGroup[];
  /** Embedded @font-face CSS (data: URLs) so text renders with the right font. */
  fontCss?: string;
}

function backgroundMarkup(scene: EditorScene, opts: SvgExportOptions): string {
  const { width, height } = opts;
  switch (scene.backgroundMode) {
    case "solid":
      return `<rect width="${width}" height="${height}" fill="${scene.backgroundColor}"/>`;
    case "gradient": {
      const rad = ((scene.gradientAngle ?? RENDER.gradientAngleDeg) * Math.PI) / 180;
      const dx = Math.sin(rad);
      const dy = -Math.cos(rad);
      const lineLen = Math.abs(width * dx) + Math.abs(height * dy);
      const cx = width / 2;
      const cy = height / 2;
      const x1 = num(cx - (dx * lineLen) / 2);
      const y1 = num(cy - (dy * lineLen) / 2);
      const x2 = num(cx + (dx * lineLen) / 2);
      const y2 = num(cy + (dy * lineLen) / 2);
      return `<rect width="${width}" height="${height}" fill="url(#bg-gradient)"/><linearGradient id="bg-gradient" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${scene.gradientFrom}"/><stop offset="1" stop-color="${scene.gradientTo}"/></linearGradient>`;
    }
    case "image": {
      if (!opts.backgroundHref) return "";
      const iw = opts.backgroundWidth ?? width;
      const ih = opts.backgroundHeight ?? height;
      const scale = Math.max(width / iw, height / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const blur = scene.backgroundBlur;
      const pad = blur * 2;
      const x = (width - dw) / 2 - pad;
      const y = (height - dh) / 2 - pad;
      const blurFilter = blur > 0 ? ' filter="url(#bg-blur)"' : "";
      // The preview's container paints a dark base under the blurred photo.
      return `<rect width="${width}" height="${height}" fill="#0a0a0f"/>`
        + `<image href="${opts.backgroundHref}" x="${num(x)}" y="${num(y)}" width="${num(dw + pad * 2)}" height="${num(dh + pad * 2)}" preserveAspectRatio="none"${blurFilter}/>`;
    }
    default:
      return "";
  }
}

function mediaScale(fit: "cover" | "contain", innerW: number, innerH: number, mw: number, mh: number): number {
  return fit === "contain" ? Math.min(innerW / mw, innerH / mh) : Math.max(innerW / mw, innerH / mh);
}

function groupClipMarkup(group: SvgFrameGroup, index: number): string {
  const { box } = group;
  const isCircular = group.isCircular;
  const rounded = isCircular
    ? `rx="${num(Math.min(box.innerW, box.innerH) / 2)}"`
    : `rx="${num(Math.min(box.innerRadius, Math.min(box.innerW, box.innerH) / 2))}"`;
  return `<clipPath id="clip-${index}"><rect x="${num(box.innerX)}" y="${num(box.innerY)}" width="${num(box.innerW)}" height="${num(box.innerH)}" ${rounded}/></clipPath>`;
}

function frameGroupMarkup(scene: EditorScene, group: SvgFrameGroup, index: number): string {
  const { box } = group;
  const isCircular = group.isCircular;

  const mediaFit = group.mediaFit ?? "cover";
  const scale = mediaScale(mediaFit, box.innerW, box.innerH, group.mediaWidth || box.innerW, group.mediaHeight || box.innerH);
  const dw = (group.mediaWidth || box.innerW) * scale;
  const dh = (group.mediaHeight || box.innerH) * scale;
  const offX = group.offsetX ?? 0;
  const offY = group.offsetY ?? 0;
  const dx = box.innerX + (box.innerW - dw) / 2 + (offX * (box.innerW - dw)) / 2;
  const dy = box.innerY + (box.innerH - dh) / 2 + (offY * (box.innerH - dh)) / 2;

  const media =
    group.mediaHref != null
      ? `<image href="${group.mediaHref}" x="${num(dx)}" y="${num(dy)}" width="${num(dw)}" height="${num(dh)}"/>`
      : `<rect x="${num(box.innerX)}" y="${num(box.innerY)}" width="${num(box.innerW)}" height="${num(box.innerH)}" fill="${RENDER.emptyMediaFill}"/>`;

  let frame = "";
  if (group.isOverlay) {
    if (group.overlayInner) {
      const vb = group.viewBox ?? DEFAULT_VIEWBOX;
      const sx = box.width / vb.w;
      const sy = box.height / vb.h;
      frame = `<g filter="url(#frame-shadow)"><g transform="translate(${num(box.x)} ${num(box.y)}) scale(${num(sx)} ${num(sy)})">${group.overlayInner}</g></g>`;
    }
  } else {
    const fill = scene.stylePreset === "glassDark" ? RENDER.glassDarkFill : RENDER.glassLightFill;
    const stroke = scene.stylePreset === "outline" || scene.stylePreset.startsWith("glass");
    const strokeWidth = scene.stylePreset === "outline" ? RENDER.outlineStroke : RENDER.glassStroke;
    const strokeStyle = scene.stylePreset === "glassDark" ? RENDER.glassDarkStroke : RENDER.glassLightStroke;
    const radius = isCircular ? num(Math.min(box.width, box.height) / 2) : num(box.outerRadius);
    frame = `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.width)}" height="${num(box.height)}" rx="${radius}" fill="${fill}" filter="url(#frame-shadow)"/>`;
    if (stroke) {
      frame += `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.width)}" height="${num(box.height)}" rx="${radius}" fill="none" stroke="${strokeStyle}" stroke-width="${strokeWidth}"/>`;
    }
  }

  return `<g clip-path="url(#clip-${index})">${media}</g>${frame}`;
}

function annotationsMarkup(scene: EditorScene, width: number, height: number): string {
  if (scene.annotations.length === 0) return "";
  let out = "";
  for (const a of scene.annotations) {
    const bx = Math.min(a.x, a.x + a.w) * width;
    const by = Math.min(a.y, a.y + a.h) * height;
    const bw = Math.abs(a.w) * width;
    const bh = Math.abs(a.h) * height;
    if (a.type === "text") {
      const weight = a.fontWeight === "normal" ? "400" : "600";
      const style = a.fontStyle === "italic" ? ' font-style="italic"' : "";
      const anchor = a.textAlign === "center" ? "middle" : a.textAlign === "right" ? "end" : "start";
      const textX = anchor === "start" ? bx : anchor === "end" ? bx + bw : bx + bw / 2;
      const lineHeight = a.fontSize * 1.2;
      const tspans = a.text
        .split("\n")
        .map((line, i) => `<tspan x="${num(textX)}" dy="${i === 0 ? 0 : num(lineHeight)}">${escapeXml(line)}</tspan>`)
        .join("");
      out += `<text x="${num(textX)}" y="${num(by)}" font-size="${num(a.fontSize)}" font-weight="${weight}" fill="${a.color}" font-family="${a.fontFamily ?? "Inter, system-ui, sans-serif"}" text-anchor="${anchor}" dominant-baseline="hanging"${style} filter="url(#anno-shadow)">${tspans}</text>`;
    } else if (a.type === "rect") {
      out += `<rect x="${num(bx)}" y="${num(by)}" width="${num(bw)}" height="${num(bh)}" fill="none" stroke="${a.color}" stroke-width="${Math.max(1, a.strokeWidth)}"/>`;
    } else {
      const startX = a.x * width;
      const startY = a.y * height;
      const endX = (a.x + a.w) * width;
      const endY = (a.y + a.h) * height;
      const angle = Math.atan2(endY - startY, endX - startX);
      const head = 14;
      const a1 = angle + Math.PI - 0.45;
      const a2 = angle + Math.PI + 0.45;
      const p1x = num(endX + head * Math.cos(a1));
      const p1y = num(endY + head * Math.sin(a1));
      const p2x = num(endX + head * Math.cos(a2));
      const p2y = num(endY + head * Math.sin(a2));
      out += `<line x1="${num(startX)}" y1="${num(startY)}" x2="${num(endX)}" y2="${num(endY)}" stroke="${a.color}" stroke-width="${Math.max(1, a.strokeWidth)}" stroke-linecap="round"/>`;
      out += `<polygon points="${num(endX)},${num(endY)} ${p1x},${p1y} ${p2x},${p2y}" fill="${a.color}"/>`;
    }
  }
  return out;
}

function watermarkMarkup(scene: EditorScene, width: number, height: number): string {
  if (!scene.watermarkEnabled || !scene.watermarkText) return "";
  const inset = RENDER.watermarkInset;
  const onLeft = scene.watermarkPosition === "bottom-left" || scene.watermarkPosition === "top-left";
  const onTop = scene.watermarkPosition === "top-right" || scene.watermarkPosition === "top-left";
  const textX = onLeft ? inset : width - inset;
  const textY = onTop ? inset + scene.watermarkSize : height - inset;
  const baseline = onTop ? ' dominant-baseline="hanging"' : "";
  return `<text x="${num(textX)}" y="${num(textY)}" font-size="${num(scene.watermarkSize)}" font-weight="500" fill="rgba(255,255,255,0.85)" font-family="Inter, system-ui, sans-serif" text-anchor="${onLeft ? "start" : "end"}"${baseline} filter="url(#anno-shadow)">${escapeXml(scene.watermarkText)}</text>`;
}

/**
 * Builds a standalone SVG document for the scene. Pure and DOM-free: all
 * geometry and data URLs are supplied through `opts`, which makes it directly
 * testable. The markup mirrors `renderMockupToCanvas` (same frame box, media
 * cover/contain + pan math, shadow, watermark, annotations) so the vector
 * export matches the preview and the raster exports.
 */
export function buildSvgMarkup(scene: EditorScene, opts: SvgExportOptions): string {
  const { width, height, groups, zoom = 1 } = opts;
  const shadowDy = num(RENDER.shadowOffsetY * zoom);
  const shadowStd = num((RENDER.shadowBlur / 2) * zoom);

  const defs = [
    `<filter id="frame-shadow" x="-60%" y="-250%" width="220%" height="500%"><feDropShadow dx="0" dy="${shadowDy}" stdDeviation="${shadowStd}" flood-color="#000" flood-opacity="${scene.shadowOpacity}"/></filter>`,
    `<filter id="anno-shadow" x="-50%" y="-100%" width="200%" height="300%"><feDropShadow dx="0" dy="${RENDER.annoShadowOffsetY}" stdDeviation="${RENDER.annoShadowBlur / 2}" flood-color="#000" flood-opacity="0.5"/></filter>`,
    scene.backgroundBlur > 0 ? `<filter id="bg-blur"><feGaussianBlur stdDeviation="${num(scene.backgroundBlur / 2)}"/></filter>` : "",
    ...groups.map((g, i) => groupClipMarkup(g, i)),
    opts.fontCss ? `<style>${opts.fontCss}</style>` : ""
  ].filter(Boolean);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(width)} ${num(height)}" width="${num(width)}" height="${num(height)}">`,
    `<defs>${defs.join("")}</defs>`,
    backgroundMarkup(scene, opts),
    ...groups.map((g, i) => frameGroupMarkup(scene, g, i)),
    annotationsMarkup(scene, width, height),
    watermarkMarkup(scene, width, height),
    `</svg>`
  ].join("");
}


/**
 * Converts a media URL to a data: URL plus its intrinsic size. Data URLs pass
 * through untouched; blob/http URLs are re-encoded through a canvas so the SVG
 * stays self-contained.
 */
export async function mediaToDataUrl(src: string): Promise<{ href: string; width: number; height: number } | null> {
  try {
    const img = await loadMediaElement(src);
    const width = img.naturalWidth || img.width || 1;
    const height = img.naturalHeight || img.height || 1;
    if (src.startsWith("data:")) return { href: src, width, height };
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { href: src, width, height };
    ctx.drawImage(img, 0, 0);
    return { href: canvas.toDataURL("image/png"), width, height };
  } catch {
    return null;
  }
}

function loadMediaElement(src: string): Promise<HTMLImageElement> {
  return loadImage(src);
}

/** Captures the current frame of a preview <video> as a PNG data URL. */
export function videoToDataUrl(video: HTMLVideoElement): { href: string; width: number; height: number } | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  try {
    ctx.drawImage(video, 0, 0);
    return { href: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

/** Fetches a device-skin SVG and returns its inner markup for inlining. */
export async function inlineSvgAsset(asset: string): Promise<string | null> {
  try {
    const res = await fetch(asset);
    const text = await res.text();
    return text
      .replace(/<\?xml[^>]*\?>/i, "")
      .replace(/^[\s\S]*?<svg[^>]*>/i, "<g>")
      .replace(/<\/svg>\s*$/i, "</g>")
      .trim();
  } catch {
    return null;
  }
}

/**
 * Exports the scene as a standalone SVG. Geometry is measured from the live
 * preview (so it matches the PNG/video exports), media is embedded as data
 * URLs, and overlay device skins are inlined so the file opens cleanly in
 * Figma/Illustrator/browsers.
 */
export async function exportSvg(
  scene: EditorScene,
  containerId: string,
  filename = "mocksy-export",
  onError?: (message: string) => void,
  activeLayerId: string | null = scene.activeLayerId
) {
  try {
    const node = document.getElementById(containerId);
    if (!node) {
      onError?.("Preview area not found.");
      return;
    }
    const frameElement = node.querySelector<HTMLElement>("[data-mockup-frame]");
    const video = node.querySelector("video");
    const img = node.querySelector("img");
    const width = node.clientWidth;
    const height = node.clientHeight;
    if (!width || !height) {
      onError?.("Preview has no measurable size.");
      return;
    }

    let background: { href: string; width: number; height: number } | null = null;
    if (scene.backgroundMode === "image" && scene.backgroundImageUrl) {
      background = await mediaToDataUrl(scene.backgroundImageUrl);
    }

    const isMultiFrame = scene.frameInstances.length > 0;
    const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
    const transform = resolveExportTransform(scene, activeLayerId);
    const groups: SvgFrameGroup[] = [];

    if (isMultiFrame) {
      const boxes = computeFrameInstances(scene, width, height, 1, transform, activeLayerId);
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        const inst = scene.frameInstances[i];
        if (!box || !inst) continue;
        const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayer;
        const spec = getFrameSpec(inst.frame);
        let media: { href: string; width: number; height: number } | null = null;
        if (layer?.mediaUrl) {
          if (isVideoLayer(layer)) {
            // Embed the video's poster frame as PNG so the frame isn't blank.
            const videoFrame = await loadVideoFrame(layer.mediaUrl, layer.videoPosterTime ?? 0);
            media = videoToDataUrl(videoFrame);
          } else {
            media = await mediaToDataUrl(layer.mediaUrl);
          }
        }
        const overlayInner = spec.isOverlay && spec.asset ? await inlineSvgAsset(spec.asset) : null;
        groups.push({
          box,
          mediaHref: media?.href ?? null,
          mediaWidth: media?.width ?? box.innerW,
          mediaHeight: media?.height ?? box.innerH,
          isOverlay: spec.isOverlay,
          viewBox: frameViewBox(spec),
          isCircular: inst.frame === "watch",
          overlayInner,
          mediaFit: layer?.mediaFit,
          offsetX: layer?.mediaOffsetX,
          offsetY: layer?.mediaOffsetY
        });
      }
    } else {
      const spec = getFrameSpec(scene.frame);
      let media: { href: string; width: number; height: number } | null = null;
      if (!activeLayer?.hidden) {
        if (video instanceof HTMLVideoElement) {
          let src: HTMLVideoElement = video;
          if (video.readyState < 2 && activeLayer && isVideoLayer(activeLayer) && activeLayer.mediaUrl) {
            try {
              src = await loadVideoFrame(activeLayer.mediaUrl, activeLayer.videoPosterTime ?? 0);
            } catch {
              src = video;
            }
          }
          media = videoToDataUrl(src);
        } else if (img instanceof HTMLImageElement) {
          await waitForImage(img);
          media = {
            href: img.src,
            width: img.naturalWidth || img.width || 1,
            height: img.naturalHeight || img.height || 1
          };
        }
      }
      const box = computeFrameBox(scene, width, height, 1, frameElement?.offsetWidth, frameElement?.offsetHeight, transform, undefined, undefined, activeLayerId);
      const overlayInner = spec.isOverlay && spec.asset ? await inlineSvgAsset(spec.asset) : null;
      groups.push({
        box,
        mediaHref: media?.href ?? null,
        mediaWidth: media?.width ?? box.innerW,
        mediaHeight: media?.height ?? box.innerH,
        isOverlay: spec.isOverlay,
        viewBox: frameViewBox(spec),
        isCircular: scene.frame === "watch",
        overlayInner,
        mediaFit: activeLayer?.mediaFit,
        offsetX: activeLayer?.mediaOffsetX,
        offsetY: activeLayer?.mediaOffsetY
      });
    }

    const markup = buildSvgMarkup(scene, {
      width,
      height,
      backgroundHref: background?.href ?? null,
      backgroundWidth: background?.width,
      backgroundHeight: background?.height,
      zoom: transform.zoom,
      groups,
      fontCss: await buildEmbeddedFontCss(collectFontStacks(scene))
    });
    downloadBlob(new Blob([markup], { type: "image/svg+xml" }), `${filename}.svg`);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "SVG export failed.");
  }
}
