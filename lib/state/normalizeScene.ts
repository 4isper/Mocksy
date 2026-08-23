import type {
  Annotation,
  AnnotationType,
  AnimationEasing,
  BackgroundMode,
  CustomFrame,
  EditorScene,
  FrameInstance,
  GradientType,
  MediaLayer,
  MediaType,
  MockupFrame,
  PatternId,
  ScreenChrome,
  ScreenChromeStyle,
  ScreenChromeTheme,
  StylePreset
} from "@/lib/types/editor";
import { ALL_FRAMES, ANIMATION_PRESETS, frameOs } from "@/lib/render/frames";
import { LAYER_FILTER_DEFAULTS } from "@/lib/render/layerFilters";
import { initialScene } from "@/lib/state/editorStore";
import { nextAnnotationId, nextFrameInstanceId, nextLayerId } from "@/lib/state/ids";

const FRAMES = ALL_FRAMES;
const STYLE_PRESETS: StylePreset[] = ["default", "glassLight", "glassDark", "outline"];
const BACKGROUND_MODES: BackgroundMode[] = ["transparent", "solid", "gradient", "image", "pattern"];
const GRADIENT_TYPES: GradientType[] = ["linear", "radial"];
const PATTERN_IDS: PatternId[] = ["dots", "grid", "diagonal", "noise", "plus", "cross", "triangle"];
const MEDIA_TYPES: MediaType[] = ["none", "image", "video"];
const MEDIA_FITS = ["cover", "contain"] as const;
const ANIMATIONS = ANIMATION_PRESETS;
const ANIMATION_EASINGS: AnimationEasing[] = ["linear", "easeInOut", "easeOut", "bounce", "spring"];
const ANNOTATION_TYPES: AnnotationType[] = ["text", "arrow", "rect", "circle", "blur"];
const SCREEN_CHROME_STYLES: ScreenChromeStyle[] = ["lock", "home", "statusBar"];
const SCREEN_CHROME_THEMES: ScreenChromeTheme[] = ["dark", "light"];

// Caps on attacker-controlled collection sizes. A crafted share URL could
// otherwise carry a million-item `layers`/`annotations` array and freeze the
// tab during normalization — these bound that without affecting real scenes.
const MAX_LAYERS = 200;
const MAX_ANNOTATIONS = 500;
const MAX_FRAME_INSTANCES = 100;

/** Normalizes the on-screen decoration, falling back to defaults per flag. */
export function normalizeScreenChrome(raw: unknown, fallback: ScreenChrome = initialScene.screen, frame: MockupFrame = initialScene.frame): ScreenChrome {
  if (!raw || typeof raw !== "object") return { ...fallback, os: frameOs(frame) };
  const r = raw as Record<string, unknown>;
  return {
    enabled: r.enabled === true,
    style: pick(r.style, SCREEN_CHROME_STYLES, fallback.style),
    theme: pick(r.theme, SCREEN_CHROME_THEMES, fallback.theme),
    showStatusBar: r.showStatusBar !== false,
    showClock: r.showClock !== false,
    showDate: r.showDate !== false,
    showDock: r.showDock !== false,
    showHomeIndicator: r.showHomeIndicator !== false,
    time: str(r.time, fallback.time) ?? fallback.time,
    date: str(r.date, fallback.date) ?? fallback.date,
    os: pick(r.os, ["ios", "android", "desktop"] as const, frameOs(frame))
  };
}

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

/** Normalizes one raw annotation-shaped object into a valid Annotation. */
function normalizeAnnotation(raw: unknown, fallback: Annotation): Annotation {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" && r.id.length > 0 ? r.id : nextAnnotationId(),
    // Clamp coordinates to a forgiving range so an out-of-bounds or NaN
    // payload can't push an overlay far off-canvas and break layout.
    type: pick(r.type, ANNOTATION_TYPES, fallback.type),
    x: num(r.x, fallback.x, -1, 2),
    y: num(r.y, fallback.y, -1, 2),
    w: num(r.w, fallback.w, -2, 2),
    h: num(r.h, fallback.h, -2, 2),
    text: str(r.text, fallback.text) ?? "",
    color: str(r.color, fallback.color) ?? fallback.color,
    strokeWidth: num(r.strokeWidth, fallback.strokeWidth, 0, 40),
    fontSize: num(r.fontSize, fallback.fontSize, 8, 200),
    fontFamily: str(r.fontFamily, null) ?? fallback.fontFamily,
    fontWeight: pick(r.fontWeight, ["normal", "bold"] as const, fallback.fontWeight ?? "bold"),
    fontStyle: pick(r.fontStyle, ["normal", "italic"] as const, fallback.fontStyle ?? "normal"),
    textAlign: pick(r.textAlign, ["left", "center", "right"] as const, fallback.textAlign ?? "left"),
    bgColor: str(r.bgColor, null),
    bgPadding: num(r.bgPadding, fallback.bgPadding ?? 0, 0, 100),
    bgRadius: num(r.bgRadius, fallback.bgRadius ?? 0, 0, 200),
    animated: r.animated === true
  };
}

/** Normalizes one raw layer-shaped object (or a legacy single-media payload). */
function normalizeLayer(raw: unknown, fallback: MediaLayer): MediaLayer {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" && r.id.length > 0 ? r.id : nextLayerId(),
    // A layer with no media (the user cleared it, or a stripped demo that the
    // share/project loader chose not to restore) must stay empty. Falling back
    // to the demo data URL here would resurrect the demo phone on every
    // normalize (load, share import, undo) — see shareState for where the demo
    // is restored deliberately.
    mediaUrl: str(r.mediaUrl, null),
    mediaType: pick(r.mediaType, MEDIA_TYPES, fallback.mediaType),
    mediaName: str(r.mediaName, fallback.mediaName),
    hidden: r.hidden === true,
    zoom: num(r.zoom, fallback.zoom, 0.1, 3),
    mediaOffsetX: num(r.mediaOffsetX, fallback.mediaOffsetX, -1, 1),
    mediaOffsetY: num(r.mediaOffsetY, fallback.mediaOffsetY, -1, 1),
    mediaFit: pick(r.mediaFit, MEDIA_FITS, fallback.mediaFit),
    rotation: num(r.rotation, fallback.rotation ?? 0, -180, 180),
    brightness: num(r.brightness, fallback.brightness ?? LAYER_FILTER_DEFAULTS.brightness, 0, 200),
    contrast: num(r.contrast, fallback.contrast ?? LAYER_FILTER_DEFAULTS.contrast, 0, 200),
    saturate: num(r.saturate, fallback.saturate ?? LAYER_FILTER_DEFAULTS.saturate, 0, 200),
    blur: num(r.blur, fallback.blur ?? LAYER_FILTER_DEFAULTS.blur, 0, 20),
    grayscale: num(r.grayscale, fallback.grayscale ?? LAYER_FILTER_DEFAULTS.grayscale, 0, 100),
    opacity: num(r.opacity, fallback.opacity ?? LAYER_FILTER_DEFAULTS.opacity, 0, 100),
    locked: r.locked === true,
    animationPreset: pick(r.animationPreset, ANIMATIONS, fallback.animationPreset),
    animationEasing: pick(r.animationEasing, ANIMATION_EASINGS, fallback.animationEasing ?? "easeInOut"),
    videoMuted: r.videoMuted !== false,
    videoLoop: r.videoLoop !== false,
    videoAutoplay: r.videoAutoplay !== false,
    videoPosterTime: num(r.videoPosterTime, fallback.videoPosterTime, 0, 1e6),
    videoDuration: num(r.videoDuration, fallback.videoDuration, 0, 1e6),
    videoTrimStart: num(r.videoTrimStart, fallback.videoTrimStart, 0, 1e6),
    videoTrimEnd: num(r.videoTrimEnd, fallback.videoTrimEnd, 0, 1e6),
    videoQuality: pick(r.videoQuality, ["low", "medium", "high"], fallback.videoQuality),
    playbackSpeed: num(r.playbackSpeed, fallback.playbackSpeed ?? 1, 0.5, 2)
  };
}

/** Normalizes one raw custom frame payload into a valid CustomFrame, or null
 *  when the payload is missing or unusable (no data: asset / invalid viewBox). */
function normalizeCustomFrame(raw: unknown): CustomFrame | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const asset = str(r.asset, null);
  const vb = (r.viewBox ?? {}) as Record<string, unknown>;
  const vbW = num(vb.w, 0, 1, 100000);
  const vbH = num(vb.h, 0, 1, 100000);
  if (!asset || vbW <= 0 || vbH <= 0) return null;
  const cutout = (r.cutout ?? {}) as Record<string, unknown>;
  return {
    id: str(r.id, null) ?? `custom-${Date.now()}`,
    asset,
    name: str(r.name, null) ?? "Custom frame",
    viewBox: { w: vbW, h: vbH },
    cutout: {
      x: num(cutout.x, 0, 0, vbW),
      y: num(cutout.y, 0, 0, vbH),
      w: num(cutout.w, vbW, 1, vbW),
      h: num(cutout.h, vbH, 1, vbH),
      rx: num(cutout.rx, 0, 0, Math.max(vbW, vbH))
    }
  };
}

/** Normalizes one raw frame instance into a valid FrameInstance. */
function normalizeFrameInstance(raw: unknown, fallback: FrameInstance): FrameInstance {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" && r.id.length > 0 ? r.id : nextFrameInstanceId(),
    frame: pick(r.frame, FRAMES, fallback.frame),
    x: num(r.x, fallback.x, 0, 1),
    y: num(r.y, fallback.y, 0, 1),
    scale: num(r.scale, fallback.scale, 0.1, 5),
    layerId: typeof r.layerId === "string" ? r.layerId : null,
    orientation: r.orientation === "landscape" ? "landscape" : r.orientation === "portrait" ? "portrait" : undefined
  };
}

/**
 * Coerces arbitrary parsed input (localStorage / share URL) into a valid
 * EditorScene. Unknown or malformed fields fall back to the initial scene so a
 * corrupted or outdated payload can never crash the editor. Legacy payloads
 * that still carry a top-level `mediaUrl` are migrated into a single layer.
 */
export function normalizeScene(raw: unknown): EditorScene {
  if (!raw || typeof raw !== "object") return { ...initialScene };
  const r = raw as Record<string, unknown>;

  // Migrate a legacy single-media scene into the layers model.
  const fallbackLayer = initialScene.layers[0];
  if (!fallbackLayer) return { ...initialScene };
  const legacyMedia = r.mediaUrl != null ? r : null;
  const rawLayers = Array.isArray(r.layers) ? r.layers.slice(0, MAX_LAYERS) : legacyMedia ? [r] : [];
  const layers = rawLayers.length > 0 ? rawLayers.map((l) => normalizeLayer(l, fallbackLayer)) : [{ ...fallbackLayer }];

  const fallbackFrame: FrameInstance = {
    id: "frame-single",
    frame: initialScene.frame,
    x: 0.5,
    y: 0.5,
    scale: 1,
    layerId: null
  };

  // Validate the uploaded frame before trusting a payload that points at it.
  const customFrame = normalizeCustomFrame(r.customFrame);
  // frame "custom" only makes sense when the custom frame payload survived.
  const frame = customFrame === null && r.frame === "custom"
    ? initialScene.frame
    : pick(r.frame, FRAMES, initialScene.frame);

  return {
    layers,
    activeLayerId: typeof r.activeLayerId === "string" ? r.activeLayerId : layers[0]?.id ?? null,
    frame,
    frameInstances: Array.isArray(r.frameInstances) && r.frameInstances.length > 0
      ? r.frameInstances.slice(0, MAX_FRAME_INSTANCES).map((fi) => normalizeFrameInstance(fi, fallbackFrame))
      : [],
    customFrame,
    stylePreset: pick(r.stylePreset, STYLE_PRESETS, initialScene.stylePreset),
    shadowOpacity: num(r.shadowOpacity, initialScene.shadowOpacity, 0, 1),
    borderRadius: num(r.borderRadius, initialScene.borderRadius, 0, 200),
    tiltX: num(r.tiltX, initialScene.tiltX, -25, 25),
    tiltY: num(r.tiltY, initialScene.tiltY, -25, 25),
    backgroundMode: pick(r.backgroundMode, BACKGROUND_MODES, initialScene.backgroundMode),
    backgroundColor: str(r.backgroundColor, initialScene.backgroundColor) ?? initialScene.backgroundColor,
    gradientFrom: str(r.gradientFrom, initialScene.gradientFrom) ?? initialScene.gradientFrom,
    gradientTo: str(r.gradientTo, initialScene.gradientTo) ?? initialScene.gradientTo,
    gradientVia: str(r.gradientVia, initialScene.gradientVia) ?? initialScene.gradientVia,
    gradientType: pick(r.gradientType, GRADIENT_TYPES, initialScene.gradientType),
    gradientAngle: num(r.gradientAngle, initialScene.gradientAngle, 0, 360),
    patternId: r.patternId != null && PATTERN_IDS.includes(r.patternId as PatternId)
      ? (r.patternId as PatternId)
      : initialScene.patternId,
    backgroundImageUrl: str(r.backgroundImageUrl, initialScene.backgroundImageUrl),
    backgroundBlur: num(r.backgroundBlur, initialScene.backgroundBlur, 0, 40),
    backgroundAudioUrl: str(r.backgroundAudioUrl, initialScene.backgroundAudioUrl),
    backgroundAudioName: str(r.backgroundAudioName, initialScene.backgroundAudioName),
    audioFadeIn: num(r.audioFadeIn, initialScene.audioFadeIn, 0, 10),
    audioFadeOut: num(r.audioFadeOut, initialScene.audioFadeOut, 0, 10),
    watermarkText: str(r.watermarkText, initialScene.watermarkText) ?? initialScene.watermarkText,
    watermarkEnabled: r.watermarkEnabled === true,
    aspectRatio: str(r.aspectRatio, initialScene.aspectRatio) ?? initialScene.aspectRatio,
    watermarkPosition: pick(r.watermarkPosition, ["bottom-right", "bottom-left", "top-right", "top-left"], initialScene.watermarkPosition),
    watermarkSize: num(r.watermarkSize, initialScene.watermarkSize, 8, 64),
    watermarkImageUrl: str(r.watermarkImageUrl, initialScene.watermarkImageUrl),
    animationDurationMs: num(r.animationDurationMs, initialScene.animationDurationMs, 500, 20000),
    screen: normalizeScreenChrome(r.screen, initialScene.screen, frame),
    // Clamp the length so a crafted share URL can't bloat the scene with a
    // megabyte-long "URL"; the address bar truncates visually anyway.
    screenGlare: r.screenGlare === true,
    floorReflection: r.floorReflection === true,
    browserUrl: str(r.browserUrl, initialScene.browserUrl)?.slice(0, 200) ?? initialScene.browserUrl,
    browserChromeTheme: r.browserChromeTheme === "dark" ? "dark" : "light",
    annotations: Array.isArray(r.annotations)
      ? r.annotations.slice(0, MAX_ANNOTATIONS).map((a) =>
          normalizeAnnotation(a, {
            id: nextAnnotationId(),
            type: "rect",
            x: 0,
            y: 0,
            w: 0.2,
            h: 0.2,
            text: "",
            color: "#00d9ff",
            strokeWidth: 4,
            fontSize: 48
          })
        )
      : []
  };
}
