import type { CSSProperties } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { frameViewBox, frameOs, getFrameSpec, type FrameSpec } from "@/lib/render/frames";
import { parseAspectRatioOr } from "@/lib/render/aspectRatio";
import { buildLayerFilterCss, LAYER_FILTER_DEFAULTS } from "@/lib/render/layerFilters";
import { resolveFrameStyle } from "@/lib/render/canvasDrawing";
import { screenChromeSvg } from "@/lib/render/screenChrome";
import { browserChromeSvg, isBrowserFrameSpec } from "@/lib/render/browserChrome";
import { buildCssBackground } from "@/lib/render/sceneBackground";
import { overlayClipDefForSpec } from "@/lib/render/squircle";
import { buildTextLayerSvg } from "@/lib/render/layerText";

function overlayClipCss(spec: FrameSpec): Pick<CSSProperties, "WebkitClipPath" | "clipPath"> {
  const def = overlayClipDefForSpec(spec);
  if (!def) return {};
  return { WebkitClipPath: `url(#${def.id})`, clipPath: `url(#${def.id})` };
}

export interface SceneCss {
  container: CSSProperties;
  frame: CSSProperties;
  /** When set, the frame is an SVG overlay drawn above the media. */
  frameOverlay: string | null;
  /** Style for the overlay SVG image (e.g. a body-shaped drop shadow). */
  overlayStyle: CSSProperties;
  /** Corner radius (px) for the media inside the frame. */
  screenRadius: number;
  /** Style for the media (image/video) element, inset to the frame's screen area. */
  mediaStyle: CSSProperties;
  /** Style for the empty-media placeholder when no media is loaded. */
  emptyMediaStyle: CSSProperties;
  /** Full SVG markup of a text layer's content stretched over the screen box,
   *  or null when the active layer is not a text layer (or has no content). */
  textSvg: string | null;
  /** Box styles positioning `textSvg` over the frame's screen area. */
  textStyle: CSSProperties;
  /** Screen-area aspect ratio (w/h) so per-layer text markup can be built
   *  outside this module without recomputing frame geometry. */
  screenAspect: number;
  /** Full SVG markup of the on-screen decoration (status bar, lock clock,
   *  home dock), or null when the screen chrome is disabled. */
  screenChrome: string | null;
  /** Positions the chrome exactly over the media's screen area. */
  screenChromeStyle: CSSProperties;
  /** Diagonal light sweep over the screen, or null when disabled. Rendered
   *  above media+chrome, below the device skin overlay. */
  screenGlareStyle: CSSProperties | null;
  /** SVG markup of the browser frame's address-bar URL text, or null for
   *  non-browser frames. Rendered above the window skin overlay. */
  browserChrome: string | null;
  /** Stretches the URL text over the whole frame (same box as the skin). */
  browserChromeStyle: CSSProperties | null;
  /** data: URL of an uploaded background image, or null when not in image mode. */
  backgroundImage: string | null;
  /** Blur radius (px) applied to the background image. */
  backgroundBlur: number;
  /** background-size value for pattern backgrounds */
  backgroundSize?: string;
}

export function buildSceneCss(scene: EditorScene, activeLayerId: string | null = scene.activeLayerId): SceneCss {
  const spec = getFrameSpec(scene.frame, scene.customFrame, scene.frameMaterial);
  const baseShadow = `0 28px 70px rgba(0,0,0,${scene.shadowOpacity})`;
  const framePadding = spec.padding;

  const { background, backgroundSize } = buildCssBackground(scene);

  const frameChrome = resolveFrameStyle(scene.stylePreset);
  const frameBorder = frameChrome.stroke
    ? `${frameChrome.strokeWidth}px solid ${frameChrome.strokeStyle}`
    : "none";

  // Each device frame keeps its own aspect ratio so changing the scene's
  // aspect ratio only resizes the canvas, never distorts the frame. The
  // "none" frame has no device shape, so it still follows the scene.
  const ratioSrc = spec.aspectRatio ?? (scene.frame === "none" ? scene.aspectRatio : "1 / 1");
  const { w: ratioW, h: ratioH } = parseAspectRatioOr(ratioSrc);
  const { w: canvasW, h: canvasH } = parseAspectRatioOr(scene.aspectRatio);
  const frameAr = ratioW / ratioH;
  const canvasAr = canvasW / canvasH;
  // Contain the frame inside the canvas: pick the limiting axis so the cross-
  // axis max constraint never clamps and breaks the aspect ratio. A fixed
  // width + maxHeight (the old code) let maxHeight clamp the height while the
  // width stayed fixed, stretching portrait phones into wide rectangles and
  // distorting the SVG skin + media.
  const basis: CSSProperties =
    frameAr <= canvasAr
      ? { height: "100%", width: "auto", maxWidth: "100%" }
      : { width: "100%", height: "auto", maxHeight: "100%" };

  const frameStyle: CSSProperties = {
    ...basis,
    // Establish a positioning context so the absolutely-positioned media and
    // overlay skin are inset relative to the frame itself, not the canvas.
    // Without this they anchor to #preview-canvas (position: relative) and
    // drift once the frame is contained (and centered) inside the canvas.
    position: "relative",
    aspectRatio: ratioSrc,
    // Never let the frame dictate the canvas size; it must fit inside the
    // canvas (whose shape is the scene aspect ratio) and stay centered.
    maxWidth: "100%",
    maxHeight: "100%",
    borderRadius: spec.isOverlay ? 0 : scene.borderRadius + framePadding,
    border: spec.isOverlay ? "none" : frameBorder,
    // The SVG skin already paints the bezel; a CSS box-shadow/border on the
    // rectangular frame div would draw a second, mismatched rectangle around
    // the phone. For overlay frames use a body-shaped drop-shadow on the frame
    // group (it follows the SVG outline, not a rectangle) and the shadow
    // opacity is driven by the Shadow control.
    boxShadow: spec.isOverlay ? "none" : baseShadow,
    filter: spec.isOverlay ? `drop-shadow(0 28px 70px rgba(0,0,0,${scene.shadowOpacity}))` : "none",
    // Zoom/animation is applied to this frame container in PreviewCanvas (which
    // also drives zoomIn/zoomOut/parallax) so the live preview matches the
    // video export, where the whole frame scales by the transform. The hook
    // overwrites `transform`; we keep `transformOrigin` centered so the
    // device + media scale together from the middle.
    transform: "none",
    transformOrigin: "center",
    backdropFilter: !spec.isOverlay && scene.stylePreset.startsWith("glass") ? "blur(10px)" : "none",
    background:
      spec.isOverlay
        ? "transparent"
        : frameChrome.fill
  };

  // Overlay skins carry their own bezel; keep the frame padding at 0 so the
  // media can be inset to the SVG's transparent cutout without double-offset.
  frameStyle.padding = spec.isOverlay ? 0 : framePadding;

  // For overlay skins the media must sit exactly inside the SVG's transparent
  // screen cutout. The cutout is defined in viewBox units, so express the
  // inset and corner radius as percentages of the frame — otherwise they would
  // only line up at the SVG's native 390px width and drift at any other size.
  // Pan the media inside the frame: object-position shifts the covered image
  // within its box by a fraction of half the frame on each axis.
  const activeLayerForCss = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  const mediaPosX = 50 + (activeLayerForCss?.mediaOffsetX ?? 0) * 50;
  const mediaPosY = 50 + (activeLayerForCss?.mediaOffsetY ?? 0) * 50;
  // Layer opacity fades the media only; bezel/chrome/glare stay at full
  // strength. Kept off the style when neutral so the CSS stays clean.
  const mediaOpacity =
    activeLayerForCss?.opacity != null && activeLayerForCss.opacity !== LAYER_FILTER_DEFAULTS.opacity
      ? Math.max(0, Math.min(1, activeLayerForCss.opacity / LAYER_FILTER_DEFAULTS.opacity))
      : undefined;
  const vb = frameViewBox(spec);
  const mediaStyle: CSSProperties = spec.isOverlay && spec.cutout
    ? {
        position: "absolute",
        left: `${(spec.cutout.x / vb.w) * 100}%`,
        top: `${(spec.cutout.y / vb.h) * 100}%`,
        width: `${(spec.cutout.w / vb.w) * 100}%`,
        height: `${(spec.cutout.h / vb.h) * 100}%`,
        objectFit: activeLayerForCss?.mediaFit ?? "cover",
        objectPosition: `${mediaPosX}% ${mediaPosY}%`,
        transform: activeLayerForCss?.rotation ? `rotate(${activeLayerForCss.rotation}deg)` : undefined,
        transformOrigin: "center",
        ...overlayClipCss(spec),
        background: "#0a0a0a",
        filter: buildLayerFilterCss(activeLayerForCss),
        opacity: mediaOpacity
      }
    : {
        width: "100%",
        height: "100%",
        objectFit: activeLayerForCss?.mediaFit ?? "cover",
        objectPosition: `${mediaPosX}% ${mediaPosY}%`,
        transform: activeLayerForCss?.rotation ? `rotate(${activeLayerForCss.rotation}deg)` : undefined,
        transformOrigin: "center",
        borderRadius: spec.screenRadius,
        background: "#0a0a0a",
        filter: buildLayerFilterCss(activeLayerForCss),
        opacity: mediaOpacity
      };

  const emptyMediaStyle: CSSProperties = spec.isOverlay && spec.cutout
    ? {
        position: "absolute",
        left: `${(spec.cutout.x / vb.w) * 100}%`,
        top: `${(spec.cutout.y / vb.h) * 100}%`,
        width: `${(spec.cutout.w / vb.w) * 100}%`,
        height: `${(spec.cutout.h / vb.h) * 100}%`,
        ...overlayClipCss(spec),
        display: "grid",
        placeItems: "center",
        color: "#a1a1aa",
        background: "rgba(255,255,255,0.03)"
      }
    : {
        position: "absolute",
        inset: 0,
        borderRadius: spec.screenRadius,
        display: "grid",
        placeItems: "center",
        color: "#a1a1aa",
        background: "rgba(255,255,255,0.03)"
      };

  // On-screen decoration overlays the same area as the media. The chrome is
  // drawn in a w×h viewBox matching the screen area's aspect ratio, so it
  // fills the box exactly when the SVG stretches to 100%/100%.
  const screenAspect = spec.isOverlay && spec.cutout
    ? spec.cutout.w / spec.cutout.h
    : ratioW / ratioH;
  const chromeW = 390;
  const chromeH = chromeW / screenAspect;
  // Overlay skins define their screen via a cutout, so a viewBox matching the
  // cutout aspect fills the box exactly. For CSS-only frames the screen is the
  // frame's content box, whose aspect differs from the device outline (uniform
  // bezel padding); the canvas export draws the chrome with fractions of that
  // box, so stretch the fixed viewBox onto it ("none") to mirror it precisely.
  const chromePar = spec.isOverlay && spec.cutout ? "xMidYMid meet" : "none";
  const screenChrome = scene.screen.enabled
    ? screenChromeSvg({ ...scene.screen, os: frameOs(scene.frame) }, chromeW, chromeH, `screen-chrome-${String(scene.frame).replace(/[^a-z0-9]/gi, "")}`, chromePar)
    : null;

  // Text layers render instead of media, stretched over the same screen box.
  // The SVG's viewBox matches the screen aspect so glyphs never distort; the
  // canvas/SVG/HTML renderers reuse the identical layout from layerText.ts.
  const textSvg = buildTextLayerSvg(activeLayerForCss, screenAspect);
  const textStyle: CSSProperties = spec.isOverlay && spec.cutout
    ? {
        position: "absolute",
        left: `${(spec.cutout.x / vb.w) * 100}%`,
        top: `${(spec.cutout.y / vb.h) * 100}%`,
        width: `${(spec.cutout.w / vb.w) * 100}%`,
        height: `${(spec.cutout.h / vb.h) * 100}%`,
        ...overlayClipCss(spec),
        overflow: "hidden",
        pointerEvents: "none"
      }
    : {
        position: "absolute",
        inset: framePadding,
        borderRadius: spec.screenRadius,
        overflow: "hidden",
        pointerEvents: "none"
      };
  const screenChromeStyle: CSSProperties = spec.isOverlay && spec.cutout
    ? {
        position: "absolute",
        left: `${(spec.cutout.x / vb.w) * 100}%`,
        top: `${(spec.cutout.y / vb.h) * 100}%`,
        width: `${(spec.cutout.w / vb.w) * 100}%`,
        height: `${(spec.cutout.h / vb.h) * 100}%`,
        ...overlayClipCss(spec),
        overflow: "hidden",
        pointerEvents: "none"
      }
    : {
        position: "absolute",
        // CSS-only frames (iphone/desktop/tablet/watch) draw the bezel via
        // padding, so the screen area is the content box — inset by that
        // padding — exactly where the media sits and where the canvas export
        // places the chrome (innerX/innerY). inset: 0 would stretch the
        // chrome over the bezel and drift from every export.
        inset: framePadding,
        borderRadius: spec.screenRadius,
        overflow: "hidden",
        pointerEvents: "none"
      };

  const overlayStyle: CSSProperties = {
    // The body-shaped shadow lives on the frame group (frameStyle.filter) so
    // it follows the SVG outline and reacts to the Shadow control.
  };

  // Browser frame: the URL text is dynamic, so it's drawn as an SVG layer
  // stretched over the whole frame (same box as the skin overlay), just above
  // it. The skin paints the pill; this only adds the text.
  const isBrowser = isBrowserFrameSpec(spec);
  const browserChrome = isBrowser ? browserChromeSvg(scene.browserUrl, scene.browserChromeTheme) : null;
  const browserChromeStyle: CSSProperties | null = isBrowser
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none"
      }
    : null;

  return {
    container: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background,
      ...(backgroundSize ? { backgroundSize } : {})
    },
    frame: frameStyle,
    frameOverlay: spec.isOverlay ? spec.asset : null,
    overlayStyle,
    screenRadius: spec.screenRadius,
    mediaStyle,
    emptyMediaStyle,
    textSvg,
    textStyle,
    screenAspect,
    screenChrome,
    screenChromeStyle,
    screenGlareStyle: buildScreenGlareStyle(scene, spec),
    browserChrome,
    browserChromeStyle,
    backgroundImage: scene.backgroundMode === "image" ? scene.backgroundImageUrl : null,
    backgroundBlur: scene.backgroundBlur,
    backgroundSize
  };
}


/** Shared gradient stops for the screen-glare sweep. Kept beside the canvas
 *  renderer's copy so the preview and exports stay pixel-identical. */
export const SCREEN_GLARE_CSS =
  "linear-gradient(to bottom right, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.14) 30%, rgba(255,255,255,0) 52%)";

function buildScreenGlareStyle(scene: EditorScene, spec: FrameSpec): CSSProperties | null {
  if (!scene.screenGlare) return null;
  const base: CSSProperties = {
    position: "absolute",
    background: SCREEN_GLARE_CSS,
    pointerEvents: "none"
  };
  // Overlay skins: clamp to the transparent screen cutout so the sweep never
  // paints over the bezel (same box the screen chrome uses). CSS frames have
  // no cutout — their content box IS the screen.
  if (spec.isOverlay && spec.cutout) {
    const vb = frameViewBox(spec);
    return {
      ...base,
      left: `${(spec.cutout.x / vb.w) * 100}%`,
      top: `${(spec.cutout.y / vb.h) * 100}%`,
      width: `${(spec.cutout.w / vb.w) * 100}%`,
      height: `${(spec.cutout.h / vb.h) * 100}%`,
      ...overlayClipCss(spec),
      overflow: "hidden"
    };
  }
  return { ...base, inset: 0, borderRadius: "inherit" };
}

/* ── Entrance animations ─────────────────────────────────────────────── */

import type { EntranceAnimation, MediaLayer } from "@/lib/types/editor";

const ENTRANCE_KEYFRAMES: Record<Exclude<EntranceAnimation, "none">, string> = {
  fadeIn: "from{opacity:0}to{opacity:1}",
  slideUp: "from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}",
  slideDown: "from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}",
  slideLeft: "from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}",
  slideRight: "from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}",
  scaleUp: "from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}"
};

const ENTRANCE_EASING: Record<Exclude<EntranceAnimation, "none">, string> = {
  fadeIn: "ease-out",
  slideUp: "cubic-bezier(0.16,1,0.3,1)",
  slideDown: "cubic-bezier(0.16,1,0.3,1)",
  slideLeft: "cubic-bezier(0.16,1,0.3,1)",
  slideRight: "cubic-bezier(0.16,1,0.3,1)",
  scaleUp: "cubic-bezier(0.34,1.56,0.64,1)"
};

/** Returns CSS animation properties for a layer's entrance animation, or an
 *  empty object when the animation is "none". The animation plays once on
 *  mount and fills forward so the element stays in its final state. */
export function buildEntranceAnimationCss(layer: MediaLayer): CSSProperties {
  const anim = layer.entranceAnimation;
  if (!anim || anim === "none") return {};
  const duration = Math.max(200, Math.min(2000, layer.entranceDuration ?? 600));
  const name = `mockup-entrance-${layer.id}`;
  return {
    animation: `${name} ${duration}ms ${ENTRANCE_EASING[anim]} both`,
  };
}

/** Returns a CSS @keyframes rule string for the given layer's entrance
 *  animation, or null when the animation is "none". */
export function buildEntranceKeyframeCss(layer: MediaLayer): string | null {
  const anim = layer.entranceAnimation;
  if (!anim || anim === "none") return null;
  const name = `mockup-entrance-${layer.id}`;
  return `@keyframes ${name}{${ENTRANCE_KEYFRAMES[anim]}}`;
}

/** Collects all unique @keyframes rules for visible layers that have an
 *  entrance animation. Returns a single <style> tag content string. */
export function buildEntranceKeyframesStyle(layers: MediaLayer[]): string {
  return layers
    .filter((l) => !l.hidden)
    .map((l) => buildEntranceKeyframeCss(l))
    .filter((css): css is string => css !== null)
    .join("\n");
}