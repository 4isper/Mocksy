import type { StoreApi } from "zustand";
import type {
  Annotation,
  AnnotationType,
  AnimationPreset,
  EditorScene,
  ExportSize,
  FrameInstance,
  MediaLayer,
  MediaType,
  MockupFrame,
  StylePreset,
  VideoQuality,
  WatermarkPosition
} from "@/lib/types/editor";

export interface EditorStoreState {
  scene: EditorScene;
  past: EditorScene[];
  future: EditorScene[];
  /** Playback scrubber position; kept out of scene so playback doesn't
   *  churn history or re-render scene subscribers every frame. */
  videoCurrentTime: number;
  /** Id of the annotation currently selected for editing; kept out of `scene`
   *  so selecting doesn't churn undo history or serialize into share URLs. */
  selectedAnnotationId: string | null;
  /** Id of the layer currently selected for editing. Kept out of `scene` so
   *  selecting a layer doesn't re-create the scene object (re-rendering the
   *  whole preview tree) or churn undo history. `scene.activeLayerId` stays as
   *  the persisted snapshot carried by stored scenes and share URLs. */
  activeLayerId: string | null;
  /** Id of the frame instance currently selected for editing/nudging; kept out
   *  of `scene` so selecting doesn't churn undo history or serialize into share
   *  URLs. */
  activeFrameInstanceId: string | null;
  /** Pixel multiplier used when exporting/copying PNG (1×/2×/4×). Kept out of
   *  `scene` so it doesn't churn undo history or serialize into share URLs. */
  exportScale: 1 | 2 | 4;
  /** Absolute export size in pixels. When set (width/height > 0) it overrides
   *  `exportScale` for raster formats. Kept out of `scene` for the same reason
   *  as `exportScale`. */
  customExportSize: ExportSize | null;
  /** Grid overlay on the preview canvas; kept out of `scene` so it doesn't
   *  churn undo history or serialize into share URLs. */
  showGrid: boolean;
  /** Number of grid lines on each axis while the overlay is visible. */
  gridDivisions: number;
  /** Groups rapid same-field edits (e.g. slider drags) into one undo step. */
  lastHistoryKey: string | null;
  lastHistoryAt: number;
  /** True while uploaded media is decoding (between setMedia and onLoad). */
  isMediaLoading: boolean;
  /** Dominant-color palette of the active layer's media, used to suggest a
   *  matching background. Kept out of `scene` so it doesn't churn history or
   *  get serialized into share URLs. Null until media has been analyzed. */
  scenePalette: string[] | null;
  setScene: (scene: Partial<EditorScene>, recordHistory?: boolean) => void;
  setMediaLoading: (loading: boolean) => void;
  setScenePalette: (palette: string[] | null) => void;
  setExportScale: (scale: 1 | 2 | 4) => void;
  setCustomExportSize: (size: ExportSize | null) => void;
  setShowGrid: (show: boolean) => void;
  setGridDivisions: (divisions: number) => void;
  resetScene: () => void;
  undo: () => void;
  redo: () => void;
  /** Replaces the active layer's media (or seeds the first layer). */
  setMedia: (mediaUrl: string | null, mediaType: MediaType, mediaName?: string | null) => void;
  addLayer: (mediaUrl: string, mediaType: MediaType, mediaName?: string | null) => void;
  /** Clones a layer (same media + per-layer settings) as a new top-of-stack
   *  layer with a fresh id. Shares the source's blob: URL, which the
   *  orphan-revocation logic keeps alive while either layer references it. */
  duplicateLayer: (id: string) => void;
  /** Toggles a layer's visibility (hidden layers are skipped by the preview
   *  and export, but remain in the scene and undo history). */
  toggleLayerHidden: (id: string) => void;
  removeLayer: (id: string) => void;
  selectLayer: (id: string) => void;
  /** Reorders layers. Pass `coalesce: true` for continuous gestures (drag) so
   *  all intermediate steps collapse into a single undo entry. */
  reorderLayers: (orderedIds: string[], coalesce?: boolean) => void;
  updateActiveLayer: (patch: Partial<MediaLayer>) => void;
  setFrame: (frame: MockupFrame) => void;
  /** Stores a user-uploaded SVG skin and selects it as the active frame; passing
   *  null removes it (and falls back to the default frame when "custom" is
   *  active). The skin travels inside `scene` so it persists/round-trips with
   *  the rest of the scene. */
  setCustomFrame: (customFrame: import("@/lib/types/editor").CustomFrame | null) => void;
  setFrameInstances: (instances: FrameInstance[]) => void;
  updateFrameInstance: (id: string, patch: Partial<FrameInstance>, coalesce?: boolean) => void;
  removeFrameInstance: (id: string) => void;
  layoutFrameGrid: (frame: MockupFrame, count: number, direction: "horizontal" | "vertical") => void;
  applyFrameLayout: (frame: MockupFrame, count: number, layout: import("@/lib/types/editor").LayoutPreset) => void;
  setStylePreset: (stylePreset: StylePreset) => void;
  setAnimationPreset: (animationPreset: AnimationPreset) => void;
  setAnimationDuration: (durationMs: number) => void;
  setZoom: (zoom: number) => void;
  setMediaOffsetX: (offset: number) => void;
  setMediaOffsetY: (offset: number) => void;
  setMediaFit: (fit: "cover" | "contain") => void;
  setShadowOpacity: (shadowOpacity: number) => void;
  setBorderRadius: (radius: number) => void;
  setTiltX: (tiltX: number) => void;
  setTiltY: (tiltY: number) => void;
  setBackgroundSolid: (color: string) => void;
  setBackgroundGradient: (from: string, to: string, angle?: number, gradientVia?: string, gradientType?: "linear" | "radial") => void;
  setBackgroundTransparent: () => void;
  setBackgroundImage: (url: string) => void;
  setBackgroundPattern: (patternId: import("@/lib/types/editor").PatternId) => void;
  setGradientType: (gradientType: "linear" | "radial") => void;
  setGradientVia: (gradientVia: string) => void;
  setBackgroundBlur: (blur: number) => void;
  toggleWatermark: (enabled: boolean) => void;
  setWatermarkText: (text: string) => void;
  setWatermarkPosition: (position: WatermarkPosition) => void;
  setWatermarkSize: (size: number) => void;
  setWatermarkImage: (url: string | null) => void;
  setAspectRatio: (aspectRatio: string) => void;
  addAnnotation: (type: AnnotationType) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  selectFrameInstance: (id: string | null) => void;
  clearAnnotations: () => void;
  setVideoMuted: (muted: boolean) => void;
  setVideoLoop: (loop: boolean) => void;
  setVideoAutoplay: (autoplay: boolean) => void;
  setVideoPosterTime: (time: number) => void;
  setVideoDuration: (time: number, layerId?: string) => void;
  setVideoCurrentTime: (time: number) => void;
  setVideoTrimStart: (time: number) => void;
  setVideoTrimEnd: (time: number) => void;
  setVideoQuality: (quality: VideoQuality) => void;
  setBackgroundAudio: (url: string, name: string) => void;
  clearBackgroundAudio: () => void;
}

/** The functional-update `set` that Zustand hands to slice factories. */
export type EditorStoreSetter = StoreApi<EditorStoreState>["setState"];
