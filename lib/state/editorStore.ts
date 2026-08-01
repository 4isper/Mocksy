"use client";

import { create } from "zustand";
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
import { ASPECT_RATIOS } from "@/lib/render/frames";
import { DEFAULT_GRID_DIVISIONS } from "@/lib/render/grid";
import {
  activeLayer,
  activeOf,
  activePosterTime,
  buildAutoLayout,
  makeAnnotation,
  makeDemoLayer,
  nextLayerId,
  patchActive,
  pushHistory,
  layoutFrameGrid as layoutFrameGridHelper
} from "@/lib/state/editorHelpers";

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

export const initialScene: EditorScene = {
  layers: [makeDemoLayer()],
  activeLayerId: null,
  frame: "iphone",
  frameInstances: [],
  stylePreset: "default",
  shadowOpacity: 0.4,
  borderRadius: 20,
  backgroundMode: "gradient",
  backgroundColor: "#111827",
  gradientFrom: "#1d4ed8",
  gradientTo: "#7c3aed",
  gradientVia: null,
  gradientType: "linear",
  gradientAngle: 120,
  patternId: null,
  backgroundImageUrl: null,
  backgroundBlur: 0,
  backgroundAudioUrl: null,
  backgroundAudioName: null,
  annotations: [],
  watermarkText: "Mocksy",
  watermarkEnabled: false,
  watermarkPosition: "bottom-right",
  watermarkSize: 13,
  aspectRatio: ASPECT_RATIOS[0] ?? "16 / 9",
  animationDurationMs: 3000
};
// The first layer is the active one by default.
initialScene.activeLayerId = initialScene.layers[0]?.id ?? null;

/** A fresh scene seeded with the bundled demo media. Shared by the editor
 *  bootstrap and the projects store so both start from the same default.
 *  Defaults to a 2-frame horizontal grid so first-time visitors immediately
 *  see the multi-frame capability. */
export function makeDemoScene(): EditorScene {
  const count = 2;
      const instances = layoutFrameGridHelper("iphone", count, "horizontal");
  const layers = Array.from({ length: count }, () => ({
    ...makeDemoLayer(),
    id: nextLayerId()
  }));
  const instancesWithLayers = instances.map((inst, i) => ({
    ...inst,
    layerId: layers[i]?.id ?? null
  }));
  return {
    layers,
    activeLayerId: layers[0]?.id ?? null,
    frame: initialScene.frame,
    frameInstances: instancesWithLayers,
    stylePreset: initialScene.stylePreset,
    shadowOpacity: initialScene.shadowOpacity,
    borderRadius: initialScene.borderRadius,
    backgroundMode: initialScene.backgroundMode,
    backgroundColor: initialScene.backgroundColor,
    gradientFrom: initialScene.gradientFrom,
    gradientTo: initialScene.gradientTo,
    gradientAngle: initialScene.gradientAngle,
    watermarkText: initialScene.watermarkText,
    watermarkEnabled: initialScene.watermarkEnabled,
    watermarkPosition: initialScene.watermarkPosition,
    watermarkSize: initialScene.watermarkSize,
    aspectRatio: initialScene.aspectRatio,
    backgroundImageUrl: initialScene.backgroundImageUrl,
    backgroundBlur: initialScene.backgroundBlur,
    backgroundAudioUrl: null,
    backgroundAudioName: null,
    gradientVia: initialScene.gradientVia,
    gradientType: initialScene.gradientType,
    patternId: initialScene.patternId,
    animationDurationMs: initialScene.animationDurationMs,
    annotations: []
  };
}
export const useEditorStore = create<EditorStoreState>((set) => ({
  scene: initialScene,
  past: [],
  future: [],
  videoCurrentTime: 0,
  selectedAnnotationId: null,
  activeFrameInstanceId: null,
  lastHistoryKey: null,
  lastHistoryAt: 0,
  isMediaLoading: false,
  scenePalette: null,
  exportScale: 2,
  customExportSize: null,
  showGrid: false,
  gridDivisions: DEFAULT_GRID_DIVISIONS,
  setScene: (scene, recordHistory = true) =>
    set((s) => {
      const next = { ...s.scene, ...scene };
      if (!recordHistory) return { scene: next };
      return pushHistory(s, next);
    }),
  resetScene: () =>
    set((s) => {
      const count = 2;
  const instances = layoutFrameGridHelper("iphone", count, "horizontal");
      const layers = Array.from({ length: count }, () => ({
        ...makeDemoLayer(),
        id: nextLayerId()
      }));
      const instancesWithLayers = instances.map((inst, i) => ({
        ...inst,
        layerId: layers[i]?.id ?? null
      }));
      return pushHistory(s, {
        ...initialScene,
        layers,
        frameInstances: instancesWithLayers,
        activeLayerId: layers[0]?.id ?? null
      });
    }),
  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {};
      const previous = s.past[s.past.length - 1];
      // Playback position lives outside the scene, so re-sync it to the
      // restored scene's poster time instead of leaving the timeline slider
      // pointing at a moment that no longer matches the video.
      return { scene: previous, past: s.past.slice(0, -1), future: [s.scene, ...s.future], videoCurrentTime: activePosterTime(previous ?? s.scene) };
    }),
  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      return { scene: next, past: [...s.past, s.scene], future: s.future.slice(1), videoCurrentTime: activePosterTime(next ?? s.scene) };
    }),
  setMedia: (mediaUrl, mediaType, mediaName = null) =>
    set((s) => {
      const layer = activeLayer(s.scene);
      const nextLayers = layer
        ? s.scene.layers.map((l) =>
            l.id === layer.id
              ? {
                  ...l,
                  mediaUrl,
                  mediaType,
                  mediaName,
                  videoDuration: 0,
                  videoTrimStart: 0,
                  videoTrimEnd: 0
                }
              : l
          )
        : [{ ...makeDemoLayer(), mediaUrl, mediaType, mediaName }];
      const activeLayerId = layer?.id ?? nextLayers[0]?.id ?? null;
      return {
        ...pushHistory(s, { ...s.scene, layers: nextLayers, activeLayerId }),
        videoCurrentTime: 0,
        // A real upload decodes asynchronously; clear media stops loading.
        isMediaLoading: mediaUrl != null
      };
    }),
  addLayer: (mediaUrl, mediaType, mediaName = null) =>
    set((s) => {
      const newLayer: MediaLayer = {
        ...makeDemoLayer(),
        id: nextLayerId(),
        mediaUrl,
        mediaType,
        mediaName,
        animationPreset: "none"
      };
      const layers = [...s.scene.layers, newLayer];
      return {
        ...pushHistory(s, { ...s.scene, layers, activeLayerId: newLayer.id }),
        videoCurrentTime: 0,
        isMediaLoading: mediaUrl != null
      };
    }),
  duplicateLayer: (id) =>
    set((s) => {
      const source = s.scene.layers.find((l) => l.id === id);
      if (!source) return {};
      // Clone with a fresh id; the media URL is a self-contained data: URL,
      // so both layers keep rendering it independently (no shared blob: to revoke).
      const clone: MediaLayer = { ...source, id: nextLayerId() };
      const layers = [...s.scene.layers, clone];
      return {
        ...pushHistory(s, { ...s.scene, layers, activeLayerId: clone.id }),
        videoCurrentTime: 0,
        isMediaLoading: false
      };
    }),
  toggleLayerHidden: (id) =>
    set((s) => {
      const layers = s.scene.layers.map((l) => (l.id === id ? { ...l, hidden: !l.hidden } : l));
      return pushHistory(s, { ...s.scene, layers });
    }),
  removeLayer: (id) =>
    set((s) => {
      if (s.scene.layers.length <= 1) return {};
      const layers = s.scene.layers.filter((l) => l.id !== id);
      const activeLayerId = s.scene.activeLayerId === id ? layers[0]?.id ?? null : s.scene.activeLayerId;
      return pushHistory(s, { ...s.scene, layers, activeLayerId });
    }),
  selectLayer: (id) => set((s) => pushHistory(s, { ...s.scene, activeLayerId: id })),
  reorderLayers: (orderedIds, coalesce) =>
    set((s) => {
      const byId = new Map(s.scene.layers.map((l) => [l.id, l]));
      const layers = orderedIds.map((id) => byId.get(id)).filter((l): l is MediaLayer => Boolean(l));
      // Keep any layers not mentioned in the order (defensive).
      for (const l of s.scene.layers) if (!orderedIds.includes(l.id)) layers.push(l);
      const sameOrder = layers.every((l, i) => s.scene.layers[i]?.id === l.id);
      if (sameOrder) return {};
      return pushHistory(s, { ...s.scene, layers }, coalesce ? "layerOrder" : undefined);
    }),
  updateActiveLayer: (patch) =>
    set((s) => {
      const layer = activeLayer(s.scene);
      if (!layer) return {};
      const layers = s.scene.layers.map((l) => (l.id === layer.id ? { ...l, ...patch } : l));
      return pushHistory(s, { ...s.scene, layers }, Object.keys(patch).join(","));
    }),
  setMediaLoading: (loading) => set({ isMediaLoading: loading }),
  setScenePalette: (palette) => set({ scenePalette: palette }),
  setExportScale: (exportScale) => set({ exportScale }),
  setCustomExportSize: (customExportSize) => set({ customExportSize }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setGridDivisions: (gridDivisions) => set({ gridDivisions }),
  setFrame: (frame) =>
    set((s) => {
      const nextScene = { ...s.scene, frame };
      if (nextScene.frameInstances.length > 0) {
        nextScene.frameInstances = nextScene.frameInstances.map((inst) => ({ ...inst, frame }));
      }
      return pushHistory(s, nextScene);
    }),
  setFrameInstances: (instances: FrameInstance[]) => set((s) => pushHistory(s, { ...s.scene, frameInstances: instances })),
  removeFrameInstance: (id) =>
    set((s) => {
      const inst = s.scene.frameInstances.find((fi) => fi.id === id);
      if (!inst) return {};
      const remaining = s.scene.frameInstances.filter((fi) => fi.id !== id);
      const layers = inst.layerId && !remaining.some((fi) => fi.layerId === inst.layerId)
        ? s.scene.layers.filter((l) => l.id !== inst.layerId)
        : s.scene.layers;
      const activeLayerId = layers.some((l) => l.id === s.scene.activeLayerId)
        ? s.scene.activeLayerId
        : layers[0]?.id ?? null;
      return pushHistory(s, { ...s.scene, layers, frameInstances: remaining, activeLayerId });
    }),
  updateFrameInstance: (id, patch, coalesce) =>
    set((s) => {
      const frameInstances = s.scene.frameInstances.map((fi) =>
        fi.id === id ? { ...fi, ...patch } : fi
      );
      return pushHistory(s, { ...s.scene, frameInstances }, coalesce ? "frameInstanceDrag" : undefined);
    }),
  layoutFrameGrid: (frame: MockupFrame, count: number, direction: "horizontal" | "vertical") =>
    set((s) => {
      const instances = layoutFrameGridHelper(frame, count, direction);
      // Create new layers for each frame instance (clone from active layer)
      const activeLayerData = activeLayer(s.scene);
      const newLayers = instances.map((inst) => ({
        ...(activeLayerData ?? makeDemoLayer()),
        id: nextLayerId(),
        hidden: false,
        animationPreset: "none" as const
      }));
      const allLayers = [...s.scene.layers, ...newLayers];
      const layerIds = newLayers.map(l => l.id);
      const instancesWithLayers = instances.map((inst, i) => ({
        ...inst,
        layerId: layerIds[i] ?? null
      }));
      return pushHistory(s, {
        ...s.scene,
        layers: allLayers,
        frameInstances: instancesWithLayers,
        activeLayerId: layerIds[0] ?? s.scene.activeLayerId
      });
    }),
  applyFrameLayout: (frame: MockupFrame, count: number, layout: import("@/lib/types/editor").LayoutPreset) =>
    set((s) => {
      const instances = buildAutoLayout(frame, count, layout, s.scene.aspectRatio);
      const activeLayerData = activeLayer(s.scene);
      const newLayers = instances.map((inst) => ({
        ...(activeLayerData ?? makeDemoLayer()),
        id: nextLayerId(),
        hidden: false,
        animationPreset: "none" as const
      }));
      const allLayers = [...s.scene.layers, ...newLayers];
      const layerIds = newLayers.map(l => l.id);
      const instancesWithLayers = instances.map((inst, i) => ({
        ...inst,
        layerId: layerIds[i] ?? null
      }));
      return pushHistory(s, {
        ...s.scene,
        layers: allLayers,
        frameInstances: instancesWithLayers,
        activeLayerId: layerIds[0] ?? s.scene.activeLayerId
      });
    }),
  setStylePreset: (stylePreset) => set((s) => pushHistory(s, { ...s.scene, stylePreset })),
  setAnimationPreset: (animationPreset) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { animationPreset }) }, "animation")),
  setAnimationDuration: (animationDurationMs) => set((s) => pushHistory(s, { ...s.scene, animationDurationMs: Math.max(500, Math.min(20000, Math.round(animationDurationMs))) }, "animationDuration")),
  setZoom: (zoom) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { zoom }) }, "zoom")),
  setMediaOffsetX: (mediaOffsetX) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaOffsetX }) }, "mediaOffsetX")),
  setMediaOffsetY: (mediaOffsetY) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaOffsetY }) }, "mediaOffsetY")),
  setMediaFit: (mediaFit) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaFit }) }, "mediaFit")),
  setShadowOpacity: (shadowOpacity) => set((s) => pushHistory(s, { ...s.scene, shadowOpacity }, "shadow")),
  setBorderRadius: (borderRadius) => set((s) => pushHistory(s, { ...s.scene, borderRadius }, "radius")),
  setBackgroundSolid: (backgroundColor) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "solid", backgroundColor })),
  setBackgroundGradient: (gradientFrom, gradientTo, gradientAngle, gradientVia, gradientType) =>
    set((s) => pushHistory(s, {
      ...s.scene,
      backgroundMode: "gradient",
      gradientFrom,
      gradientTo,
      ...(gradientAngle !== undefined ? { gradientAngle } : {}),
      ...(gradientVia !== undefined ? { gradientVia } : {}),
      ...(gradientType !== undefined ? { gradientType } : {})
    })),
  setBackgroundTransparent: () => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "transparent" })),
  setBackgroundImage: (backgroundImageUrl) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "image", backgroundImageUrl })),
  setBackgroundPattern: (patternId) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "pattern", patternId })),
  setGradientType: (gradientType) => set((s) => pushHistory(s, { ...s.scene, gradientType })),
  setGradientVia: (gradientVia) => set((s) => pushHistory(s, { ...s.scene, gradientVia })),
  setBackgroundBlur: (backgroundBlur) => set((s) => pushHistory(s, { ...s.scene, backgroundBlur: Math.max(0, Math.min(40, Math.round(backgroundBlur))) }, "bgBlur")),
  toggleWatermark: (watermarkEnabled) => set((s) => pushHistory(s, { ...s.scene, watermarkEnabled })),
  setWatermarkText: (watermarkText) => set((s) => pushHistory(s, { ...s.scene, watermarkText })),
  setWatermarkPosition: (watermarkPosition) => set((s) => pushHistory(s, { ...s.scene, watermarkPosition })),
  setWatermarkSize: (watermarkSize) => set((s) => pushHistory(s, { ...s.scene, watermarkSize: Math.max(8, Math.min(64, Math.round(watermarkSize))) }, "watermarkSize")),
  setAspectRatio: (aspectRatio) => set((s) => pushHistory(s, { ...s.scene, aspectRatio })),
  addAnnotation: (type) =>
    set((s) => {
      const annotation = makeAnnotation(type);
      return {
        ...pushHistory(s, { ...s.scene, annotations: [...s.scene.annotations, annotation] }),
        selectedAnnotationId: annotation.id
      };
    }),
  updateAnnotation: (id, patch) =>
    set((s) =>
      pushHistory(
        s,
        {
          ...s.scene,
          annotations: s.scene.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a))
        },
        "annotation"
      )
    ),
  removeAnnotation: (id) =>
    set((s) => {
      const annotations = s.scene.annotations.filter((a) => a.id !== id);
      return {
        ...pushHistory(s, { ...s.scene, annotations }),
        selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId
      };
    }),
  selectAnnotation: (id) => set({ selectedAnnotationId: id }),
  selectFrameInstance: (id) => set({ activeFrameInstanceId: id }),
  clearAnnotations: () => set((s) => ({ ...pushHistory(s, { ...s.scene, annotations: [] }), selectedAnnotationId: null })),
  setVideoMuted: (videoMuted) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoMuted }) })),
  setVideoLoop: (videoLoop) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoLoop }) })),
  setVideoAutoplay: (videoAutoplay) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoAutoplay }) })),
  setVideoPosterTime: (videoPosterTime) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoPosterTime }) }, "poster")),
  setVideoDuration: (videoDuration, layerId) =>
    set((s) => {
      const targetId = layerId ?? s.scene.activeLayerId ?? s.scene.layers[0]?.id;
      return pushHistory(s, {
        ...s.scene,
        layers: s.scene.layers.map((l) =>
          l.id === targetId
            ? {
                ...l,
                videoDuration,
                videoTrimEnd: l.videoTrimEnd > 0 ? Math.min(l.videoTrimEnd, videoDuration) : videoDuration
              }
            : l
        )
      });
    }),
  setVideoCurrentTime: (videoCurrentTime) => set({ videoCurrentTime }),
  setVideoTrimStart: (videoTrimStart) =>
    set((s) =>
      pushHistory(s, {
        ...s.scene,
        layers: patchActive(s.scene, {
          videoTrimStart: Math.min(videoTrimStart, activeOf(s.scene)?.videoTrimEnd ?? videoTrimStart)
        })
      }, "trimStart")
    ),
  setVideoTrimEnd: (videoTrimEnd) =>
    set((s) =>
      pushHistory(s, {
        ...s.scene,
        layers: patchActive(s.scene, {
          // A zero (or negative) end means "not trimmed" — clamp to the full
          // duration so 0 never lingers in state as a confusing sentinel.
          videoTrimEnd: videoTrimEnd <= 0 ? (activeOf(s.scene)?.videoDuration ?? 0) : Math.max(videoTrimEnd, activeOf(s.scene)?.videoTrimStart ?? 0)
        })
      }, "trimEnd")
    ),
  setVideoQuality: (videoQuality) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoQuality }) })),
  setBackgroundAudio: (backgroundAudioUrl, backgroundAudioName) =>
    set((s) => pushHistory(s, { ...s.scene, backgroundAudioUrl, backgroundAudioName })),
  clearBackgroundAudio: () =>
    set((s) => pushHistory(s, { ...s.scene, backgroundAudioUrl: null, backgroundAudioName: null }))
}));
