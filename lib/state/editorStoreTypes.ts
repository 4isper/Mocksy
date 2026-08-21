import type { StoreApi } from "zustand";
import type {
  Annotation,
  AnnotationType,
  AnimationEasing,
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
  /** Ids of all currently-selected annotations for multi-select align/
   *  distribute. Kept out of `scene` for the same reason as `selectedLayerIds`. */
  selectedAnnotationIds: string[];
  /** Id of the layer currently selected for editing. Kept out of `scene` so
   *  selecting a layer doesn't re-create the scene object (re-rendering the
   *  whole preview tree) or churn undo history. `scene.activeLayerId` stays as
   *  the persisted snapshot carried by stored scenes and share URLs. */
  activeLayerId: string | null;
  /** Id of the frame instance currently selected for editing/nudging; kept out
   *  of `scene` so selecting doesn't churn undo history or serialize into share
   *  URLs. */
  activeFrameInstanceId: string | null;
  /** Ids of all currently-selected layers for multi-select bulk operations.
   *  Kept out of `scene` for the same reason as `activeLayerId`. */
  selectedLayerIds: string[];
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
  /** True while the AI background removal runs on the active layer (the
   *  first run also downloads the wasm/model assets). Kept out of `scene`. */
  isRemovingBackground: boolean;
  /** Shared upload/validation error surfaced in a single place (the preview
   *  overlay), regardless of whether the failure came from a drag-drop on the
   *  canvas, the media section file input, or a paste. Null when no error. */
  mediaUploadError: string | null;
  /** Dominant-color palette of the active layer's media, used to suggest a
   *  matching background. Kept out of `scene` so it doesn't churn history or
   *  get serialized into share URLs. Null until media has been analyzed. */
  scenePalette: string[] | null;
  setScene: (scene: Partial<EditorScene>, recordHistory?: boolean) => void;
  setMediaLoading: (loading: boolean) => void;
  /** Toggles the background-removal-in-progress flag. */
  setRemovingBackground: (loading: boolean) => void;
  /** Sets/clears the shared media upload error. */
  setMediaUploadError: (msg: string | null) => void;
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
  /** Replaces media on a specific layer id (used by the multi-frame preview,
   *  where the visible frame isn't necessarily the globally-active layer). */
  setMediaOnLayer: (layerId: string, mediaUrl: string | null, mediaType: MediaType, mediaName?: string | null) => void;
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
  /** Sets the full multi-select set (replacing the active layer). `ids` empty
   *  clears the selection to just nothing. The first id becomes active. */
  selectLayers: (ids: string[]) => void;
  /** Toggles a single layer's membership in the current multi-selection without
   *  discarding the rest; the toggled layer also becomes the active layer. */
  toggleLayerSelected: (id: string) => void;
  /** Selects a contiguous range from the current anchor (last selected) to `id`,
   *  preserving additive behaviour when `additive` is set. */
  selectLayerRange: (id: string, additive?: boolean) => void;
  /** Clones every layer in `ids` (order preserved), appending them on top. */
  duplicateLayers: (ids: string[]) => void;
  /** Toggles visibility for every layer in `ids`. */
  toggleLayersHidden: (ids: string[]) => void;
  /** Removes every layer in `ids`; keeps at least one layer in the scene and
   *  keeps the selection/active id valid afterwards. */
  removeLayers: (ids: string[]) => void;
  /** Reorders layers. Pass `coalesce: true` for continuous gestures (drag) so
   *  all intermediate steps collapse into a single undo entry. */
  reorderLayers: (orderedIds: string[], coalesce?: boolean) => void;
  updateActiveLayer: (patch: Partial<MediaLayer>) => void;
  /** Renames a layer's display label (its `mediaName`). */
  renameLayer: (id: string, name: string) => void;
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
  setAnimationEasing: (animationEasing: AnimationEasing) => void;
  setAnimationDuration: (durationMs: number) => void;
  setZoom: (zoom: number) => void;
  setMediaOffsetX: (offset: number) => void;
  setMediaOffsetY: (offset: number) => void;
  setRotation: (rotation: number) => void;
  setMediaFit: (fit: "cover" | "contain") => void;
  setBrightness: (brightness: number) => void;
  setContrast: (contrast: number) => void;
  setSaturate: (saturate: number) => void;
  setBlur: (blur: number) => void;
  setGrayscale: (grayscale: number) => void;
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
  /** Patches the on-screen decoration (status bar / lock / home chrome). */
  setScreenChrome: (patch: Partial<import("@/lib/types/editor").ScreenChrome>) => void;
  /** Sets the URL shown in the browser frame's address bar. */
  setBrowserUrl: (url: string) => void;
  setAspectRatio: (aspectRatio: string) => void;
  addAnnotation: (type: AnnotationType) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  /** Applies a set of per-id patches (e.g. from align/distribute) to many
   *  annotations in one undo step. */
  applyAnnotationPatches: (patches: Record<string, Partial<Annotation>>) => void;
  removeAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null, additive?: boolean) => void;
  selectAnnotations: (ids: string[]) => void;
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
