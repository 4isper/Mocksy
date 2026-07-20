export type BackgroundMode = "transparent" | "solid" | "gradient";
export type MockupFrame = "none" | "iphone" | "iphone15" | "iphone16pro" | "desktop" | "tablet" | "watch";
export type StylePreset = "default" | "glassLight" | "glassDark" | "outline";
export type AnimationPreset = "none" | "zoomIn" | "zoomOut" | "parallax";
export type MediaType = "none" | "image" | "video";
export type VideoQuality = "low" | "medium" | "high";

export interface EditorScene {
  mediaUrl: string | null;
  mediaType: MediaType;
  mediaName: string | null;
  frame: MockupFrame;
  stylePreset: StylePreset;
  animationPreset: AnimationPreset;
  zoom: number;
  shadowOpacity: number;
  borderRadius: number;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  watermarkText: string;
  watermarkEnabled: boolean;
  aspectRatio: string;
  videoMuted: boolean;
  videoLoop: boolean;
  videoAutoplay: boolean;
  videoPosterTime: number;
  videoDuration: number;
  videoTrimStart: number;
  videoTrimEnd: number;
  videoQuality: VideoQuality;
}
