import type { MediaLayer } from "@/lib/types/editor";

/** Neutral (no-op) filter values; also the normalization fallbacks. */
export const LAYER_FILTER_DEFAULTS = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  blur: 0,
  grayscale: 0,
  opacity: 100
} as const;

export const LAYER_FILTER_RANGES = {
  brightness: { min: 0, max: 200 },
  contrast: { min: 0, max: 200 },
  saturate: { min: 0, max: 200 },
  blur: { min: 0, max: 20 },
  grayscale: { min: 0, max: 100 },
  opacity: { min: 0, max: 100 }
} as const;

export type LayerFilterKey = keyof typeof LAYER_FILTER_DEFAULTS;

export type LayerFilters = Pick<MediaLayer, "brightness" | "contrast" | "saturate" | "blur" | "grayscale">;

/**
 * Builds a CSS filter string from a layer's filter fields, omitting neutral
 * values so a fully-unfiltered layer gets "none". Shared by the CSS preview
 * (mockupRenderer), the canvas/export renderer (canvasDrawing) and the video
 * pipeline (which reuses the canvas renderer), so all outputs stay in sync.
 */
export function buildLayerFilterCss(layer: LayerFilters | undefined): string {
  const brightness = layer?.brightness ?? 100;
  const contrast = layer?.contrast ?? 100;
  const saturate = layer?.saturate ?? 100;
  const blur = layer?.blur ?? 0;
  const grayscale = layer?.grayscale ?? 0;
  const parts: string[] = [];
  if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
  if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
  if (saturate !== 100) parts.push(`saturate(${saturate}%)`);
  if (blur > 0) parts.push(`blur(${blur}px)`);
  if (grayscale > 0) parts.push(`grayscale(${grayscale}%)`);
  return parts.length > 0 ? parts.join(" ") : "none";
}
