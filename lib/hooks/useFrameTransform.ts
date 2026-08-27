"use client";

import { useEffect, useRef } from "react";
import type { MediaLayer } from "@/lib/types/editor";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { PAN_OFFSET_SCALE } from "@/lib/render/frameGeometry";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

/**
 * Drives the frame's zoomIn/zoomOut/parallax in the live preview by writing
 * the transform straight to the frame DOM via rAF — no React re-render per
 * frame, and buildSceneCss (the expensive part) is untouched. The sampled
 * transform mirrors sampleVideoTransform used by the video export, so what you
 * see previews what you export. Zoom/animation scale the whole mockup (device
 * + media together), matching the export where the frame box is multiplied by
 * the zoom. `durationMs` is the length of one animation loop.
 * When the user prefers reduced motion, the animation loop is skipped and a
 * static frame is shown instead. `tiltPrefix` (from `tiltCss`) is prepended so
 * the 3D tilt and the zoom/pan compose into a single transform.
 */
export function useFrameTransform(
  node: React.RefObject<HTMLDivElement | null>,
  layer: MediaLayer | undefined,
  durationMs = 3000,
  tiltPrefix = ""
) {
  const layerRef = useRef(layer);
  useEffect(() => {
    layerRef.current = layer;
  });
  const prefersReducedMotion = usePrefersReducedMotion();
  const animates = !prefersReducedMotion && !!layer && layer.animationPreset !== "none";

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const apply = (zoom: number, x: number, y: number) => {
      el.style.setProperty("transform", `${tiltPrefix}scale(${zoom}) translate(${x * PAN_OFFSET_SCALE}px, ${y * PAN_OFFSET_SCALE}px)`);
    };
    if (!animates) {
      const base = sampleVideoTransform(layerRef.current ?? ({} as MediaLayer), 0);
      apply(base.zoom, base.x, base.y);
      return;
    }
    const duration = Math.max(100, durationMs);
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const progress = ((performance.now() - start) % duration) / duration;
      const { zoom, x, y } = sampleVideoTransform(layerRef.current ?? ({} as MediaLayer), progress);
      apply(zoom, x, y);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Re-seed when the preset, zoom, or pan changes so the static branch
    // re-applies, and the rAF loop picks up fresh values.
  // mediaOffsetX/Y are intentionally excluded: panning updates them via the
  // ref, so the rAF loop always reads fresh values without restarting.
  }, [node, animates, durationMs, tiltPrefix, layer?.animationPreset, layer?.zoom]);
}
