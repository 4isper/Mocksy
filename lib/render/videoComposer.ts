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
