import type { MediaLayer } from "@/lib/types/editor";

export interface VideoKeyframe {
  at: number;
  zoom: number;
  x: number;
  y: number;
}

export function buildVideoTimeline(layer: MediaLayer): VideoKeyframe[] {
  switch (layer.animationPreset) {
    case "zoomIn":
      return [
        { at: 0, zoom: 1, x: 0, y: 0 },
        { at: 1, zoom: 1.12, x: 0, y: 0 }
      ];
    case "zoomOut":
      return [
        { at: 0, zoom: 1.12, x: 0, y: 0 },
        { at: 1, zoom: 1, x: 0, y: 0 }
      ];
    case "parallax":
      return [
        { at: 0, zoom: 1.03, x: -10, y: -6 },
        { at: 0.5, zoom: 1.06, x: 10, y: 6 },
        { at: 1, zoom: 1.03, x: -10, y: -6 }
      ];
    case "panLeft":
      return [
        { at: 0, zoom: 1, x: 20, y: 0 },
        { at: 1, zoom: 1, x: -20, y: 0 }
      ];
    case "panRight":
      return [
        { at: 0, zoom: 1, x: -20, y: 0 },
        { at: 1, zoom: 1, x: 20, y: 0 }
      ];
    case "breathe":
      return [
        { at: 0, zoom: 1, x: 0, y: 0 },
        { at: 0.5, zoom: 1.06, x: 0, y: 0 },
        { at: 1, zoom: 1, x: 0, y: 0 }
      ];
    default:
      return [{ at: 0, zoom: layer.zoom, x: 0, y: 0 }];
  }
}

export interface SampledTransform {
  zoom: number;
  x: number;
  y: number;
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
}

/**
 * Interpolates a layer's animation transform at a normalized progress (0..1).
 * For a single keyframe it returns that keyframe; otherwise it lerps between
 * the surrounding keyframes with ease-in-out easing.
 */
export function sampleVideoTransform(layer: MediaLayer, progress: number): SampledTransform {
  const timeline = buildVideoTimeline(layer);
  if (timeline.length === 0) return { zoom: layer.zoom, x: 0, y: 0 };
  if (timeline.length === 1) {
    const k = timeline[0];
    if (!k) return { zoom: layer.zoom, x: 0, y: 0 };
    return { zoom: k.zoom, x: k.x, y: k.y };
  }
  const p = Math.max(0, Math.min(1, progress));
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  if (!first || !last) return { zoom: layer.zoom, x: 0, y: 0 };
  let lower = first;
  let upper = last;
  for (let i = 0; i < timeline.length - 1; i++) {
    const curr = timeline[i];
    const next = timeline[i + 1];
    if (curr && next && p >= curr.at && p <= next.at) {
      lower = curr;
      upper = next;
      break;
    }
  }
  const span = upper.at - lower.at;
  const rawT = span > 0 ? (p - lower.at) / span : 0;
  const t = easeInOutQuad(rawT);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    zoom: lerp(lower.zoom, upper.zoom),
    x: lerp(lower.x, upper.x),
    y: lerp(lower.y, upper.y)
  };
}
