"use client";

import type { CSSProperties } from "react";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { buildVideoTimeline } from "@/lib/render/videoComposer";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { renderSceneToImageBlob } from "@/lib/export/exportImage";
import { buildEmbeddedFontCss, collectFontStacks } from "@/lib/export/fontEmbed";
import { downloadBlob } from "@/lib/export/downloadBlob";

const UNITLESS = new Set(["opacity", "zIndex", "flexGrow", "flexShrink", "aspectRatio", "fontWeight", "lineHeight", "tabSize"]);

/**
 * Serializes a React CSSProperties object into a CSS declaration block. Numbers
 * become px except for unitless properties; strings (gradients, filters, etc.)
 * pass through verbatim.
 */
export function serializeCssProperties(props: CSSProperties): string {
  return Object.entries(props)
    .filter(([, value]) => value !== undefined && value !== null && value !== false && value !== "")
    .map(([key, value]) => {
      const kebab = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const text = typeof value === "number" && !UNITLESS.has(key) ? `${value}px` : String(value);
      return `${kebab}: ${text};`;
    })
    .join("\n");
}

function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** CSS transform shorthand matching the preview's useFrameTransform. */
function transformFor(zoom: number, x: number, y: number): string {
  return `scale(${num(zoom)}) translate(${num(x * 2)}px, ${num(y * 2)}px)`;
}

/** @keyframes + animation rule for the active layer's animation preset. */
export function buildAnimationCss(layer: MediaLayer | undefined, durationSec = 3): string {
  if (!layer || layer.animationPreset === "none") return "";
  const timeline = buildVideoTimeline(layer);
  const keyframes = timeline
    .map((k) => `${num(k.at * 100)}% { transform: ${transformFor(k.zoom, k.x, k.y)}; }`)
    .join("\n");
  return `@keyframes mockup-anim {\n${keyframes}\n}\n.frame {\n  animation: mockup-anim ${durationSec}s linear infinite;\n  transform-origin: center;\n}\n`;
}

function annotationsHtml(scene: EditorScene, arW: number, arH: number): string {
  if (scene.annotations.length === 0) return "";
  let out = "";
  for (const a of scene.annotations) {
    const bx = Math.min(a.x, a.x + a.w) * 100;
    const by = Math.min(a.y, a.y + a.h) * 100;
    const bw = Math.abs(a.w) * 100;
    const bh = Math.abs(a.h) * 100;
    if (a.type === "text") {
      const weight = a.fontWeight === "normal" ? 400 : 600;
      const style = a.fontStyle === "italic" ? "italic" : "normal";
      const align = a.textAlign ?? "left";
      out += `<div class="anno anno-text" style="left:${num(bx)}%;top:${num(by)}%;width:${num(bw)}%;font-size:${num(a.fontSize)}px;color:${a.color};font-family:${a.fontFamily ?? "Inter, system-ui, sans-serif"};font-weight:${weight};font-style:${style};text-align:${align}">${escapeHtml(a.text)}</div>`;
    } else if (a.type === "rect") {
      out += `<div class="anno" style="left:${num(bx)}%;top:${num(by)}%;width:${num(bw)}%;height:${num(bh)}%;border:${Math.max(1, a.strokeWidth)}px solid ${a.color}"></div>`;
    } else {
      const sx = a.x * arW;
      const sy = a.y * arH;
      const ex = (a.x + a.w) * arW;
      const ey = (a.y + a.h) * arH;
      const angle = Math.atan2(ey - sy, ex - sx);
      const head = arW * 0.015;
      const a1 = angle + Math.PI - 0.45;
      const a2 = angle + Math.PI + 0.45;
      const p1x = num(ex + head * Math.cos(a1));
      const p1y = num(ey + head * Math.sin(a1));
      const p2x = num(ex + head * Math.cos(a2));
      const p2y = num(ey + head * Math.sin(a2));
      out += `<svg class="anno" viewBox="0 0 ${num(arW)} ${num(arH)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="position:absolute;inset:0"><line x1="${num(sx)}" y1="${num(sy)}" x2="${num(ex)}" y2="${num(ey)}" stroke="${a.color}" stroke-width="${Math.max(1, a.strokeWidth)}" stroke-linecap="round"/><polygon points="${num(ex)},${num(ey)} ${p1x},${p1y} ${p2x},${p2y}" fill="${a.color}"/></svg>`;
    }
  }
  return out;
}

export interface HtmlSnippetOptions {
  /** data: URL of the active layer's media, or null. */
  mediaHref: string | null;
  mediaType: "image" | "video" | null;
  /** data: URL of the uploaded background image, or null. */
  backgroundHref: string | null;
  /** data: URL of the overlay device skin (SVG), or null. */
  overlayHref: string | null;
  /** Embedded @font-face CSS (data: URLs) so text renders with the right font. */
  fontCss?: string;
}

/**
 * Builds a self-contained HTML document that recreates the scene with real
 * CSS — the same styles `buildSceneCss` produces for the preview, media and
 * background embedded as data URLs, device skins inlined, and the animation
 * preset replayed with CSS keyframes. Pure and DOM-free for testability.
 */
export function buildHtmlSnippet(scene: EditorScene, opts: HtmlSnippetOptions): string {
  const css = buildSceneCss(scene);
  const [arW, arH] = scene.aspectRatio.split("/").map((n) => Number(n.trim()));
  const ar = `${arW ?? 16}/${arH ?? 9}`;
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];

  const containerCss = serializeCssProperties(css.container);
  let frameCss = serializeCssProperties(css.frame);
  frameCss += "\nz-index: 1;";
  if (activeLayer && activeLayer.animationPreset === "none") {
    frameCss += `\ntransform: ${transformFor(activeLayer.zoom, 0, 0)};`;
  }
  const mediaCss = serializeCssProperties(css.mediaStyle);
  const backgroundCss = css.backgroundImage
    ? `.bg {\n  position: absolute;\n  inset: -${css.backgroundBlur + 6}px;\n  z-index: 0;\n  background-image: url("${opts.backgroundHref ?? css.backgroundImage}");\n  background-size: cover;\n  background-position: center;\n${css.backgroundBlur > 0 ? `  filter: blur(${css.backgroundBlur}px);\n` : ""}}`
    : "";

  const media =
    opts.mediaType === "video" && opts.mediaHref
      ? `<video class="media" src="${opts.mediaHref}" controls muted loop autoplay playsinline></video>`
      : opts.mediaHref
        ? `<img class="media" src="${opts.mediaHref}" alt="Mockup media"/>`
        : "";

  const overlay = opts.overlayHref ? `<img class="overlay" src="${opts.overlayHref}" alt=""/>` : "";
  const bg = css.backgroundImage ? `<div class="bg"></div>` : "";
  const watermark = scene.watermarkEnabled && scene.watermarkText
    ? `<span class="wm" style="${scene.watermarkPosition.includes("left") ? "left" : "right"}:16px;${scene.watermarkPosition.includes("top") ? "top" : "bottom"}:16px;font-size:${num(scene.watermarkSize)}px">${escapeHtml(scene.watermarkText)}</span>`
    : "";

  const animationCss = buildAnimationCss(activeLayer, scene.animationDurationMs / 1000);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Mocksy mockup</title>
${opts.fontCss ? `<style>
${opts.fontCss}
</style>
` : ""}<style>
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
.stage {
  position: relative;
  overflow: hidden;
  width: min(96vw, calc(96vh * ${arW} / ${arH}));
  aspect-ratio: ${ar};
  border-radius: 12px;
${containerCss}
}
.frame {
  position: relative;
${frameCss}
}
.media {
  display: block;
${mediaCss}
}
.overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
${backgroundCss}
.anno {
  position: absolute;
  pointer-events: none;
}
.anno-text {
  font-weight: 600;
  line-height: 1.2;
  white-space: pre-line;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.wm {
  position: absolute;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}
${animationCss}
</style>
</head>
<body>
<div class="stage">
  ${bg}
  <div class="frame">
    ${media}
    ${overlay}
  </div>
  ${annotationsHtml(scene, arW ?? 16, arH ?? 9)}
  ${watermark}
</div>
</body>
</html>
`;
}

/**
 * Fallback snippet for scenes the CSS renderer doesn't cover (multi-frame
 * grids): the scene is rasterized to PNG and embedded in a simple responsive
 * document, so the HTML export still produces a working standalone file.
 */
export function buildRasterHtmlSnippet(imageHref: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Mocksy mockup</title>
<style>
html, body { margin: 0; padding: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0f; }
img { max-width: 100%; max-height: 100vh; display: block; border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); }
</style>
</head>
<body>
<img src="${imageHref}" alt="Mocksy mockup"/>
</body>
</html>
`;
}


function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read blob"));
    reader.readAsDataURL(blob);
  });
}

/** Converts a media URL into a data: URL so the snippet stays self-contained. */
async function toEmbeddableDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  return blobToDataUrl(await res.blob());
}

async function svgAssetToDataUrl(asset: string): Promise<string | null> {
  try {
    const res = await fetch(asset);
    const text = await res.text();
    return `data:image/svg+xml;utf8,${encodeURIComponent(text)}`;
  } catch {
    return null;
  }
}

/**
 * Exports the scene as a standalone HTML file. Single-frame scenes become a
 * live CSS mockup (crisp at any size, animation preserved); multi-frame grids
 * embed a rendered PNG so the file still opens anywhere.
 */
export async function exportHtml(
  scene: EditorScene,
  containerId: string,
  filename = "mocksy-export",
  onError?: (message: string) => void
) {
  try {
    if (scene.frameInstances.length > 0) {
      const blob = await renderSceneToImageBlob(scene, containerId, "image/png", onError, 2);
      if (!blob) return;
      const href = await blobToDataUrl(blob);
      downloadBlob(new Blob([buildRasterHtmlSnippet(href)], { type: "text/html;charset=utf-8" }), `${filename}.html`);
      return;
    }

    const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
    let mediaHref: string | null = null;
    let mediaType: "image" | "video" | null = null;
    if (activeLayer && !activeLayer.hidden && activeLayer.mediaUrl) {
      mediaHref = await toEmbeddableDataUrl(activeLayer.mediaUrl);
      mediaType = isVideoLayer(activeLayer) ? "video" : "image";
    }
    let backgroundHref: string | null = null;
    if (scene.backgroundMode === "image" && scene.backgroundImageUrl) {
      backgroundHref = await toEmbeddableDataUrl(scene.backgroundImageUrl);
    }
    const spec = getFrameSpec(scene.frame);
    const overlayHref = spec.isOverlay && spec.asset ? await svgAssetToDataUrl(spec.asset) : null;

    const fontCss = await buildEmbeddedFontCss(collectFontStacks(scene));
    const html = buildHtmlSnippet(scene, { mediaHref, mediaType, backgroundHref, overlayHref, fontCss });
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${filename}.html`);
  } catch (err) {
    onError?.(err instanceof Error ? err.message : "HTML export failed.");
  }
}
