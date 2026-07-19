import type { EditorScene } from "@/lib/types/editor";

export interface VideoKeyframe {
  at: number;
  zoom: number;
  x: number;
  y: number;
}

export function buildVideoTimeline(scene: EditorScene): VideoKeyframe[] {
  switch (scene.animationPreset) {
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
    default:
      return [{ at: 0, zoom: scene.zoom, x: 0, y: 0 }];
  }
}

export interface SampledTransform {
  zoom: number;
  x: number;
  y: number;
}

/**
 * Interpolates the animation transform at a normalized progress (0..1) so the
 * live preview can mirror the video export. For a single keyframe it returns
 * that keyframe; otherwise it lerps between the surrounding keyframes.
 */
export function sampleVideoTransform(scene: EditorScene, progress: number): SampledTransform {
  const timeline = buildVideoTimeline(scene);
  if (timeline.length === 0) return { zoom: scene.zoom, x: 0, y: 0 };
  if (timeline.length === 1) {
    const k = timeline[0];
    return { zoom: k.zoom, x: k.x, y: k.y };
  }
  const p = Math.max(0, Math.min(1, progress));
  let lower = timeline[0];
  let upper = timeline[timeline.length - 1];
  for (let i = 0; i < timeline.length - 1; i++) {
    if (p >= timeline[i].at && p <= timeline[i + 1].at) {
      lower = timeline[i];
      upper = timeline[i + 1];
      break;
    }
  }
  const span = upper.at - lower.at;
  const t = span > 0 ? (p - lower.at) / span : 0;
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    zoom: lerp(lower.zoom, upper.zoom),
    x: lerp(lower.x, upper.x),
    y: lerp(lower.y, upper.y)
  };
}
