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
    aspectRatio: scene.aspectRatio,
    borderRadius: spec.isOverlay ? spec.screenRadius : scene.borderRadius + framePadding,
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

  frameStyle.padding = framePadding;

  return {
    container: {
      position: "relative",
      display: "grid",
      placeItems: "center",
      background
    },
    frame: frameStyle,
    frameOverlay: spec.isOverlay ? spec.asset : null,
    screenRadius: spec.screenRadius
  };
}
