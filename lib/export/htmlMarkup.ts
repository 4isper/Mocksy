import type { CSSProperties } from "react";
import type { EditorScene, FrameInstance, MediaLayer } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { tiltCss } from "@/lib/render/tilt";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { parseAspectRatioOr } from "@/lib/render/aspectRatio";
import { frameInstAr } from "@/lib/render/frames";
import { RENDER } from "@/lib/render/canvasDrawing";
import { escapeMarkup, round2 } from "@/lib/export/markupUtils";
import { collectOverlayClipDefs } from "@/lib/render/squircle";
import { annotationGradientCSS } from "@/lib/render/annotationGradient";

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
  for (const [i, a] of scene.annotations.entries()) {
    const bx = Math.min(a.x, a.x + a.w) * 100;
    const by = Math.min(a.y, a.y + a.h) * 100;
    const bw = Math.abs(a.w) * 100;
    const bh = Math.abs(a.h) * 100;
    if (a.type === "text") {
       const weight = a.fontWeight === "normal" ? 400 : "bold";
      const style = a.fontStyle === "italic" ? "italic" : "normal";
      const align = a.textAlign ?? "left";
      const gradientCSS = annotationGradientCSS(a);
      const textColor = gradientCSS ? "transparent" : a.color;
      const bgStyle = gradientCSS
        ? `;background:${gradientCSS};-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none`
        : a.bgColor ? `;background:${a.bgColor};padding:${a.bgPadding ?? 0}px;border-radius:${a.bgRadius ?? 0}px` : "";
       out += `<div class="anno anno-text" style="left:${num(bx)}%;top:${num(by)}%;width:${num(bw)}%;font-size:${num(a.fontSize)}px;color:${textColor};font-family:${a.fontFamily ?? "Inter, system-ui, sans-serif"};font-weight:${weight};font-style:${style};text-align:${align}${bgStyle}">${escapeHtml(a.text)}</div>`;
    } else     if (a.type === "rect") {
      const gradientCSS = annotationGradientCSS(a);
      const borderStyle = gradientCSS
        ? `border:none;background:${gradientCSS} padding-box,${gradientCSS} border-box;-webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;padding:${Math.max(1, a.strokeWidth)}px`
        : `border:${Math.max(1, a.strokeWidth)}px solid ${a.color}`;
      out += `<div class="anno" style="left:${num(bx)}%;top:${num(by)}%;width:${num(bw)}%;height:${num(bh)}%;${borderStyle}"></div>`;
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
      const gradCSS = annotationGradientCSS(a);
      const strokeColor = gradCSS ? `url(#html-anno-grad-${i})` : a.color;
      const gradDef = gradCSS ? (() => {
        if (a.gradientType === "radial") {
          return `<radialGradient id="html-anno-grad-${i}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${a.gradientFrom}"/>${a.gradientVia ? `<stop offset="50%" stop-color="${a.gradientVia}"/>` : ""}<stop offset="100%" stop-color="${a.gradientTo}"/></radialGradient>`;
        }
        const ang = a.gradientAngle ?? 135;
        const rad = (ang * Math.PI) / 180;
        const x1 = (50 - Math.cos(rad) * 50).toFixed(1);
        const y1 = (50 - Math.sin(rad) * 50).toFixed(1);
        const x2 = (50 + Math.cos(rad) * 50).toFixed(1);
        const y2 = (50 + Math.sin(rad) * 50).toFixed(1);
        return `<linearGradient id="html-anno-grad-${i}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0%" stop-color="${a.gradientFrom}"/>${a.gradientVia ? `<stop offset="50%" stop-color="${a.gradientVia}"/>` : ""}<stop offset="100%" stop-color="${a.gradientTo}"/></linearGradient>`;
      })() : "";
      out += `<svg class="anno" viewBox="0 0 ${num(arW)} ${num(arH)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="position:absolute;inset:0">${gradDef ? `<defs>${gradDef}</defs>` : ""}<line x1="${num(sx)}" y1="${num(sy)}" x2="${num(ex)}" y2="${num(ey)}" stroke="${strokeColor}" stroke-width="${Math.max(1, a.strokeWidth)}" stroke-linecap="round"/><polygon points="${num(ex)},${num(ey)} ${p1x},${p1y} ${p2x},${p2y}" fill="${strokeColor}"/></svg>`;
    }
  }
  return out;
}

function watermarkHtml(scene: EditorScene, watermarkHref?: string | null): string {
  if (!scene.watermarkEnabled) return "";
  const pos = `${scene.watermarkPosition.includes("left") ? "left" : "right"}:16px;${scene.watermarkPosition.includes("top") ? "top" : "bottom"}:16px;`;
  if (scene.watermarkImageUrl && watermarkHref) {
    return `<img class="wm wm-logo" src="${watermarkHref}" alt="" style="${pos}height:${num(scene.watermarkSize)}px"/>`;
  }
  return scene.watermarkText
    ? `<span class="wm" style="${pos}font-size:${num(scene.watermarkSize)}px">${escapeHtml(scene.watermarkText)}</span>`
    : "";
}

export interface GridItemOptions {
  inst: FrameInstance;
  /** data: URL of this instance's layer media, or null when the layer has none. */
  mediaHref: string | null;
  mediaType: "image" | "video" | null;
  /** data: URL of the overlay device skin, or null for CSS frames. */
  overlayHref: string | null;
}

export interface GridSnippetOptions {
  backgroundHref?: string | null;
  watermarkHref?: string | null;
  fontCss?: string;
}

/** Markup of one frame instance, mirroring FrameInstanceGrid in the live
 *  preview: a centered wrapper box sized by scale/aspect-ratio, an optional
 *  landscape rotor that rotates the native-orientation assembly by 90°, a
 *  zoom/tilt transform on the frame itself, then the canonical paint order
 *  from FrameContent (media → glare → chrome → skin → browser URL). */
function gridItemHtml(scene: EditorScene, tiltPrefix: string, item: GridItemOptions): string {
  const inst = item.inst;
  const layer = scene.layers.find((l) => l.id === inst.layerId) ?? scene.layers[0];
  const css = buildSceneCss(
    { ...scene, frame: inst.frame, frameMaterial: inst.material, screen: inst.screen ?? scene.screen, layers: layer ? [layer] : [] },
    layer?.id ?? scene.activeLayerId
  );
  const native = frameInstAr(inst.frame, scene.customFrame, scene.aspectRatio) ?? 390 / 844;
  const landscape = inst.orientation === "landscape";

  let wrapperCss =
    `position: absolute;\nleft: ${num(inst.x * 100)}%;\ntop: ${num(inst.y * 100)}%;\n` +
    `width: ${num((landscape ? inst.scale * native : inst.scale) * 100)}%;\nheight: auto;\n` +
    `aspect-ratio: ${landscape ? `${num(native)} / 1` : `1 / ${native}`};\n` +
    `transform: translate(-50%, -50%);`;
  if (inst.floorReflection ?? scene.floorReflection) {
    wrapperCss += "\n-webkit-box-reflect: below 0 linear-gradient(transparent 45%, rgba(255,255,255,0.30));";
  }

  const zoom = layer?.zoom ?? 1;
  let frameCss = serializeCssProperties(css.frame);
  frameCss += `\nwidth: 100%;\nheight: 100%;\nposition: relative;\ntransform: ${tiltPrefix}scale(${num(zoom)});\ntransform-origin: center;`;

  const mediaCss = serializeCssProperties(css.mediaStyle);
  const media =
    item.mediaType === "video" && item.mediaHref
      ? `<video class="media" src="${item.mediaHref}" controls muted loop autoplay playsinline style="object-fit: contain"${(layer?.playbackSpeed ?? 1) !== 1 ? ` data-rate="${num(Math.max(0.5, Math.min(2, layer?.playbackSpeed ?? 1)))}"` : ""}></video>`
      : item.mediaHref
        ? `<img class="media" src="${item.mediaHref}" alt="" style="${mediaCss}"/>`
        : "";

  const glare = css.screenGlareStyle
    ? `<div class="glare" style="${serializeCssProperties(css.screenGlareStyle)}"></div>`
    : "";
  const chrome = css.screenChrome
    ? `<div class="chrome" style="${serializeCssProperties(css.screenChromeStyle)}">${css.screenChrome}</div>`
    : "";
  const overlay = item.overlayHref ? `<img class="overlay" src="${item.overlayHref}" alt=""/>` : "";
  const browserChrome =
    css.browserChrome && css.browserChromeStyle
      ? `<div style="${serializeCssProperties(css.browserChromeStyle)}">${css.browserChrome}</div>`
      : "";
  // Text layers replace media with the same aspect-exact SVG the preview uses.
  const textLayer = css.textSvg
    ? `<div style="${serializeCssProperties(css.textStyle)}">${css.textSvg}</div>`
    : "";

  const rotorOpen = landscape
    ? `<div class="rotor" style="position: absolute;left: 50%;top: 50%;width: calc(100% / ${native.toFixed(6)});aspect-ratio: ${(1 / native).toFixed(6)} / 1;transform: translate(-50%, -50%) rotate(90deg);">`
    : "";
  const rotorClose = landscape ? "</div>" : "";

  return `<div class="frame-instance" style="${wrapperCss}">
${rotorOpen}<div data-mockup-frame style="${frameCss}">
${media}${textLayer}${chrome}${glare}
${overlay}
${browserChrome}
</div>${rotorClose}
</div>`;
}

/**
 * Builds a self-contained HTML document for multi-frame scenes with real CSS —
 * one live mockup per frame instance instead of a rasterized screenshot.
 * Pure and DOM-free for testability; callers pass only visible instances.
 */
export function buildGridHtmlSnippet(
  scene: EditorScene,
  items: GridItemOptions[],
  opts: GridSnippetOptions = {}
): string {
  const css = buildSceneCss(scene);
  const tiltPrefix = tiltCss(scene);
  const { w: arW, h: arH } = parseAspectRatioOr(scene.aspectRatio, { w: 16, h: 9 });
  const ar = `${arW}/${arH}`;

  const containerCss = serializeCssProperties(css.container);
  const backgroundCss = css.backgroundImage
    ? `.bg {\n  position: absolute;\n  inset: -${css.backgroundBlur + 6}px;\n  z-index: 0;\n  background-image: url("${opts.backgroundHref ?? css.backgroundImage}");\n  background-size: cover;\n  background-position: center;\n${css.backgroundBlur > 0 ? `  filter: blur(${css.backgroundBlur}px);\n` : ""}}`
    : "";
  const bg = css.backgroundImage ? `<div class="bg"></div>` : "";

  const instances = items.map((item) => gridItemHtml(scene, tiltPrefix, item)).join("\n");
  const hasVideoRate = items.some(
    (item) =>
      item.mediaType === "video" &&
      (scene.layers.find((l) => l.id === item.inst.layerId)?.playbackSpeed ?? 1) !== 1
  );

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
${opts.fontCss ? `<style>\n${opts.fontCss}\n</style>\n` : ""}<style>
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
.media {
  display: block;
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
</style>
</head>
<body>
${defsSvg}
<div class="stage">
  ${bg}
  ${instances}
  ${annotationsHtml(scene, arW, arH)}
  ${watermarkHtml(scene, opts.watermarkHref)}
</div>
${hasVideoRate ? `<script>document.querySelectorAll("video[data-rate]").forEach(function(v){v.playbackRate=parseFloat(v.dataset.rate);});</script>` : ""}
</body>
</html>
`;
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
  // Text layers replace media with the same aspect-exact SVG the preview uses.
  const textLayer = css.textSvg
    ? `<div style="${serializeCssProperties(css.textStyle)}">${css.textSvg}</div>`
    : "";
  const glare = css.screenGlareStyle
    ? `<div class="glare" style="${serializeCssProperties(css.screenGlareStyle)}"></div>`
    : "";
  const chrome = css.screenChrome
    ? `<div class="chrome" style="${serializeCssProperties(css.screenChromeStyle)}">${css.screenChrome}</div>`
    : "";
  const bg = css.backgroundImage ? `<div class="bg"></div>` : "";
  const watermark = watermarkHtml(scene, opts.watermarkHref);

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
    ${textLayer}
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
