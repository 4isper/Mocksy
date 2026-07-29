import type { CSSProperties } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec, SVG_VIEWBOX_HEIGHT, SVG_VIEWBOX_WIDTH } from "@/lib/render/frames";

interface SceneCss {
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
  /** data: URL of an uploaded background image, or null when not in image mode. */
  backgroundImage: string | null;
  /** Blur radius (px) applied to the background image. */
  backgroundBlur: number;
}

export function buildSceneCss(scene: EditorScene): SceneCss {
  const spec = getFrameSpec(scene.frame);
  const baseShadow = `0 28px 70px rgba(0,0,0,${scene.shadowOpacity})`;
  const framePadding = spec.padding;

  const background =
    scene.backgroundMode === "solid"
      ? scene.backgroundColor
      : scene.backgroundMode === "gradient"
        ? `linear-gradient(${scene.gradientAngle}deg, ${scene.gradientFrom}, ${scene.gradientTo})`
        : scene.backgroundMode === "image"
          ? "#0a0a0f"
          : "transparent";

  const frameBorder =
    scene.stylePreset === "outline"
      ? "2px solid rgba(255,255,255,0.35)"
      : scene.stylePreset === "glassLight"
        ? "1px solid rgba(255,255,255,0.45)"
        : scene.stylePreset === "glassDark"
          ? "1px solid rgba(255,255,255,0.15)"
          : "none";

  // Each device frame keeps its own aspect ratio so changing the scene's
  // aspect ratio only resizes the canvas, never distorts the frame. The
  // "none" frame has no device shape, so it still follows the scene.
  const ratioSrc = spec.aspectRatio ?? (scene.frame === "none" ? scene.aspectRatio : "1 / 1");
  const [ratioW, ratioH] = ratioSrc.split("/").map((n) => Number(n.trim()));
  const [canvasW, canvasH] = scene.aspectRatio.split("/").map((n) => Number(n.trim()));
  const frameAr = (ratioW ?? 1) / (ratioH ?? 1);
  const canvasAr = (canvasW ?? 1) / (canvasH ?? 1);
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
    borderRadius: spec.isOverlay ? 0 : scene.frame === "watch" ? "50%" : scene.borderRadius + framePadding,
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
        : scene.stylePreset === "glassDark"
          ? "rgba(6,6,6,0.25)"
          : "rgba(255,255,255,0.06)"
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
  const activeLayerForCss = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];
  const mediaPosX = 50 + (activeLayerForCss?.mediaOffsetX ?? 0) * 50;
  const mediaPosY = 50 + (activeLayerForCss?.mediaOffsetY ?? 0) * 50;
  const mediaStyle: CSSProperties = spec.isOverlay && spec.cutout
    ? {
        position: "absolute",
        left: `${(spec.cutout.x / SVG_VIEWBOX_WIDTH) * 100}%`,
        top: `${(spec.cutout.y / SVG_VIEWBOX_HEIGHT) * 100}%`,
        width: `${(spec.cutout.w / SVG_VIEWBOX_WIDTH) * 100}%`,
        height: `${(spec.cutout.h / SVG_VIEWBOX_HEIGHT) * 100}%`,
        objectFit: activeLayerForCss?.mediaFit ?? "cover",
        objectPosition: `${mediaPosX}% ${mediaPosY}%`,
        borderRadius: `${(spec.cutout.rx / spec.cutout.w) * 100}% / ${(spec.cutout.rx / spec.cutout.h) * 100}%`,
        background: "#0a0a0a"
      }
    : {
        width: "100%",
        height: "100%",
        objectFit: activeLayerForCss?.mediaFit ?? "cover",
        objectPosition: `${mediaPosX}% ${mediaPosY}%`,
        borderRadius: spec.screenRadius,
        background: "#0a0a0a"
      };

  const emptyMediaStyle: CSSProperties = spec.isOverlay && spec.cutout
    ? {
        position: "absolute",
        left: `${(spec.cutout.x / SVG_VIEWBOX_WIDTH) * 100}%`,
        top: `${(spec.cutout.y / SVG_VIEWBOX_HEIGHT) * 100}%`,
        width: `${(spec.cutout.w / SVG_VIEWBOX_WIDTH) * 100}%`,
        height: `${(spec.cutout.h / SVG_VIEWBOX_HEIGHT) * 100}%`,
        borderRadius: `${(spec.cutout.rx / spec.cutout.w) * 100}% / ${(spec.cutout.rx / spec.cutout.h) * 100}%`,
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

  const overlayStyle: CSSProperties = {
    // The body-shaped shadow lives on the frame group (frameStyle.filter) so
    // it follows the SVG outline and reacts to the Shadow control.
  };

  return {
    container: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background
    },
    frame: frameStyle,
    frameOverlay: spec.isOverlay ? spec.asset : null,
    overlayStyle,
    screenRadius: spec.screenRadius,
    mediaStyle,
    emptyMediaStyle,
    backgroundImage: scene.backgroundMode === "image" ? scene.backgroundImageUrl : null,
    backgroundBlur: scene.backgroundBlur
  };
}
