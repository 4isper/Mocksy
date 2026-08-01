export type BackgroundMode = "transparent" | "solid" | "gradient" | "image";

export type AnnotationType = "text" | "arrow" | "rect";

/** A non-media overlay drawn on top of the mockup (text, arrow, rectangle).
 *  Position and size are fractions (0..1) of the canvas so they scale with the
 *  preview and the exported PNG/video at any pixel ratio. For arrows, (x, y) is
 *  the start point and (x + w, y + h) the end, so negative w/h flip direction. */
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
}
export type MockupFrame = "none" | "iphone" | "iphone15" | "iphone16pro" | "pixel8pro" | "galaxy24" | "ipad" | "desktop" | "tablet" | "macbook" | "imac" | "watch";
export type StylePreset = "default" | "glassLight" | "glassDark" | "outline";
export type AnimationPreset = "none" | "zoomIn" | "zoomOut" | "parallax";
export type MediaType = "none" | "image" | "video";
export type VideoQuality = "low" | "medium" | "high";
export type WatermarkPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

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
  animationPreset: AnimationPreset;
  videoMuted: boolean;
  videoLoop: boolean;
  videoAutoplay: boolean;
  videoPosterTime: number;
  videoDuration: number;
  videoTrimStart: number;
  videoTrimEnd: number;
  videoQuality: VideoQuality;
}

export interface EditorScene {
  layers: MediaLayer[];
  /** The layer targeted by scene-level zoom/position/video controls. */
  activeLayerId: string | null;
  frame: MockupFrame;
  /** Multiple device frames in a grid. When present, overrides scene.frame (single-frame mode). */
  frameInstances: FrameInstance[];
  stylePreset: StylePreset;
  shadowOpacity: number;
  borderRadius: number;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  /** data: URL of an uploaded background image, or null when none. */
  backgroundImageUrl: string | null;
  /** Blur radius (px) applied to the background image. Range [0, 40]. */
  backgroundBlur: number;
  /** data: URL of an uploaded background audio track, or null when none. */
  backgroundAudioUrl: string | null;
  /** Original filename of the background audio, for display. */
  backgroundAudioName: string | null;
  watermarkText: string;
  watermarkEnabled: boolean;
  watermarkPosition: WatermarkPosition;
  watermarkSize: number;
  aspectRatio: string;
  /** Length of one animation loop (preview, video, HTML), in ms. */
  animationDurationMs: number;
  /** Non-media overlays (text, arrows, rectangles) drawn above the mockup. */
  annotations: Annotation[];
}

/** A named set of scene-appearance settings (frame, frame style, background,
 *  shadow, watermark). Intentionally excludes media layers so applying a
 *  preset restyles the mockup without discarding the user's uploaded media. */
export interface SceneStylePreset {
  id: string;
  name: string;
  frame: MockupFrame;
  stylePreset: StylePreset;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
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
}

/** A searchable command shown in the command palette. */
export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  keywords: string[];
  action: () => void;
  disabled?: boolean;
}

