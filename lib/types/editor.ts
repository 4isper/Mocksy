export type BackgroundMode = "transparent" | "solid" | "gradient" | "image" | "pattern";

export type GradientType = "linear" | "radial";

export type PatternId = "dots" | "grid" | "diagonal" | "noise" | "plus" | "cross" | "triangle";

export type AnnotationType = "text" | "arrow" | "rect" | "circle" | "blur";

export type FontWeight = "normal" | "bold";
export type FontStyle = "normal" | "italic";
export type TextAlign = "left" | "center" | "right";

/** A non-media overlay drawn on top of the mockup (text, arrow, rectangle,
 *  blur region).
 *  Position and size are fractions (0..1) of the canvas so they scale with the
 *  preview and the exported PNG/video at any pixel ratio. For arrows, (x, y) is
 *  the start point and (x + w, y + h) the end, so negative w/h flip direction.
 *  For "blur", `strokeWidth` is the blur radius in px and the region is a
 *  rounded rect that pixel-blurs whatever is drawn beneath it. */
export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  strokeWidth: number;
  fontSize: number;
  /** Font family for text annotations. Falls back to "Inter, system-ui, sans-serif" when absent. */
  fontFamily?: string;
  /** Font weight for text annotations (default "bold"). */
  fontWeight?: FontWeight;
  /** Italic flag for text annotations (default "normal"). */
  fontStyle?: FontStyle;
  /** Horizontal alignment for text annotations (default "left"). */
  textAlign?: TextAlign;
  /** Background color behind text (optional, e.g. "rgba(0,0,0,0.5)"). */
  bgColor?: string | null;
  /** Padding around text inside background box, in px (default 0). */
  bgPadding?: number;
  /** Border-radius of background box, in px (default 0). */
  bgRadius?: number;
  /** When true, the annotation plays an entrance animation (draw-on for
   *  shapes/arrows, typewriter for text) in the live preview. Export renders
   *  the final state regardless. */
  animated?: boolean;
}
export type MockupFrame = "none" | "iphone" | "iphone15" | "iphone16pro" | "pixel8pro" | "galaxy24" | "iphoneSE" | "ipad" | "galaxyTab" | "desktop" | "tablet" | "macbook" | "imac" | "notebook" | "browser" | "tv" | "watchUltra" | "watch" | "custom";
export type StylePreset = "default" | "glassLight" | "glassDark" | "outline";
export type AnimationPreset = "none" | "zoomIn" | "zoomOut" | "parallax" | "panLeft" | "panRight" | "breathe" | "float" | "sway";
/** Easing curve applied between animation keyframes. */
export type AnimationEasing = "linear" | "easeInOut" | "easeOut" | "bounce" | "spring";
/** Screen decoration style rendered over the media (lock screen, home screen). */
export type ScreenChromeStyle = "lock" | "home" | "statusBar";
/** Accent theme of the screen decoration (text, status bar, dock). */
export type ScreenChromeTheme = "dark" | "light";

/** On-screen UI decoration drawn above the media: status bar, lock-screen
 *  clock/date, home dock, home indicator. All flags live in one object so the
 *  renderers (CSS preview, canvas, SVG, HTML) share a single source of truth. */
export interface ScreenChrome {
  /** Master switch; when false no decoration is drawn. */
  enabled: boolean;
  style: ScreenChromeStyle;
  theme: ScreenChromeTheme;
  /** Top status bar (time + signal/wifi/battery glyphs). */
  showStatusBar: boolean;
  /** Large centered clock (lock style). */
  showClock: boolean;
  /** Date line under the clock (lock style). */
  showDate: boolean;
  /** Home dock with app icons (home style). */
  showDock: boolean;
  /** Home indicator pill at the bottom of the screen. */
  showHomeIndicator: boolean;
  /** Clock text, e.g. "9:41". */
  time: string;
  /** Date text under the clock, e.g. "Tuesday, August 4". */
  date: string;
}
export type MediaType = "none" | "image" | "video";
export type VideoQuality = "low" | "medium" | "high";
export type WatermarkPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";
export type LayoutPreset = "grid" | "fan" | "cascade" | "masonry" | "stack";

/** Formats offered by the export dialog (raster, vector, video, batch zip). */
export type ExportFormat = "png" | "webp" | "svg" | "html" | "mp4" | "webm" | "gif" | "webpAnim" | "pdf" | "zip";

/** A named snapshot of export-dialog settings (format + scale/size), stored
 *  outside the scene in localStorage so it survives reloads and projects. */
export interface ExportPreset {
  id: string;
  label: string;
  format: ExportFormat;
  scale: 1 | 2 | 4;
  /** Absolute pixel size; null when the preset uses the scale control. */
  customSize: ExportSize | null;
}

/** Absolute pixel dimensions for a custom-size export. When set, it overrides
 *  the 1×/2×/4× scale control for raster formats (PNG, WebP, MP4, WebM). */
export interface ExportSize {
  width: number;
  height: number;
}

/** Orientation of a device frame instance. "landscape" rotates a portrait
 *  skin (phone lying sideways) 90° clockwise; the frame box swaps its
 *  aspect ratio while the skin and media inside rotate together. */
export type FrameOrientation = "portrait" | "landscape";

/** One device frame instance in a multi-frame scene. When frameInstances exists,
 *  it takes precedence over scene.frame (which becomes legacy/single-frame mode). */
export interface FrameInstance {
  id: string;
  /** Device frame type. */
  frame: MockupFrame;
  /** Position as fraction of canvas (0..1). For a grid: x = (i / (n-1)) for n items. */
  x: number;
  y: number;
  /** Size multiplier relative to the base frame (0.5 = half size, 1 = default, 2 = double). */
  scale: number;
  /** Optional layer to render inside this frame; if omitted, uses active layer. */
  layerId: string | null;
  /** Portrait (default) or rotated 90° landscape. Absent = portrait. */
  orientation?: FrameOrientation;
}

/** A user-uploaded SVG device skin. Rendered as an overlay frame whose
 *  transparent screen area is expressed as a cutout in viewBox units. */
export interface CustomFrame {
  /** Stable id for this custom frame. */
  id: string;
  /** data: URL of the uploaded SVG skin. */
  asset: string;
  /** Display name (source filename). */
  name: string;
  /** The SVG's viewBox size, used to map cutout coordinates to frame
   *  percentages at any rendered size. */
  viewBox: { w: number; h: number };
  /** Transparent screen cutout in viewBox units. */
  cutout: { x: number; y: number; w: number; h: number; rx: number };
}

/** A single media item stacked inside the mockup frame. Each layer owns its
 *  own transform, animation and (for video) playback/trim settings. */
export interface MediaLayer {
  id: string;
  mediaUrl: string | null;
  mediaType: MediaType;
  mediaName: string | null;
  /** When true the layer is omitted from the preview and export. */
  hidden: boolean;
  /** Base scale of this layer (frame-wide zoom is applied on top in preview). */
  zoom: number;
  /** Media pan inside the frame, as a fraction of half the frame size. Range [-1, 1]. */
  mediaOffsetX: number;
  mediaOffsetY: number;
  /** How the media fills the frame: cover (fill/crop) or contain (fit/letterbox). */
  mediaFit: "cover" | "contain";
  /** Rotation of the media inside the frame, in degrees (clockwise). */
  rotation?: number;
  /** Brightness of the media in percent, 0–200 (100 = unchanged). Absent
   *  means unchanged, matching `buildLayerFilterCss` neutral defaults. */
  brightness?: number;
  /** Contrast of the media in percent, 0–200 (100 = unchanged). */
  contrast?: number;
  /** Saturation of the media in percent, 0–200 (100 = unchanged). */
  saturate?: number;
  /** Gaussian blur applied to the media, in px, 0–20 (0 = sharp). */
  blur?: number;
  /** Grayscale amount in percent, 0–100 (0 = full color). */
  grayscale?: number;
  /** Opacity of the media inside the frame, percent 0–100 (100 = opaque).
   *  Applies to the media only — bezel, chrome and glare stay unaffected. */
  opacity?: number;
  /** When true the layer rejects edits (media swap, transforms, filters,
   *  removal). Visibility toggle and duplication stay available. */
  locked?: boolean;
  animationPreset: AnimationPreset;
  /** Easing curve between animation keyframes (default "easeInOut"). */
  animationEasing?: AnimationEasing;
  videoMuted: boolean;
  videoLoop: boolean;
  videoAutoplay: boolean;
  videoPosterTime: number;
  videoDuration: number;
  videoTrimStart: number;
  videoTrimEnd: number;
  videoQuality: VideoQuality;
  /** Playback speed of the layer's video, 0.5–2 (1 = native). Affects the
   *  live preview, the recorded export length and the HTML embed. */
  playbackSpeed?: number;
}

export interface EditorScene {
  layers: MediaLayer[];
  /** The layer targeted by scene-level zoom/position/video controls. */
  activeLayerId: string | null;
  frame: MockupFrame;
  /** Multiple device frames in a grid. When present, overrides scene.frame (single-frame mode). */
  frameInstances: FrameInstance[];
  /** User-uploaded SVG device skin used when frame === "custom". */
  customFrame: CustomFrame | null;
  stylePreset: StylePreset;
  shadowOpacity: number;
  borderRadius: number;
  /** 3D tilt of the mockup around the vertical axis (left/right), degrees in [-25, 25]. */
  tiltX: number;
  /** 3D tilt of the mockup around the horizontal axis (up/down), degrees in [-25, 25]. */
  tiltY: number;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  /** Middle stop for 3-stop gradients; optional. */
  gradientVia: string | null;
  /** Gradient type: linear (angle-driven) or radial (center-driven). */
  gradientType: GradientType;
  gradientAngle: number;
  /** Pattern preset id when backgroundMode is "pattern". */
  patternId: PatternId | null;
  /** data: URL of an uploaded background image, or null when none. */
  backgroundImageUrl: string | null;
  /** Blur radius (px) applied to the background image. Range [0, 40]. */
  backgroundBlur: number;
  /** data: URL of an uploaded background audio track, or null when none. */
  backgroundAudioUrl: string | null;
  /** Original filename of the background audio, for display. */
  backgroundAudioName: string | null;
  /** Linear fade-in applied to the background audio at export start, seconds 0–10. */
  audioFadeIn: number;
  /** Linear fade-out applied to the background audio at export end, seconds 0–10. */
  audioFadeOut: number;
  watermarkText: string;
  watermarkEnabled: boolean;
  watermarkPosition: WatermarkPosition;
  watermarkSize: number;
  /** data: URL of an uploaded logo watermark, or null. When set, renderers
   *  draw the image instead of the text watermark (height = watermarkSize). */
  watermarkImageUrl: string | null;
  aspectRatio: string;
  /** Length of one animation loop (preview, video, HTML), in ms. */
  animationDurationMs: number;
  /** Screen decoration (status bar, lock/home chrome) drawn over the media. */
  screen: ScreenChrome;
  /** Subtle diagonal light sweep over the screen media (shots.so-style). */
  screenGlare: boolean;
  /** Mirrored, fading copy of the device below its bottom edge. */
  floorReflection: boolean;
  /** URL shown in the browser frame's address bar (frame "browser"). */
  browserUrl: string;
  /** Non-media overlays (text, arrows, rectangles) drawn above the mockup. */
  annotations: Annotation[];
}

/** A named set of scene-appearance settings (frame, frame style, background,
 *  shadow, watermark). Intentionally excludes media layers so applying a
 *  preset restyles the mockup without discarding the user's uploaded media. */
export interface SceneStylePreset {
  id: string;
  frame: MockupFrame;
  stylePreset: StylePreset;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  /** Middle stop for 3-stop gradients. */
  gradientVia: string | null;
  /** Gradient type: linear (angle-driven) or radial (center-driven). */
  gradientType: GradientType;
  shadowOpacity: number;
  borderRadius: number;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkPosition: WatermarkPosition;
  watermarkSize: number;
}

/** A self-contained editor project: a named scene plus bookkeeping. Projects
 *  live in localStorage and can be exported/imported as JSON files. */
export interface Project {
  id: string;
  name: string;
  scene: EditorScene;
  /** Epoch ms of the last edit, used for the "updated" label and sorting. */
  updatedAt: number;
  /** When set, the project is in the trash (soft-deleted). */
  deletedAt?: number;
}

/** A searchable command shown in the command palette. */
export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  keywords: string[];
  category: string;
  action: () => void;
  disabled?: boolean;
}

