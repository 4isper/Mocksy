import type { CSSProperties } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { getFrameSpec } from "@/lib/render/frames";

interface SceneCss {
  container: CSSProperties;
  frame: CSSProperties;
  /** When set, the frame is an SVG overlay drawn above the media. */
  frameOverlay: string | null;
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
    borderRadius: spec.isOverlay ? spec.screenRadius : scene.frame === "watch" ? "50%" : scene.borderRadius + framePadding,
    border: spec.isOverlay ? "none" : frameBorder,
    boxShadow: baseShadow,
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
  // screen cutout, not fill the whole frame (which would spill under the opaque
  // bezel). Inset the media by the same padding the cutout uses.
  const mediaStyle: CSSProperties = spec.isOverlay
    ? {
        position: "absolute",
        top: framePadding,
        left: framePadding,
        width: `calc(100% - ${framePadding * 2}px)`,
        height: `calc(100% - ${framePadding * 2}px)`,
        objectFit: "cover",
        borderRadius: spec.screenRadius,
        background: "#0a0a0a"
      }
    : {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        borderRadius: spec.screenRadius,
        background: "#0a0a0a"
      };

  const emptyMediaStyle: CSSProperties = spec.isOverlay
    ? {
        position: "absolute",
        top: framePadding,
        left: framePadding,
        width: `calc(100% - ${framePadding * 2}px)`,
        height: `calc(100% - ${framePadding * 2}px)`,
        borderRadius: spec.screenRadius,
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

  return {
    container: {
      position: "relative",
      display: "grid",
      placeItems: "center",
      background
    },
    frame: frameStyle,
    frameOverlay: spec.isOverlay ? spec.asset : null,
    screenRadius: spec.screenRadius,
    mediaStyle,
    emptyMediaStyle
  };
}
