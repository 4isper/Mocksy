export type BackgroundMode = "transparent" | "solid" | "gradient";
export type MockupFrame = "none" | "iphone" | "iphone15" | "iphone16pro" | "desktop" | "tablet" | "watch";
export type StylePreset = "default" | "glassLight" | "glassDark" | "outline";
export type AnimationPreset = "none" | "zoomIn" | "zoomOut" | "parallax";
export type MediaType = "none" | "image" | "video";
export type VideoQuality = "low" | "medium" | "high";
export type WatermarkPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

/** A single media item stacked inside the mockup frame. Each layer owns its
 *  own transform, animation and (for video) playback/trim settings. */
export interface MediaLayer {
  id: string;
  mediaUrl: string | null;
  mediaType: MediaType;
  mediaName: string | null;
  /** Base scale of this layer (frame-wide zoom is applied on top in preview). */
  zoom: number;
  /** Media pan inside the frame, as a fraction of half the frame size. Range [-1, 1]. */
  mediaOffsetX: number;
  mediaOffsetY: number;
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
  stylePreset: StylePreset;
  shadowOpacity: number;
  borderRadius: number;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  watermarkText: string;
  watermarkEnabled: boolean;
  watermarkPosition: WatermarkPosition;
  watermarkSize: number;
  aspectRatio: string;
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

