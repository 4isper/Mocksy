import type { Annotation, EditorScene, MediaLayer, MockupFrame, ScreenChrome } from "@/lib/types/editor";
import { buildTextLayerSvg } from "@/lib/render/layerText";
import { computeFrameBox, computeFrameInstances, type FrameBox } from "@/lib/render/frameGeometry";
import { frameViewBox, frameOs, getFrameSpec, DEFAULT_VIEWBOX } from "@/lib/render/frames";
import { tiltMatrixSvg, tiltMatrixSvgRotated } from "@/lib/render/tilt";
import { hasAnnotationGradient, annotationSvgGradientDef } from "@/lib/render/annotationGradient";
import { RENDER, resolveFrameStyle } from "@/lib/render/canvasDrawing";
import { LAYER_ZOOM } from "@/lib/render/layerFilters";
import { watermarkEdges } from "@/lib/render/watermark";
import { overlayScaleFor } from "@/lib/render/overlayMetrics";
import { screenChromeElements } from "@/lib/render/screenChrome";
import { browserUrlSvg } from "@/lib/render/browserChrome";
import { PATTERN_TILES } from "@/lib/render/sceneBackground";
import { escapeMarkup, round2 } from "@/lib/export/markupUtils";
import { CORNER_POWER_CIRCLE, squirclePathD } from "@/lib/render/squircle";

/** Rounds to 2 decimals so generated SVG stays compact but accurate. */
function num(n: number): string {
  return round2(n);
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
  /** Screen cutout of overlay specs — drives the squircle media clip. */
  cutout?: { x: number; y: number; w: number; h: number; rx: number; power?: number } | null;
  /** URL for the browser frame's address bar, drawn above the skin. */
  browserUrl?: string | null;
  /** Per-frame media fill behavior; defaults to the layer's when omitted. */
  mediaFit?: "cover" | "contain";
  offsetX?: number;
  offsetY?: number;
  /** Static media zoom of the layer (scales the media inside the screen). */
  mediaZoom?: number;
  /** Rotation of the media inside the frame, in degrees (clockwise). */
  rotation?: number;
  /** Media opacity, percent 0–100 (default 100). Applied to the media only —
   *  chrome and device skin stay at full strength. */
  opacity?: number;
  /** Layer blend mode applied to the media element (CSS mix-blend-mode
   *  equivalent via SVG's mix-blend-mode, which shares the same names). */
  blendMode?: string;
  /** Whole-group rotation for landscape instances (90). The box already
   *  carries swapped dimensions; this turns skin+media+chrome together. */
  orientation?: number;
  /** The frame this group represents, so chrome can be OS-specific. */
  frame?: MockupFrame;
  /** On-screen chrome for this group (status bar / lock / home); per-device
   *  override when the instance sets one, else the scene default. */
  screen?: ScreenChrome;
  /** Floor reflection for this group; per-device override else the scene default. */
  floorReflection?: boolean;
  /** Text layer whose content fills the screen instead of media. */
  textLayer?: MediaLayer | null;
}

export interface SvgExportOptions {
  width: number;
  height: number;
  /** data: URL of the uploaded background image, or null. */
  backgroundHref: string | null;
  /** Intrinsic background image size (for cover placement). */
  backgroundWidth?: number;
  backgroundHeight?: number;
  /** data: URL of the uploaded logo watermark, or null. */
  watermarkHref?: string | null;
  /** Intrinsic logo watermark size (for aspect-ratio-preserving placement). */
  watermarkWidth?: number;
  watermarkHeight?: number;
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
      const stops =
        `<stop offset="0" stop-color="${scene.gradientFrom}"/>` +
        (scene.gradientVia ? `<stop offset="0.5" stop-color="${scene.gradientVia}"/>` : "") +
        `<stop offset="1" stop-color="${scene.gradientTo}"/>`;
      // The canvas preview (renderBackground.fillGradientBackground) honors both
      // a 3-stop "via" color and radial gradients, so the SVG must too — a
      // static linear 2-stop here would diverge from PNG/video exports.
      if (scene.gradientType === "radial") {
        // The CSS preview's `radial-gradient(circle at center)` defaults to
        // farthest-corner: radius = hypot(w, h) / 2. `r="50%"` in SVG's
        // objectBoundingBox space degrades the circle into an ellipse on
        // non-square artboards, so use userSpaceOnUse with the exact radius.
        const radius = Math.hypot(width, height) / 2;
        return `<rect width="${width}" height="${height}" fill="url(#bg-gradient)"/><radialGradient id="bg-gradient" gradientUnits="userSpaceOnUse" cx="${num(width / 2)}" cy="${num(height / 2)}" r="${num(radius)}">${stops}</radialGradient>`;
      }
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
      return `<rect width="${width}" height="${height}" fill="url(#bg-gradient)"/><linearGradient id="bg-gradient" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
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
    case "pattern": {
      const tile = scene.patternId ? PATTERN_TILES[scene.patternId] : undefined;
      if (!tile) return "";
      const tileSize = scene.patternId === "noise" ? 100 : 20;
      // The CSS preview paints patterns as a tiled background-image; mirror it
      // here with a repeating <pattern> so SVG exports show the same dots/grid/
      // diagonal/noise/plus/cross/triangle instead of a blank background.
      return `<defs><pattern id="bg-pattern" width="${tileSize}" height="${tileSize}" patternUnits="userSpaceOnUse">${tile}</pattern></defs>`
        + `<rect width="${width}" height="${height}" fill="url(#bg-pattern)"/>`;
    }
    default:
      return "";
  }
}

function mediaScale(fit: "cover" | "contain", innerW: number, innerH: number, mw: number, mh: number): number {
  return fit === "contain" ? Math.min(innerW / mw, innerH / mh) : Math.max(innerW / mw, innerH / mh);
}

function groupClipRect(group: SvgFrameGroup): string {
  const { box, cutout } = group;
  if (cutout) {
    const rx = (cutout.rx / cutout.w) * box.innerW;
    const ry = (cutout.rx / cutout.h) * box.innerH;
    return `<path d="${squirclePathD(box.innerX, box.innerY, box.innerW, box.innerH, rx, ry, cutout.power ?? CORNER_POWER_CIRCLE)}"/>`;
  }
  const isCircular = group.isCircular;
  const rounded = isCircular
    ? `rx="${num(Math.min(box.innerW, box.innerH) / 2)}"`
    : `rx="${num(Math.min(box.innerRadius, Math.min(box.innerW, box.innerH) / 2))}"`;
  return `<rect x="${num(box.innerX)}" y="${num(box.innerY)}" width="${num(box.innerW)}" height="${num(box.innerH)}" ${rounded}/>`;
}

function groupClipMarkup(group: SvgFrameGroup, index: number): string {
  return `<clipPath id="clip-${index}">${groupClipRect(group)}</clipPath>`;
}

function frameGroupMarkup(scene: EditorScene, group: SvgFrameGroup, index: number): string {
  const { box } = group;
  // Native-orientation assembly rect: landscape instances are drawn (and
  // tilted) in their native orientation and rotated as a whole, exactly like
  // the preview's rotor — the swapped landscape box itself must never be used
  // for the device footprint inside the rotated context.
  const assembly: FrameBox = box.nativeRect
    ? { ...box, x: box.nativeRect.x, y: box.nativeRect.y, width: box.nativeRect.width, height: box.nativeRect.height }
    : box;

  const mediaFit = group.mediaFit ?? "cover";
  const scale = mediaScale(mediaFit, assembly.innerW, assembly.innerH, group.mediaWidth || assembly.innerW, group.mediaHeight || assembly.innerH);
  const offX = group.offsetX ?? 0;
  const offY = group.offsetY ?? 0;
  // Base laid-out rect at zoom 1 (fit + objectPosition-style pan), then the
  // layer's static media zoom scales it about the screen center — the same
  // model as drawMediaSource (canvas) and the CSS media element's scale().
  const baseW = (group.mediaWidth || assembly.innerW) * scale;
  const baseH = (group.mediaHeight || assembly.innerH) * scale;
  const baseX = assembly.innerX + (assembly.innerW - baseW) / 2 + (offX * (assembly.innerW - baseW)) / 2;
  const baseY = assembly.innerY + (assembly.innerH - baseH) / 2 + (offY * (assembly.innerH - baseH)) / 2;
  const layerZoom = Math.max(LAYER_ZOOM.min, Math.min(LAYER_ZOOM.max, group.mediaZoom ?? 1));
  const centerX = assembly.innerX + assembly.innerW / 2;
  const centerY = assembly.innerY + assembly.innerH / 2;
  // Post-zoom pan headroom — same model as drawMediaSource and the CSS
  // transform chain R·T·S: layout pan scales with zoom, plus the extra
  // offset × (zoom − 1) × half-box translate for the post-zoom range.
  const dx = centerX + (baseX - centerX) * layerZoom + offX * (assembly.innerW - baseW) / 2 * (layerZoom - 1);
  const dy = centerY + (baseY - centerY) * layerZoom + offY * (assembly.innerH - baseH) / 2 * (layerZoom - 1);
  const dw = baseW * layerZoom;
  const dh = baseH * layerZoom;

  const mediaRaw =
    group.textLayer
      ? // Text layer: nested aspect-exact SVG stretched over the screen box
        // (same layout constants the CSS preview and canvas export use).
        buildTextLayerSvg(group.textLayer, assembly.innerW / assembly.innerH) ??
        `<rect x="${num(assembly.innerX)}" y="${num(assembly.innerY)}" width="${num(assembly.innerW)}" height="${num(assembly.innerH)}" fill="${RENDER.emptyMediaFill}"/>`
      : group.mediaHref != null
      ? `<image href="${group.mediaHref}" x="${num(dx)}" y="${num(dy)}" width="${num(dw)}" height="${num(dh)}"/>`
      : `<rect x="${num(assembly.innerX)}" y="${num(assembly.innerY)}" width="${num(assembly.innerW)}" height="${num(assembly.innerH)}" fill="${RENDER.emptyMediaFill}"/>`;
  // Rotate the media about the inner screen's center to match the CSS preview
  // (transform-origin: center). The rotation is applied only to the media so
  // the device bezel and chrome stay put.
  let media = group.rotation ? `<g transform="rotate(${num(group.rotation)} ${num(assembly.innerX + assembly.innerW / 2)} ${num(assembly.innerY + assembly.innerH / 2)})">${mediaRaw}</g>` : mediaRaw;
  if (group.blendMode && group.blendMode !== "normal") {
    // SVG supports the same mix-blend-mode keywords as CSS.
    media = `<g style="mix-blend-mode:${group.blendMode}">${media}</g>`;
  }
  if (group.opacity != null && group.opacity !== 100) {
    const alpha = Math.max(0, Math.min(1, group.opacity / 100));
    media = `<g opacity="${alpha}">${media}</g>`;
  }

  // On-screen decoration in canvas space: the geometry is expressed in units
  // of the inner screen box, so just translate to its origin. Placed inside
  // the clip group so it stays under the device bezel and follows the radius.
  const chromeScreen = group.screen ?? scene.screen;
  const chromeMarkup =
    chromeScreen.enabled
      ? `<g transform="translate(${num(assembly.innerX)} ${num(assembly.innerY)})">${screenChromeElements({ ...chromeScreen, os: chromeScreen.os ?? frameOs(group.frame) }, assembly.innerW, assembly.innerH, `sc-${index}`, group.frame)}</g>`
      : "";

  const assemblyGroup: SvgFrameGroup = { ...group, box: assembly };

  // Screen glare: diagonal light sweep clipped to the screen, painted above
  // media/chrome and below the device skin — same stops the CSS preview and
  // canvas export use. Computed up front so EVERY assembly path (flat, tilted,
  // landscape-rotated) includes it; it used to vanish whenever tilt was set.
  const glareMarkup = scene.screenGlare
    ? group.cutout
      ? `<path d="${squirclePathD(assembly.innerX, assembly.innerY, assembly.innerW, assembly.innerH, (group.cutout.rx / group.cutout.w) * assembly.innerW, (group.cutout.rx / group.cutout.h) * assembly.innerH, group.cutout.power ?? CORNER_POWER_CIRCLE)}" fill="url(#glare-sweep)"/>`
      : `<rect x="${num(assembly.innerX)}" y="${num(assembly.innerY)}" width="${num(assembly.innerW)}" height="${num(assembly.innerH)}" rx="${num(group.isCircular ? Math.min(assembly.innerW, assembly.innerH) / 2 : Math.min(assembly.innerRadius, Math.min(assembly.innerW, assembly.innerH) / 2))}" fill="url(#glare-sweep)"/>`
    : "";

  // SVG has no perspective, so a tilted scene uses the affine best-fit matrix.
  // The matrix projects the NATIVE assembly rect (rotating the projected
  // result for landscape instances — the preview's rotor composes after the
  // tilt) and every coordinate inside stays in the assembly's user space.
  const tilt = group.orientation
    ? tiltMatrixSvgRotated(scene, assembly, (group.orientation * Math.PI) / 180)
    : tiltMatrixSvg(scene, assembly);
  if (tilt) {
    return `<g transform="${tilt}"><clipPath id="clip-t${index}">${groupClipRect(assemblyGroup)}</clipPath><g clip-path="url(#clip-t${index})">${media}${chromeMarkup}${glareMarkup}</g>${frameGroupInner(scene, assemblyGroup)}</g>`;
  }
  let inner = `<g clip-path="url(#clip-${index})">${media}${chromeMarkup}${glareMarkup}</g>${frameGroupInner(scene, assemblyGroup)}`;
  if (group.orientation) {
    // The clip must live inside the rotated group so its rect rotates with it.
    // Everything inside — media, chrome, clip AND the frame body/skin — is
    // expressed in the NATIVE orientation centered on the box center, so the
    // single rotate(90°) turns the whole assembly exactly like the rotor.
    const cx = num(box.x + box.width / 2);
    const cy = num(box.y + box.height / 2);
    inner = `<g transform="rotate(${num(group.orientation)} ${cx} ${cy})"><clipPath id="clip-o${index}">${groupClipRect(assemblyGroup)}</clipPath><g clip-path="url(#clip-o${index})">${media}${chromeMarkup}${glareMarkup}</g>${frameGroupInner(scene, assemblyGroup)}</g>`;
  }
  return inner;
}

function frameGroupInner(scene: EditorScene, group: SvgFrameGroup): string {
  const { box } = group;
  const isCircular = group.isCircular;
  let frame = "";
  // The drop shadow is cast from an opaque rounded-rect silhouette (the
  // halo-only filter below), mirroring drawFrameShadow in canvasDrawing —
  // filtering the actual body/skin would derive the shadow alpha from glass
  // fills or skin raster alpha and render it far weaker than the preview.
  frame += `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.width)}" height="${num(box.height)}" rx="${num(box.outerRadius)}" fill="#000" filter="url(#frame-shadow)"/>`;
  if (group.isOverlay) {
    if (group.overlayInner) {
      const vb = group.viewBox ?? DEFAULT_VIEWBOX;
      const sx = box.width / vb.w;
      const sy = box.height / vb.h;
      // The browser URL rides in the same translate/scale group as the skin
      // so it tracks the frame at any size (coordinates are viewBox units).
      const urlText = group.browserUrl ? browserUrlSvg(group.browserUrl, scene.browserChromeTheme) : "";
      frame += `<g transform="translate(${num(box.x)} ${num(box.y)}) scale(${num(sx)} ${num(sy)})">${group.overlayInner}${urlText}</g>`;
    }
  } else {
    const frameStyle = resolveFrameStyle(scene.stylePreset);
    const radius = isCircular ? num(Math.min(box.width, box.height) / 2) : num(box.outerRadius);
    frame += `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.width)}" height="${num(box.height)}" rx="${radius}" fill="${frameStyle.fill}"/>`;
    if (frameStyle.stroke) {
      frame += `<rect x="${num(box.x)}" y="${num(box.y)}" width="${num(box.width)}" height="${num(box.height)}" rx="${radius}" fill="none" stroke="${frameStyle.strokeStyle}" stroke-width="${frameStyle.strokeWidth}"/>`;
    }
  }
  return frame;
}

/** Geometry of one blur region in canvas units + its filter radius. Shared by
 *  the defs builder and the markup pass so ids stay aligned. */
function blurRegionGeometry(a: Annotation, width: number, height: number) {
  const bx = Math.min(a.x, a.x + a.w) * width;
  const by = Math.min(a.y, a.y + a.h) * height;
  const bw = Math.abs(a.w) * width;
  const bh = Math.abs(a.h) * height;
  return { bx, by, bw, bh, radius: Math.max(1, a.strokeWidth * overlayScaleFor(width)) };
}

/** One blur-region id per annotation (-1 for non-blur rows), assigned in
 *  annotation order. Computed once and shared by the defs builder and the
 *  markup pass, so their ids can never drift apart — and no mutable
 *  module-level counter needs to be reset between calls. */
function assignBlurRegionIds(scene: EditorScene): number[] {
  const ids: number[] = [];
  let next = 0;
  for (const a of scene.annotations) ids.push(a.type === "blur" ? next++ : -1);
  return ids;
}

function annotationsMarkup(scene: EditorScene, width: number, height: number, blurIds: number[]): string {
  if (scene.annotations.length === 0) return "";
  // Overlay chrome scales with the artboard reference width (overlayMetrics),
  // matching the canvas export and the live preview.
  const s = overlayScaleFor(width);
  let out = "";
  let gradDefs = "";
  for (const [i, a] of scene.annotations.entries()) {
    const bx = Math.min(a.x, a.x + a.w) * width;
    const by = Math.min(a.y, a.y + a.h) * height;
    const bw = Math.abs(a.w) * width;
    const bh = Math.abs(a.h) * height;
    const gradId = `anno-svg-grad-${i}`;
    const grad = annotationSvgGradientDef(a, gradId, bx, by, bw, bh);
    if (grad) gradDefs += grad.def;
    const strokeRef = grad?.ref;
    if (a.type === "blur") {
      // Frosted region: replay the scene group through a Gaussian blur,
      // clipped to the rect. The scene is emitted once as #mocksy-scene and
      // referenced via <use>, so media data URLs are never duplicated.
      const idx = blurIds[i]!;
      out += `<g clip-path="url(#anno-blur-clip-${idx})"><use href="#mocksy-scene" filter="url(#anno-blur-${idx})"/></g>`;
      continue;
    }
    if (a.type === "text") {
      const weight = a.fontWeight === "normal" ? "400" : "bold";
      const style = a.fontStyle === "italic" ? ' font-style="italic"' : "";
      const anchor = a.textAlign === "center" ? "middle" : a.textAlign === "right" ? "end" : "start";
       const textX = anchor === "start" ? bx : anchor === "end" ? bx + bw : bx + bw / 2;
       const lineHeight = a.fontSize * s * RENDER.lineHeightMultiplier;
       const tspans = a.text
          .split("\n")
          .map((line, i) => `<tspan x="${num(textX)}" dy="${i === 0 ? 0 : num(lineHeight)}">${escapeMarkup(line)}</tspan>`)
          .join("");
       let bg = "";
       if (a.bgColor && a.text.trim()) {
         const approxWidth = a.text.split("\n").reduce((max, l) => Math.max(max, l.length * a.fontSize * s * 0.6), 0);
         const padding = (a.bgPadding ?? 0) * s;
         const boxX = anchor === "middle" ? textX - approxWidth / 2 - padding : anchor === "end" ? textX - approxWidth - padding : textX - padding;
         const boxY = by - padding;
         const boxW = approxWidth + padding * 2;
         const boxH = a.text.split("\n").length * lineHeight + padding * 2;
         const radius = (a.bgRadius ?? 0) * s;
         bg = `<rect x="${num(boxX)}" y="${num(boxY)}" width="${num(boxW)}" height="${num(boxH)}" rx="${num(radius)}" fill="${a.bgColor}"/>`;
       }
       const fillAttr = strokeRef ? `fill="${strokeRef}"` : `fill="${a.color}"`;
       out += `${bg}<text x="${num(textX)}" y="${num(by)}" font-size="${num(a.fontSize * s)}" font-weight="${weight}" ${fillAttr} font-family="${a.fontFamily ?? "Inter, system-ui, sans-serif"}" text-anchor="${anchor}" dominant-baseline="hanging"${style} filter="url(#anno-shadow)">${tspans}</text>`;
    } else if (a.type === "rect") {
      const strokeAttr = strokeRef ? `stroke="${strokeRef}"` : `stroke="${a.color}"`;
      out += `<rect x="${num(bx)}" y="${num(by)}" width="${num(bw)}" height="${num(bh)}" fill="none" ${strokeAttr} stroke-width="${Math.max(1, a.strokeWidth * s)}"/>`;
    } else if (a.type === "circle") {
      const strokeAttr = strokeRef ? `stroke="${strokeRef}"` : `stroke="${a.color}"`;
      out += `<ellipse cx="${num(bx + bw / 2)}" cy="${num(by + bh / 2)}" rx="${num(bw / 2)}" ry="${num(bh / 2)}" fill="none" ${strokeAttr} stroke-width="${Math.max(1, a.strokeWidth * s)}"/>`;
    } else {
      const startX = a.x * width;
      const startY = a.y * height;
      const endX = (a.x + a.w) * width;
      const endY = (a.y + a.h) * height;
      const angle = Math.atan2(endY - startY, endX - startX);
       const head = RENDER.arrowHead * s;
      const a1 = angle + Math.PI - 0.45;
      const a2 = angle + Math.PI + 0.45;
      const p1x = num(endX + head * Math.cos(a1));
      const p1y = num(endY + head * Math.sin(a1));
      const p2x = num(endX + head * Math.cos(a2));
      const p2y = num(endY + head * Math.sin(a2));
      const strokeAttr = strokeRef ? `stroke="${strokeRef}"` : `stroke="${a.color}"`;
      const fillAttr = strokeRef ? `fill="${strokeRef}"` : `fill="${a.color}"`;
      out += `<line x1="${num(startX)}" y1="${num(startY)}" x2="${num(endX)}" y2="${num(endY)}" ${strokeAttr} stroke-width="${Math.max(1, a.strokeWidth * s)}" stroke-linecap="round"/>`;
      out += `<polygon points="${num(endX)},${num(endY)} ${p1x},${p1y} ${p2x},${p2y}" ${fillAttr}/>`;
    }
  }
  return gradDefs ? `<defs>${gradDefs}</defs>${out}` : out;
}

function watermarkMarkup(scene: EditorScene, opts: SvgExportOptions): string {
  if (!scene.watermarkEnabled) return "";
  const { width, height } = opts;
  const s = overlayScaleFor(width);
  const inset = RENDER.watermarkInset * s;
  const { onLeft, onTop } = watermarkEdges(scene.watermarkPosition);

  if (scene.watermarkImageUrl && opts.watermarkHref) {
    const iw = opts.watermarkWidth ?? 1;
    const ih = opts.watermarkHeight ?? 1;
    const aspect = iw / ih;
    let drawW = scene.watermarkSize * s * aspect;
    const maxW = width * 0.45;
    if (drawW > maxW) drawW = maxW;
    const drawH = drawW / aspect;
    const x = onLeft ? inset : width - inset - drawW;
    const y = onTop ? inset : height - inset - drawH;
    return `<image href="${opts.watermarkHref}" x="${num(x)}" y="${num(y)}" width="${num(drawW)}" height="${num(drawH)}" filter="url(#anno-shadow)"/>`;
  }

  if (!scene.watermarkText) return "";
  const textX = onLeft ? inset : width - inset;
  const textY = onTop ? inset + scene.watermarkSize * s : height - inset;
  const baseline = onTop ? ' dominant-baseline="hanging"' : "";
  return `<text x="${num(textX)}" y="${num(textY)}" font-size="${num(scene.watermarkSize * s)}" font-weight="500" fill="rgba(255,255,255,0.85)" font-family="Inter, system-ui, sans-serif" text-anchor="${onLeft ? "start" : "end"}"${baseline} filter="url(#anno-shadow)">${escapeMarkup(scene.watermarkText)}</text>`;
}

/**
 * Builds a standalone SVG document for the scene. Pure and DOM-free: all
 * geometry and data URLs are supplied through `opts`, which makes it directly
 * testable. The markup mirrors `renderMockupToCanvas` (same frame box, media
 * cover/contain + pan math, shadow, watermark, annotations) so the vector
 * export matches the preview and the raster exports.
 */
/** Mirrored copy of one frame group below its bottom edge, faded out via a
 *  userSpaceOnUse mask. Rendered before the real groups so it sits behind. */
function reflectionGroupMarkup(scene: EditorScene, group: SvgFrameGroup, index: number, offset: number): string {
  void scene;
  const r = index + offset;
  const bottom = num(group.box.y + group.box.height);
  const content = frameGroupMarkup(scene, group, r);
  return `<g mask="url(#refl-mask-${r})"><g transform="translate(0 ${num(2 * Number(bottom))}) scale(1 -1)">${content}</g></g>`;
}

export function buildSvgMarkup(scene: EditorScene, opts: SvgExportOptions): string {
  const { width, height, groups, zoom = 1 } = opts;
  const shadowDy = num(RENDER.shadowOffsetY * zoom);
  const shadowStd = num((RENDER.shadowBlur / 2) * zoom);
  // Shared blur-region ids: defs below and the annotation markup above the
  // same array stay in lockstep by construction.
  const blurIds = assignBlurRegionIds(scene);

  const defs = [
    // Halo-only drop shadow: blur the opaque silhouette's alpha, offset it,
    // tint it, then subtract the silhouette itself so only the halo renders
    // (the frame body is painted separately on top, unfiltered).
    `<filter id="frame-shadow" x="-60%" y="-250%" width="220%" height="500%"><feGaussianBlur in="SourceAlpha" stdDeviation="${shadowStd}"/><feOffset dy="${shadowDy}" result="off"/><feFlood flood-color="#000" flood-opacity="${scene.shadowOpacity}"/><feComposite in2="off" operator="in" result="shadow"/><feComposite in2="SourceAlpha" operator="out"/></filter>`,
    `<filter id="anno-shadow" x="-50%" y="-100%" width="200%" height="300%"><feDropShadow dx="0" dy="${RENDER.annoShadowOffsetY}" stdDeviation="${RENDER.annoShadowBlur / 2}" flood-color="#000" flood-opacity="0.5"/></filter>`,
    scene.backgroundBlur > 0 ? `<filter id="bg-blur"><feGaussianBlur stdDeviation="${num(scene.backgroundBlur / 2)}"/></filter>` : "",
    ...scene.annotations.flatMap((a, i) => {
      if (a.type !== "blur") return [];
      const idx = blurIds[i]!;
      const { bx, by, bw, bh, radius } = blurRegionGeometry(a, width, height);
      return [
        `<clipPath id="anno-blur-clip-${idx}"><rect x="${num(bx)}" y="${num(by)}" width="${num(bw)}" height="${num(bh)}" rx="${num(Math.min(bw, bh) * 0.12)}"/></clipPath>`,
        `<filter id="anno-blur-${idx}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${num(radius)}"/></filter>`
      ];
    }),
    scene.screenGlare
      ? `<linearGradient id="glare-sweep" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.14"/><stop offset="0.52" stop-color="#fff" stop-opacity="0"/></linearGradient>`
      : "",
    ...groups.map((g, i) => groupClipMarkup(g, i)),
    ...(groups.flatMap((g, i) => {
      if (!(g.floorReflection ?? scene.floorReflection)) return [];
      const r = i + groups.length;
      const boxBottom = g.box.y + g.box.height;
      const bottom = num(boxBottom);
      return [
        groupClipMarkup(g, r),
        // Mirrors paintFloorReflection (renderMockup.ts): full alpha at the
        // device's bottom edge fading to 0 by RENDER.reflectionFade of the
        // box height BELOW it. The axis must point down into the mirrored
        // content — pointing up would pad-clamp every sample to the first
        // stop and hide the whole reflection.
        `<linearGradient id="refl-fade-${r}" x1="0" y1="${bottom}" x2="0" y2="${num(boxBottom + g.box.height * RENDER.reflectionFade)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="${RENDER.reflectionOpacity}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
        `<mask id="refl-mask-${r}"><rect x="${num(g.box.x - g.box.width)}" y="${bottom}" width="${num(g.box.width * 3)}" height="${num(g.box.height * 2)}" fill="url(#refl-fade-${r})"/></mask>`
      ];
    })),
    opts.fontCss ? `<style>${opts.fontCss}</style>` : ""
  ].filter(Boolean);

  // The whole pre-annotation scene becomes a reusable group so blur regions
  // can replay it through their filters via <use>.
  const sceneBase =
    `<g id="mocksy-scene">` +
    backgroundMarkup(scene, opts) +
    (groups.map((g, i) => (g.floorReflection ?? scene.floorReflection ? reflectionGroupMarkup(scene, g, i, groups.length) : "")).filter(Boolean).join("")) +
    groups.map((g, i) => frameGroupMarkup(scene, g, i)).join("") +
    `</g>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(width)} ${num(height)}" width="${num(width)}" height="${num(height)}">`,
    `<defs>${defs.join("")}</defs>`,
    sceneBase,
    annotationsMarkup(scene, width, height, blurIds),
    watermarkMarkup(scene, opts),
    `</svg>`
  ].join("");
}
