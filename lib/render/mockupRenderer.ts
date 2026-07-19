import type { CSSProperties } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec } from "@/lib/render/frames";

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
}

export function buildSceneCss(scene: EditorScene): SceneCss {
  const spec = getFrameSpec(scene.frame);
  const baseShadow = `0 28px 70px rgba(0,0,0,${scene.shadowOpacity})`;
  const framePadding = spec.padding;

  const background =
    scene.backgroundMode === "solid"
      ? scene.backgroundColor
      : scene.backgroundMode === "gradient"
        ? `linear-gradient(120deg, ${scene.gradientFrom}, ${scene.gradientTo})`
        : "transparent";

  const frameBorder =
    scene.stylePreset === "outline"
      ? "2px solid rgba(255,255,255,0.35)"
      : scene.stylePreset === "glassLight"
        ? "1px solid rgba(255,255,255,0.45)"
        : scene.stylePreset === "glassDark"
          ? "1px solid rgba(255,255,255,0.15)"
          : "none";

  const frameStyle: CSSProperties = {
    width: "min(900px, 80%)",
    // Overlay skins ship at a fixed device aspect ratio; adopt it so the
    // stretched SVG and the media inside it keep their proportions.
    aspectRatio: spec.aspectRatio ?? scene.aspectRatio,
    borderRadius: spec.isOverlay ? 0 : scene.frame === "watch" ? "50%" : scene.borderRadius + framePadding,
    border: spec.isOverlay ? "none" : frameBorder,
    // The SVG skin already paints the bezel; a CSS box-shadow/border on the
    // rectangular frame div would draw a second, mismatched rectangle around
    // the phone. For overlay frames use a body-shaped drop-shadow on the frame
    // group (it follows the SVG outline, not a rectangle) and the shadow
    // opacity is driven by the Shadow control.
    boxShadow: spec.isOverlay ? "none" : baseShadow,
    filter: spec.isOverlay ? `drop-shadow(0 28px 70px rgba(0,0,0,${scene.shadowOpacity}))` : "none",
    transform: `scale(${scene.zoom})`,
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
  const mediaStyle: CSSProperties = spec.isOverlay && spec.cutout
    ? {
        position: "absolute",
        left: `${(spec.cutout.x / 390) * 100}%`,
        top: `${(spec.cutout.y / 844) * 100}%`,
        width: `${(spec.cutout.w / 390) * 100}%`,
        height: `${(spec.cutout.h / 844) * 100}%`,
        objectFit: "cover",
        borderRadius: `${(spec.cutout.rx / spec.cutout.w) * 100}% / ${(spec.cutout.rx / spec.cutout.h) * 100}%`,
        background: "#0a0a0a"
      }
    : {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        borderRadius: spec.screenRadius,
        background: "#0a0a0a"
      };

  const emptyMediaStyle: CSSProperties = spec.isOverlay && spec.cutout
    ? {
        position: "absolute",
        left: `${(spec.cutout.x / 390) * 100}%`,
        top: `${(spec.cutout.y / 844) * 100}%`,
        width: `${(spec.cutout.w / 390) * 100}%`,
        height: `${(spec.cutout.h / 844) * 100}%`,
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
      display: "grid",
      placeItems: "center",
      background
    },
    frame: frameStyle,
    frameOverlay: spec.isOverlay ? spec.asset : null,
    overlayStyle,
    screenRadius: spec.screenRadius,
    mediaStyle,
    emptyMediaStyle
  };
}
