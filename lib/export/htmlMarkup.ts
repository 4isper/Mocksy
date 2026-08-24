import type { CSSProperties } from "react";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { tiltCss } from "@/lib/render/tilt";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { parseAspectRatioOr } from "@/lib/render/aspectRatio";
import { RENDER } from "@/lib/render/canvasDrawing";
import { escapeMarkup, round2 } from "@/lib/export/markupUtils";
import { collectOverlayClipDefs } from "@/lib/render/squircle";

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
  return round2(n);
}

function escapeHtml(text: string): string {
  return escapeMarkup(text);
}

/** CSS transform shorthand matching the preview's useFrameTransform. */
function transformFor(zoom: number, x: number, y: number): string {
  return `scale(${num(zoom)}) translate(${num(x * 2)}px, ${num(y * 2)}px)`;
}

/** @keyframes + animation rule for the active layer's animation preset. */
export function buildAnimationCss(layer: MediaLayer | undefined, durationSec = 3, tiltPrefix = ""): string {
  if (!layer || layer.animationPreset === "none") return "";
  const SAMPLES = 24;
  const keyframes = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const p = i / SAMPLES;
    const { zoom, x, y } = sampleVideoTransform(layer, p);
    return `${num(p * 100)}% { transform: ${tiltPrefix}${transformFor(zoom, x, y)}; }`;
  }).join("\n");
  const { zoom: staticZoom, x: staticX, y: staticY } = sampleVideoTransform(layer, 0);
  const staticTransform = `${tiltPrefix}${transformFor(staticZoom, staticX, staticY)}`;
  return `@keyframes mockup-anim {\n${keyframes}\n}\n.frame {\n  animation: mockup-anim ${durationSec}s linear infinite;\n  transform-origin: center;\n}\n@media (prefers-reduced-motion: reduce) {\n  .frame {\n    animation: none;\n    transform: ${staticTransform};\n  }\n}\n`;
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
       const weight = a.fontWeight === "normal" ? 400 : "bold";
      const style = a.fontStyle === "italic" ? "italic" : "normal";
      const align = a.textAlign ?? "left";
       const bgStyle = a.bgColor ? `;background:${a.bgColor};padding:${a.bgPadding ?? 0}px;border-radius:${a.bgRadius ?? 0}px` : "";
       out += `<div class="anno anno-text" style="left:${num(bx)}%;top:${num(by)}%;width:${num(bw)}%;font-size:${num(a.fontSize)}px;color:${a.color};font-family:${a.fontFamily ?? "Inter, system-ui, sans-serif"};font-weight:${weight};font-style:${style};text-align:${align}${bgStyle}">${escapeHtml(a.text)}</div>`;
    } else     if (a.type === "rect") {
      out += `<div class="anno" style="left:${num(bx)}%;top:${num(by)}%;width:${num(bw)}%;height:${num(bh)}%;border:${Math.max(1, a.strokeWidth)}px solid ${a.color}"></div>`;
    } else if (a.type === "blur") {
      // Frosted-glass region: blurs whatever the page paints beneath it —
      // mirrors backdrop-filter in the live preview and the canvas export's
      // self-blur pass.
      out += `<div class="anno" style="left:${num(bx)}%;top:${num(by)}%;width:${num(bw)}%;height:${num(bh)}%;border-radius:8px;-webkit-backdrop-filter:blur(${Math.max(1, a.strokeWidth)}px);backdrop-filter:blur(${Math.max(1, a.strokeWidth)}px)"></div>`;
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
  /** data: URL of the uploaded logo watermark, or null. */
  watermarkHref?: string | null;
  /** Embedded @font-face CSS (data: URLs) so text renders with the right font. */
  fontCss?: string;
}

/**
 * Builds a self-contained HTML document that recreates the scene with real
 * CSS — the same styles `buildSceneCss` produces for the preview, media and
 * background embedded as data URLs, device skins inlined, and the animation
 * preset replayed with CSS keyframes. Pure and DOM-free for testability.
 */
export function buildHtmlSnippet(scene: EditorScene, opts: HtmlSnippetOptions, activeLayerId: string | null = scene.activeLayerId): string {
  const css = buildSceneCss(scene, activeLayerId);
  const tiltPrefix = tiltCss(scene);
  const { w: arW, h: arH } = parseAspectRatioOr(scene.aspectRatio, { w: 16, h: 9 });
  const ar = `${arW}/${arH}`;
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];

  const containerCss = serializeCssProperties(css.container);
  let frameCss = serializeCssProperties(css.frame);
  frameCss += "\nz-index: 1;";
  if (activeLayer && activeLayer.animationPreset === "none") {
    frameCss += `\ntransform: ${tiltPrefix}${transformFor(activeLayer.zoom, 0, 0)};`;
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
  const browserChrome = css.browserChrome && css.browserChromeStyle
    ? `<div style="${serializeCssProperties(css.browserChromeStyle)}">${css.browserChrome}</div>`
    : "";
  const glare = css.screenGlareStyle
    ? `<div class="glare" style="${serializeCssProperties(css.screenGlareStyle)}"></div>`
    : "";
  const chrome = css.screenChrome
    ? `<div class="chrome" style="${serializeCssProperties(css.screenChromeStyle)}">${css.screenChrome}</div>`
    : "";
  const bg = css.backgroundImage ? `<div class="bg"></div>` : "";
  const watermark = scene.watermarkEnabled
    ? scene.watermarkImageUrl && opts.watermarkHref
      ? `<img class="wm wm-logo" src="${opts.watermarkHref}" alt="" style="${scene.watermarkPosition.includes("left") ? "left" : "right"}:16px;${scene.watermarkPosition.includes("top") ? "top" : "bottom"}:16px;height:${num(scene.watermarkSize)}px"/>`
      : scene.watermarkText
        ? `<span class="wm" style="${scene.watermarkPosition.includes("left") ? "left" : "right"}:16px;${scene.watermarkPosition.includes("top") ? "top" : "bottom"}:16px;font-size:${num(scene.watermarkSize)}px">${escapeHtml(scene.watermarkText)}</span>`
        : ""
    : "";

  const animationCss = buildAnimationCss(
    activeLayer,
    scene.animationDurationMs / 1000,
    tiltPrefix
  );
  // The playback-rate attribute doesn't exist in HTML; a one-liner applies the
  // layer speed to every embedded video once the document boots.
  const speed = Math.max(0.5, Math.min(2, activeLayer?.playbackSpeed ?? 1));
  const playbackScript = opts.mediaType === "video" && speed !== 1
    ? `\n<script>document.querySelectorAll("video").forEach(function(v){v.playbackRate=${speed};});</script>`
    : "";

  const clipDefs = collectOverlayClipDefs(scene)
    .map((def) => `<clipPath id="${def.id}" clipPathUnits="objectBoundingBox"><path d="${def.d}"/></clipPath>`)
    .join("");
  const defsSvg = clipDefs ? `<svg width="0" height="0" style="position:absolute"><defs>${clipDefs}</defs></svg>` : "";

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
  line-height: ${RENDER.lineHeightMultiplier};
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
.wm-logo {
  width: auto;
  max-width: 45%;
}
${animationCss}
</style>
</head>
<body>
${defsSvg}
<div class="stage">
  ${bg}
  <div class="frame">
    ${media}
    ${chrome}${glare}
    ${overlay}
    ${browserChrome}
  </div>
  ${annotationsHtml(scene, arW, arH)}
  ${watermark}
</div>
${playbackScript}
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
