import type { CSSProperties } from "react";
import type { EditorScene } from "@/lib/types/editor";

interface SceneCss {
  container: CSSProperties;
  frame: CSSProperties;
}

export function buildSceneCss(scene: EditorScene): SceneCss {
  const baseShadow = `0 28px 70px rgba(0,0,0,${scene.shadowOpacity})`;
  const framePadding =
    scene.frame === "iphone" ? 18 : scene.frame === "tablet" ? 14 : scene.frame === "desktop" ? 10 : 0;

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

  return {
    container: {
      position: "relative",
      display: "grid",
      placeItems: "center",
      background
    },
    frame: {
      width: "min(900px, 80%)",
      aspectRatio: scene.aspectRatio,
      padding: framePadding,
      borderRadius: scene.borderRadius + framePadding,
      border: frameBorder,
      boxShadow: baseShadow,
      transform: `scale(${scene.zoom})`,
      backdropFilter: scene.stylePreset.startsWith("glass") ? "blur(10px)" : "none",
      background: scene.stylePreset === "glassDark" ? "rgba(6,6,6,0.25)" : "rgba(255,255,255,0.06)"
    }
  };
}
