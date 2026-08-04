import type {
  Annotation,
  AnnotationType,
  EditorScene,
  MediaLayer
} from "@/lib/types/editor";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";
import { countOf, nextAnnotationId, nextLayerId } from "@/lib/state/ids";

export { nextLayerId, nextAnnotationId };

const ANNOTATION_COLORS = ["#00d9ff", "#f87171", "#fbbf24", "#4ade80", "#c084fc", "#ffffff"];

export function makeAnnotation(type: AnnotationType): Annotation {
  const color = ANNOTATION_COLORS[countOf("anno") % ANNOTATION_COLORS.length] ?? "#00d9ff";
  const base = {
    id: nextAnnotationId(),
    type,
    color,
    strokeWidth: type === "text" ? 0 : 4,
    // Anchored near the center so a freshly added overlay is visible and
    // easy to grab, regardless of the current canvas aspect ratio.
    x: 0.32,
    y: 0.32
  };
  if (type === "text") {
    return { ...base, w: 0.36, h: 0, text: "Label", fontSize: 48, fontFamily: "Inter, system-ui, sans-serif", fontWeight: "bold", fontStyle: "normal", textAlign: "left", bgColor: null, bgPadding: 0, bgRadius: 0 };
  }
  if (type === "arrow") {
    return { ...base, w: 0.32, h: 0.2, text: "", fontSize: 0 };
  }
  if (type === "circle") {
    return { ...base, w: 0.2, h: 0.2, text: "", fontSize: 0 };
  }
  return { ...base, w: 0.28, h: 0.2, text: "", fontSize: 0 };
}

export function makeDemoLayer(): MediaLayer {
  return {
    id: nextLayerId(),
    mediaUrl: DEMO_MEDIA_URL,
    mediaType: "image",
    mediaName: DEMO_MEDIA_NAME,
    hidden: false,
    zoom: 1,
    mediaOffsetX: 0,
    mediaOffsetY: 0,
    mediaFit: "cover",
    brightness: 100,
    contrast: 100,
    saturate: 100,
    blur: 0,
    grayscale: 0,
    animationPreset: "none",
    animationEasing: "easeInOut",
    videoMuted: true,
    videoLoop: true,
    videoAutoplay: true,
    videoPosterTime: 0,
    videoDuration: 0,
    videoTrimStart: 0,
    videoTrimEnd: 0,
    videoQuality: "medium"
  };
}

/** Returns the layer currently targeted by scene-level controls. The id comes
 *  from the store root (`activeLayerId`); the scene's own field is only the
 *  persisted snapshot, so pass it explicitly. Defaults to the snapshot for
 *  callers that only have a scene (e.g. tests). */
export function activeLayer(scene: EditorScene, activeLayerId: string | null = scene.activeLayerId): MediaLayer | undefined {
  return scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
}

/** Poster time of the active video layer (or 0 when none). */
export function activePosterTime(scene: EditorScene, activeLayerId: string | null = scene.activeLayerId): number {
  const layer = activeLayer(scene, activeLayerId);
  return layer?.videoPosterTime ?? 0;
}

/** Applies a patch to the active layer, returning a new layers array. */
export function patchActive(scene: EditorScene, patch: Partial<MediaLayer>, activeLayerId: string | null = scene.activeLayerId): MediaLayer[] {
  const id = activeLayerId ?? scene.layers[0]?.id;
  return scene.layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
}
