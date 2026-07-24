"use client";

import { create } from "zustand";
import type {
  Annotation,
  AnnotationType,
  AnimationPreset,
  EditorScene,
  MediaLayer,
  MediaType,
  MockupFrame,
  StylePreset,
  VideoQuality,
  WatermarkPosition
} from "@/lib/types/editor";
import { ASPECT_RATIOS } from "@/lib/render/frames";
import {
  activeLayer,
  activeOf,
  activePosterTime,
  makeAnnotation,
  makeDemoLayer,
  nextLayerId,
  patchActive,
  pushHistory
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
  /** Pixel multiplier used when exporting/copying PNG (1×/2×/4×). Kept out of
   *  `scene` so it doesn't churn undo history or serialize into share URLs. */
  exportScale: 1 | 2 | 4;
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
  reorderLayers: (orderedIds: string[]) => void;
  updateActiveLayer: (patch: Partial<MediaLayer>) => void;
  setFrame: (frame: MockupFrame) => void;
  setStylePreset: (stylePreset: StylePreset) => void;
  setAnimationPreset: (animationPreset: AnimationPreset) => void;
  setZoom: (zoom: number) => void;
  setMediaOffsetX: (offset: number) => void;
  setMediaOffsetY: (offset: number) => void;
  setMediaFit: (fit: "cover" | "contain") => void;
  setShadowOpacity: (shadowOpacity: number) => void;
  setBorderRadius: (radius: number) => void;
  setBackgroundSolid: (color: string) => void;
  setBackgroundGradient: (from: string, to: string) => void;
  setBackgroundTransparent: () => void;
  setBackgroundImage: (url: string) => void;
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
  clearAnnotations: () => void;
  setVideoMuted: (muted: boolean) => void;
  setVideoLoop: (loop: boolean) => void;
  setVideoAutoplay: (autoplay: boolean) => void;
  setVideoPosterTime: (time: number) => void;
  setVideoDuration: (time: number) => void;
  setVideoCurrentTime: (time: number) => void;
  setVideoTrimStart: (time: number) => void;
  setVideoTrimEnd: (time: number) => void;
  setVideoQuality: (quality: VideoQuality) => void;
}

export const initialScene: EditorScene = {
  layers: [makeDemoLayer()],
  activeLayerId: null,
  frame: "iphone",
  stylePreset: "default",
  shadowOpacity: 0.4,
  borderRadius: 20,
  backgroundMode: "gradient",
  backgroundColor: "#111827",
  gradientFrom: "#1d4ed8",
  gradientTo: "#7c3aed",
  backgroundImageUrl: null,
  backgroundBlur: 0,
  annotations: [],
  watermarkText: "Mocksy",
  watermarkEnabled: false,
  watermarkPosition: "bottom-right",
  watermarkSize: 13,
  aspectRatio: ASPECT_RATIOS[0] ?? "16 / 9"
};
// The first layer is the active one by default.
initialScene.activeLayerId = initialScene.layers[0]?.id ?? null;

/** A fresh scene seeded with the bundled demo media. Shared by the editor
 *  bootstrap and the projects store so both start from the same default. */
export function makeDemoScene(): EditorScene {
  const layers = [makeDemoLayer()];
  return {
    layers,
    activeLayerId: layers[0]?.id ?? null,
    frame: initialScene.frame,
    stylePreset: initialScene.stylePreset,
    shadowOpacity: initialScene.shadowOpacity,
    borderRadius: initialScene.borderRadius,
    backgroundMode: initialScene.backgroundMode,
    backgroundColor: initialScene.backgroundColor,
    gradientFrom: initialScene.gradientFrom,
    gradientTo: initialScene.gradientTo,
    watermarkText: initialScene.watermarkText,
    watermarkEnabled: initialScene.watermarkEnabled,
    watermarkPosition: initialScene.watermarkPosition,
    watermarkSize: initialScene.watermarkSize,
    aspectRatio: initialScene.aspectRatio,
    backgroundImageUrl: initialScene.backgroundImageUrl,
    backgroundBlur: initialScene.backgroundBlur,
    annotations: []
  };
}

export const useEditorStore = create<EditorStoreState>((set) => ({
  scene: initialScene,
  past: [],
  future: [],
  videoCurrentTime: 0,
  selectedAnnotationId: null,
  lastHistoryKey: null,
  lastHistoryAt: 0,
  isMediaLoading: false,
  scenePalette: null,
  exportScale: 2,
  setScene: (scene, recordHistory = true) =>
    set((s) => {
      const next = { ...s.scene, ...scene };
      if (!recordHistory) return { scene: next };
      return pushHistory(s, next);
    }),
  resetScene: () =>
    set((s) =>
      pushHistory(s, {
        ...initialScene,
        layers: [makeDemoLayer()]
      })
    ),
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
  selectLayer: (id) => set((s) => ({ scene: { ...s.scene, activeLayerId: id } })),
  reorderLayers: (orderedIds) =>
    set((s) => {
      const byId = new Map(s.scene.layers.map((l) => [l.id, l]));
      const layers = orderedIds.map((id) => byId.get(id)).filter((l): l is MediaLayer => Boolean(l));
      // Keep any layers not mentioned in the order (defensive).
      for (const l of s.scene.layers) if (!orderedIds.includes(l.id)) layers.push(l);
      return pushHistory(s, { ...s.scene, layers });
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
  setFrame: (frame) => set((s) => pushHistory(s, { ...s.scene, frame })),
  setStylePreset: (stylePreset) => set((s) => pushHistory(s, { ...s.scene, stylePreset })),
  setAnimationPreset: (animationPreset) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { animationPreset }) }, "animation")),
  setZoom: (zoom) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { zoom }) }, "zoom")),
  setMediaOffsetX: (mediaOffsetX) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaOffsetX }) }, "mediaOffsetX")),
  setMediaOffsetY: (mediaOffsetY) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaOffsetY }) }, "mediaOffsetY")),
  setMediaFit: (mediaFit) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaFit }) }, "mediaFit")),
  setShadowOpacity: (shadowOpacity) => set((s) => pushHistory(s, { ...s.scene, shadowOpacity }, "shadow")),
  setBorderRadius: (borderRadius) => set((s) => pushHistory(s, { ...s.scene, borderRadius }, "radius")),
  setBackgroundSolid: (backgroundColor) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "solid", backgroundColor })),
  setBackgroundGradient: (gradientFrom, gradientTo) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "gradient", gradientFrom, gradientTo })),
  setBackgroundTransparent: () => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "transparent" })),
  setBackgroundImage: (backgroundImageUrl) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "image", backgroundImageUrl })),
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
  clearAnnotations: () => set((s) => ({ ...pushHistory(s, { ...s.scene, annotations: [] }), selectedAnnotationId: null })),
  setVideoMuted: (videoMuted) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoMuted }) })),
  setVideoLoop: (videoLoop) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoLoop }) })),
  setVideoAutoplay: (videoAutoplay) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoAutoplay }) })),
  setVideoPosterTime: (videoPosterTime) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoPosterTime }) }, "poster")),
  setVideoDuration: (videoDuration) =>
    set((s) =>
      pushHistory(s, {
        ...s.scene,
        layers: s.scene.layers.map((l) =>
          l.id === (s.scene.activeLayerId ?? s.scene.layers[0]?.id)
            ? {
                ...l,
                videoDuration,
                videoTrimEnd: l.videoTrimEnd > 0 ? Math.min(l.videoTrimEnd, videoDuration) : videoDuration
              }
            : l
        )
      })
    ),
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
  setVideoQuality: (videoQuality) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoQuality }) }))
}));
