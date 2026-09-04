"use client";

import { useCallback, useEffect, useRef } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { extractPalette, mergeWeightedPalettes, paletteColorsFlat } from "@/lib/media/palette";
import type { PaletteResult } from "@/lib/media/palette";
import { useEditorStore } from "@/lib/state/editorStore";

export function useScenePalette(scene: EditorScene, activeLayerId: string | null = scene.activeLayerId) {
  const setScenePalette = useEditorStore((s) => s.setScenePalette);

  // Cache palette results per media URL so we don't re-analyse the same media
  // when it appears in multiple frame instances or across layer switches.
  // Entries are keyed by the full data: URL (up to megabytes of base64), so an
  // unbounded map would pin every medium loaded this session until unmount —
  // LRU-capped like the media element cache in canvasMedia.ts.
  const paletteCacheRef = useRef(new Map<string, PaletteResult>());
  const PALETTE_CACHE_LIMIT = 16;
  const cachePalette = useCallback((src: string, result: PaletteResult) => {
    const cache = paletteCacheRef.current;
    cache.delete(src);
    cache.set(src, result);
    while (cache.size > PALETTE_CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }, []);

  // Recompute a merged palette from all visible media, applying area-based
  // weighting in multi-frame mode. Stores a flat hex string array for the
  // store (compatible with pickGradientPair / ControlPanel).
  const computeMergedPalette = useCallback(() => {
    const isMultiFrame = scene.frameInstances.length > 0;
    if (!isMultiFrame) {
      // Single-frame mode: use the active layer's media palette.
      const active = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
      const cached = active?.mediaUrl ? paletteCacheRef.current.get(active.mediaUrl) : null;
      setScenePalette(cached ? paletteColorsFlat(cached) : null);
      return;
    }
    // Multi-frame mode: collect cached palettes from all visible frame
    // instances and merge them weighted by on-screen area (scale²).
    const inputs: { colors: PaletteResult["colors"]; average: string; weight: number }[] = [];
    for (const inst of scene.frameInstances) {
      const layer = scene.layers.find((l) => l.id === inst.layerId);
      if (!layer || layer.hidden || !layer.mediaUrl) continue;
      const cached = paletteCacheRef.current.get(layer.mediaUrl);
      if (!cached) continue;
      inputs.push({ colors: cached.colors, average: cached.average, weight: inst.scale * inst.scale });
    }
    if (inputs.length === 0) {
      setScenePalette(null);
      return;
    }
    const merged = mergeWeightedPalettes(inputs);
    setScenePalette(merged.colors.length > 0 ? paletteColorsFlat(merged) : null);
  }, [scene, activeLayerId, setScenePalette]);

  // Extract palette from a loaded media element, cache by its src URL, then
  // recompute the merged palette for the current scene mode.
  const analyzeMedia = (el: HTMLImageElement | HTMLVideoElement) => {
    const src = (el as HTMLImageElement).currentSrc || (el as HTMLVideoElement).currentSrc || (el as HTMLVideoElement).src;
    if (!src) return;
    try {
      const result = extractPalette(el, 5);
      cachePalette(src, result);
    } catch {
      paletteCacheRef.current.delete(src);
    }
    computeMergedPalette();
  };

  // When the active layer changes in single-frame mode, try to re-extract the
  // palette from the DOM element (onLoad won't re-fire for a cached image).
  useEffect(() => {
    const isMultiFrame = scene.frameInstances.length > 0;
    if (isMultiFrame) return;
    const frame = document.querySelector<HTMLElement>("[data-mockup-frame]");
    if (!frame) return;
    const el = frame.querySelector<HTMLImageElement | HTMLVideoElement>("img, video");
    if (!el) {
      // If no element is rendered but the active layer has a cached palette,
      // use that rather than clearing — makes layer switches instant.
      const active = scene.layers.find((l) => l.id === activeLayerId);
      if (active?.mediaUrl && paletteCacheRef.current.has(active.mediaUrl)) {
        computeMergedPalette();
        return;
      }
      setScenePalette(null);
      return;
    }
    const ready = el instanceof HTMLVideoElement ? el.readyState >= 2 : el.complete && el.naturalWidth > 0;
    if (ready) analyzeMedia(el);
    else computeMergedPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId]);

  // Recompute the merged palette whenever visible frame instances or layer
  // media/hidden state changes (e.g. adding/removing a frame instance,
  // toggling visibility, replacing a layer's media).
  useEffect(() => {
    computeMergedPalette();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.frameInstances, scene.layers.map((l) => (l.mediaUrl ?? "") + l.hidden).join("|")]);

  return { analyzeMedia };
}
