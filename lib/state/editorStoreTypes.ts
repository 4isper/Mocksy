import type { StoreApi } from "zustand";
import type {
  Annotation,
  AnnotationType,
  AnimationEasing,
  AnimationPreset,
  EditorScene,
  EntranceAnimation,
  BlendMode,
  ExportSize,
  FrameInstance,
  LayerTransformPatch,
  MediaLayer,
  MediaType,
  MockupFrame,
  StylePreset,
  VideoQuality,
  WatermarkPosition
} from "@/lib/types/editor";

/** Tabs of the right-hand panel; shared so the command palette can jump to one. */
export type RightTabId = "templates" | "layers" | "annotations" | "history" | "projects";

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
  /** Ids of all currently-selected frame instances for multi-select align/
   *  distribute. Kept out of `scene` for the same reason as `activeLayerId`. */
  selectedFrameIds: string[];
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
  /** Preview zoom level: "fit" (default) or a scale multiplier (0.25–4).
   *  Pure view state — never persisted, never undone. Values >1 crop into
   *  the canvas from its center; <1 letterbox it inside the panel. */
  previewZoom: number | "fit";
  /** Preview pan offset in canvas pixels, applied to the zoom layer before
   *  scaling (so `screen = pan + scale·content` around the canvas center).
   *  Kept at {0,0} whenever the zoom is "fit". Pure view state like
   *  `previewZoom` — never persisted, never undone. */
  previewPan: { x: number; y: number };
  /** Full-screen preview mode: side panels and toolbar are hidden so the
   *  mockup fills the editor. Pure view state — never persisted or undone. */
  fullscreenPreview: boolean;
  /** First-run onboarding tour visibility. Pure view state — the "already
   *  seen" flag lives in localStorage, not in persisted scene state. */
  onboardingOpen: boolean;
  /** Active tab of the right-hand panel (templates/layers/annotations/history/
   *  projects). Shared so the command palette can jump straight to a tab. Pure
   *  view state — never persisted or undone. */
  rightTab: RightTabId;
  /** Mobile bottom-sheet navigation: which side panel is currently open as a
   *  bottom sheet over the preview (null = preview only). Only meaningful at
   *  the <=980px breakpoint, where the tab bar replaces the side-by-side
   *  panels. Pure view state — never persisted or undone. */
  mobileSheet: "controls" | "right" | null;
  /** Groups rapid same-field edits (e.g. slider drags) into one undo step. */
  lastHistoryKey: string | null;
  lastHistoryAt: number;
  /** True while uploaded media is decoding (between setMedia and onLoad). */
  isMediaLoading: boolean;
  /** Id of the layer whose media is loading, or null. Lets visibility/
   *  removal changes orphan the loader element and clear the stuck spinner. */
  mediaLoadingLayerId: string | null;
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
  /** Sets the preview zoom level ("fit" or 0.25–4). */
  setPreviewZoom: (zoom: number | "fit") => void;
  /** Sets the preview pan offset (canvas pixels, zoom-layer space). */
  setPreviewPan: (pan: { x: number; y: number }) => void;
  /** Resets the preview view to its default: fit zoom, centered content. */
  resetPreviewView: () => void;
  /** Enters/exits the full-screen preview mode. */
  setFullscreenPreview: (on: boolean) => void;
  /** Opens/closes the onboarding tour. */
  setOnboardingOpen: (open: boolean) => void;
  /** Switches the active right-panel tab (templates/layers/annotations/…). */
  setRightTab: (tab: RightTabId) => void;
  /** Opens/closes the mobile bottom sheets (null closes any open sheet). */
  setMobileSheet: (sheet: "controls" | "right" | null) => void;
  resetScene: () => void;
  undo: () => void;
  redo: () => void;
  /** Drops the entire undo/redo history. Used when the editor's scene is
   *  replaced wholesale by a non-edit (project switch/import) — the stacks
   *  belong to the replaced session and must not leak across projects. */
  clearHistory: () => void;
  /** Jumps to an absolute position in the undo timeline. `index` 0 is the
   *  oldest entry; `past.length` is the current scene (a no-op). Entries after
   *  the target become the redo stack. */
  jumpToHistory: (index: number) => void;
  /** Replaces the active layer's media (or seeds the first layer). */
  setMedia: (mediaUrl: string | null, mediaType: MediaType, mediaName?: string | null, targetLayerId?: string | null) => void;
  /** Replaces media on a specific layer id (used by the multi-frame preview,
   *  where the visible frame isn't necessarily the globally-active layer). */
  setMediaOnLayer: (layerId: string, mediaUrl: string | null, mediaType: MediaType, mediaName?: string | null) => void;
  addLayer: (mediaUrl: string, mediaType: MediaType, mediaName?: string | null) => void;
  /** Appends a new text layer (kind "text") with the given initial content
   *  and selects it. Styled via the text controls; renders inside the frame's
 *  screen like a media layer. */
  addTextLayer: (textContent: string) => void;
  /** Clones a layer (same media + per-layer settings) as a new top-of-stack
   *  layer with a fresh id. Shares the source's blob: URL, which the
   *  orphan-revocation logic keeps alive while either layer references it. */
  duplicateLayer: (id: string) => void;
  /** Toggles a layer's visibility (hidden layers are skipped by the preview
   *  and export, but remain in the scene and undo history). */
  toggleLayerHidden: (id: string) => void;
  /** Toggles the edit lock for every layer in `ids`. Locked layers reject
   *  content edits and removal; visibility/duplication stay available. */
  toggleLayersLocked: (ids: string[]) => void;
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
  /** Applies an absolute transform (zoom/offset/rotation/opacity/filters) to
   *  every layer in `ids` at once; locked layers are skipped. */
  transformLayers: (ids: string[], patch: LayerTransformPatch) => void;
  /** Nudges the position of every layer in `ids` by a relative offset. */
  nudgeLayers: (ids: string[], dx: number, dy: number) => void;
  /** Reorders layers. Pass `coalesce: true` for continuous gestures (drag) so
   *  all intermediate steps collapse into a single undo entry. */
  reorderLayers: (orderedIds: string[], coalesce?: boolean) => void;
  updateActiveLayer: (patch: Partial<MediaLayer>) => void;
  /** Renames a layer's display label (its `mediaName`). */
  renameLayer: (id: string, name: string) => void;
  /** Groups the given layers under a new shared groupId. Requires 2+ ids. */
  groupLayers: (ids: string[], name?: string) => void;
  /** Removes groupId from the given layers, dissolving the group. */
  ungroupLayers: (ids: string[]) => void;
  /** Renames a group (stored on the first layer's mediaName). */
  renameGroup: (groupId: string | null, name: string) => void;
  /** Toggles visibility for all layers in a group. */
  toggleGroupHidden: (groupId: string | null) => void;
  /** Toggles locked state for all layers in a group. */
  toggleGroupLocked: (groupId: string | null) => void;
  setFrame: (frame: MockupFrame) => void;
  /** Stores a user-uploaded SVG skin and selects it as the active frame; passing
   *  null removes it (and falls back to the default frame when "custom" is
   *  active). The skin travels inside `scene` so it persists/round-trips with
   *  the rest of the scene. */
  setCustomFrame: (customFrame: import("@/lib/types/editor").CustomFrame | null) => void;
  setFrameInstances: (instances: FrameInstance[]) => void;
  updateFrameInstance: (id: string, patch: Partial<FrameInstance>, coalesce?: boolean) => void;
  /** Appends a new frame instance cloned from the active one (or the default
   *  scene frame when none exist yet), so the user can incrementally add
   *  devices instead of only via grid/layout presets or right-click duplicate. */
  addFrameInstance: () => void;
  removeFrameInstance: (id: string) => void;
  /** Clones a frame instance (and its layer) slightly offset from the original. */
  duplicateFrameInstance: (id: string) => void;
  /** Moves a frame instance to the top ("front") or bottom ("back") of the
   *  render order — later instances draw on top. */
  reorderFrameInstance: (id: string, to: "front" | "back") => void;
  /** Reorders frame instances to match the given id order (used by drag-and-drop
   *  in the frame list). Unknown/missing ids are ignored; every existing id must
   *  appear exactly once in `orderedIds`. */
  reorderFrameInstances: (orderedIds: string[]) => void;
  layoutFrameGrid: (frame: MockupFrame, count: number, direction: "horizontal" | "vertical") => void;
  applyFrameLayout: (frame: MockupFrame, count: number, layout: import("@/lib/types/editor").LayoutPreset) => void;
  /** Aligns all frame instances to a shared edge/center (one undo step). */
  alignFrameInstances: (mode: import("@/lib/state/frameAlign").FrameAlignMode) => void;
  /** Distributes frame instances with equal gaps along an axis (needs ≥3). */
  distributeFrameInstances: (axis: "horizontal" | "vertical") => void;
  setStylePreset: (stylePreset: StylePreset) => void;
  setAnimationPreset: (animationPreset: AnimationPreset) => void;
  setAnimationEasing: (animationEasing: AnimationEasing) => void;
  setAnimationDuration: (durationMs: number) => void;
  setEntranceAnimation: (entranceAnimation: EntranceAnimation) => void;
  setEntranceDuration: (entranceDuration: number) => void;
  setBlendMode: (blendMode: BlendMode) => void;
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
  setOpacity: (opacity: number) => void;
  setShadowOpacity: (shadowOpacity: number) => void;
  setBorderRadius: (radius: number) => void;
  setTiltX: (tiltX: number) => void;
  setTiltY: (tiltY: number) => void;
  setBackgroundSolid: (color: string, coalesce?: boolean) => void;
  /** `gradientVia` accepts an explicit `null` to clear the middle stop;
   *  `undefined` leaves the current value untouched. */
  setBackgroundGradient: (from: string, to: string, angle?: number, gradientVia?: string | null, gradientType?: "linear" | "radial", coalesce?: boolean) => void;
  setBackgroundTransparent: () => void;
  setBackgroundImage: (url: string) => void;
  setBackgroundPattern: (patternId: import("@/lib/types/editor").PatternId) => void;
  setGradientType: (gradientType: "linear" | "radial") => void;
  /** `null` clears the middle stop so a two-stop gradient is restored. */
  setGradientVia: (gradientVia: string | null, coalesce?: boolean) => void;
  setBackgroundBlur: (blur: number) => void;
  toggleWatermark: (enabled: boolean) => void;
  setWatermarkText: (text: string) => void;
  setWatermarkPosition: (position: WatermarkPosition) => void;
  setWatermarkSize: (size: number) => void;
  setWatermarkImage: (url: string | null) => void;
  /** Patches the on-screen decoration (status bar / lock / home chrome). */
  setScreenChrome: (patch: Partial<import("@/lib/types/editor").ScreenChrome>) => void;
  /** Patches the screen chrome of one frame instance (independent per device). */
  setFrameInstanceScreen: (id: string, patch: Partial<import("@/lib/types/editor").ScreenChrome>) => void;
  /** Patches the floor reflection of one frame instance (independent per device). */
  setFrameInstanceFloorReflection: (id: string, on: boolean) => void;
  /** Removes a frame instance's screen + floor-reflection overrides. */
  clearFrameInstanceOverrides: (id: string) => void;
  /** Copies a device's effective screen chrome and floor reflection to the scene defaults and clears all overrides. */
  applyInstanceToAll: (id: string) => void;
  /** Toggles the screen-glare light sweep. */
  setScreenGlare: (on: boolean) => void;
  /** Toggles the floor reflection under the device. */
  setFloorReflection: (on: boolean) => void;
  /** Sets the URL shown in the browser frame's address bar. */
  setBrowserUrl: (url: string) => void;
  setBrowserChromeTheme: (theme: "light" | "dark") => void;
  setAspectRatio: (aspectRatio: string) => void;
  /** Sets the device body material/finish for the single-frame device, or the
   *  selected frame instance (bulk-applies to all instances when none selected). */
  setFrameMaterial: (material: import("@/lib/types/editor").FrameMaterial) => void;
  addAnnotation: (type: AnnotationType) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  /** Clones an annotation slightly offset from the original and selects it. */
  duplicateAnnotation: (id: string) => void;
  /** Moves an annotation to the top ("front") or bottom ("back") of the
   *  render order — later annotations draw on top. */
  reorderAnnotation: (id: string, to: "front" | "back") => void;
  /** Applies a set of per-id patches (e.g. from align/distribute) to many
   *  annotations in one undo step. */
  applyAnnotationPatches: (patches: Record<string, Partial<Annotation>>) => void;
  removeAnnotation: (id: string) => void;
  /** Removes many annotations in a single undo step (multi-select delete). */
  removeAnnotations: (ids: string[]) => void;
  selectAnnotation: (id: string | null, additive?: boolean) => void;
  selectAnnotations: (ids: string[]) => void;
  selectFrameInstance: (id: string | null) => void;
  selectFrameIds: (ids: string[]) => void;
  toggleFrameSelected: (id: string) => void;
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
  /** Sets the active layer's video playback speed (clamped to 0.5–2). */
  setPlaybackSpeed: (speed: number) => void;
  setBackgroundAudio: (url: string, name: string) => void;
  clearBackgroundAudio: () => void;
  /** Sets the background audio fade-in length, seconds (clamped 0–10). */
  setAudioFadeIn: (seconds: number) => void;
  /** Sets the background audio fade-out length, seconds (clamped 0–10). */
  setAudioFadeOut: (seconds: number) => void;
}

/** The functional-update `set` that Zustand hands to slice factories. */
export type EditorStoreSetter = StoreApi<EditorStoreState>["setState"];
