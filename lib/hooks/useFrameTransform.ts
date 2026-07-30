"use client";

import { useEffect, useRef } from "react";
import type { MediaLayer } from "@/lib/types/editor";
import { sampleVideoTransform } from "@/lib/render/videoComposer";

/** Duration of one animation loop in the preview, matching the video export. */
const ANIMATION_DURATION_MS = 3000;

/**
 * Drives the frame's zoomIn/zoomOut/parallax in the live preview by writing
 * the transform straight to the frame DOM via rAF — no React re-render per
 * frame, and buildSceneCss (the expensive part) is untouched. The sampled
 * transform mirrors sampleVideoTransform used by the video export, so what you
 * see previews what you export. Zoom/animation scale the whole mockup (device
 * + media together), matching the export where the frame box is multiplied by
 * the zoom.
 */
export function useFrameTransform(node: React.RefObject<HTMLDivElement | null>, layer: MediaLayer | undefined) {
  const layerRef = useRef(layer);
  useEffect(() => {
    layerRef.current = layer;
  });
  const animates = !!layer && layer.animationPreset !== "none";

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const apply = (zoom: number, x: number, y: number) => {
      el.style.setProperty("transform", `scale(${zoom}) translate(${x * 2}px, ${y * 2}px)`);
    };
    if (!animates) {
      const base = sampleVideoTransform(layerRef.current ?? ({} as MediaLayer), 0);
      apply(base.zoom, base.x, base.y);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const progress = ((performance.now() - start) % ANIMATION_DURATION_MS) / ANIMATION_DURATION_MS;
      const { zoom, x, y } = sampleVideoTransform(layerRef.current ?? ({} as MediaLayer), progress);
      apply(zoom, x, y);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Re-seed when the preset, zoom, or pan changes so the static branch
    // re-applies, and the rAF loop picks up fresh values.
  }, [node, animates, layer?.animationPreset, layer?.zoom, layer?.mediaOffsetX, layer?.mediaOffsetY]);
}
