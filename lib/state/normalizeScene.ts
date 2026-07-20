import type {
  BackgroundMode,
  EditorScene,
  MediaType,
  MockupFrame,
  StylePreset
} from "@/lib/types/editor";
import { FRAME_SPECS, ANIMATION_PRESETS } from "@/lib/render/frames";
import { initialScene } from "@/lib/state/editorStore";

const FRAMES = Object.keys(FRAME_SPECS) as MockupFrame[];
const STYLE_PRESETS: StylePreset[] = ["default", "glassLight", "glassDark", "outline"];
const BACKGROUND_MODES: BackgroundMode[] = ["transparent", "solid", "gradient"];
const MEDIA_TYPES: MediaType[] = ["none", "image", "video"];

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Coerces arbitrary parsed input (localStorage / share URL) into a valid
 * EditorScene. Unknown or malformed fields fall back to the initial scene so a
 * corrupted or outdated payload can never crash the editor.
 */
export function normalizeScene(raw: unknown): EditorScene {
  if (!raw || typeof raw !== "object") return { ...initialScene };
  const r = raw as Record<string, unknown>;

  return {
    ...initialScene,
    mediaUrl: str(r.mediaUrl, null),
    mediaType: pick(r.mediaType, MEDIA_TYPES, "none"),
    mediaName: str(r.mediaName, null),
    frame: pick(r.frame, FRAMES, initialScene.frame),
    stylePreset: pick(r.stylePreset, STYLE_PRESETS, initialScene.stylePreset),
    animationPreset: pick(r.animationPreset, ANIMATION_PRESETS, initialScene.animationPreset),
    zoom: num(r.zoom, initialScene.zoom, 0.1, 3),
    mediaOffsetX: num(r.mediaOffsetX, initialScene.mediaOffsetX, -1, 1),
    mediaOffsetY: num(r.mediaOffsetY, initialScene.mediaOffsetY, -1, 1),
    shadowOpacity: num(r.shadowOpacity, initialScene.shadowOpacity, 0, 1),
    borderRadius: num(r.borderRadius, initialScene.borderRadius, 0, 200),
    backgroundMode: pick(r.backgroundMode, BACKGROUND_MODES, initialScene.backgroundMode),
    backgroundColor: str(r.backgroundColor, initialScene.backgroundColor) ?? initialScene.backgroundColor,
    gradientFrom: str(r.gradientFrom, initialScene.gradientFrom) ?? initialScene.gradientFrom,
    gradientTo: str(r.gradientTo, initialScene.gradientTo) ?? initialScene.gradientTo,
    watermarkText: str(r.watermarkText, initialScene.watermarkText) ?? initialScene.watermarkText,
    watermarkEnabled: r.watermarkEnabled === true,
    aspectRatio: str(r.aspectRatio, initialScene.aspectRatio) ?? initialScene.aspectRatio,
    videoMuted: r.videoMuted !== false,
    videoLoop: r.videoLoop !== false,
    videoAutoplay: r.videoAutoplay !== false,
    videoPosterTime: num(r.videoPosterTime, 0, 0, 1e6),
    videoDuration: num(r.videoDuration, 0, 0, 1e6),
    videoTrimStart: num(r.videoTrimStart, 0, 0, 1e6),
    videoTrimEnd: num(r.videoTrimEnd, 0, 0, 1e6)
  };
}
