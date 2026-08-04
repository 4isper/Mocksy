import {
  activeLayer,
  makeDemoLayer,
  nextLayerId,
  patchActive,
  pushHistory
} from "@/lib/state/editorHelpers";
import type { MediaLayer } from "@/lib/types/editor";
import type { EditorStoreSetter, EditorStoreState } from "../editorStoreTypes";

export type LayersSlice = Pick<
  EditorStoreState,
  | "setMedia"
  | "addLayer"
  | "duplicateLayer"
  | "toggleLayerHidden"
  | "removeLayer"
  | "selectLayer"
  | "reorderLayers"
  | "updateActiveLayer"
  | "setStylePreset"
  | "setAnimationPreset"
  | "setAnimationEasing"
  | "setAnimationDuration"
  | "setZoom"
  | "setMediaOffsetX"
  | "setMediaOffsetY"
  | "setMediaFit"
  | "setBrightness"
  | "setContrast"
  | "setSaturate"
  | "setBlur"
  | "setGrayscale"
  | "setShadowOpacity"
  | "setBorderRadius"
  | "setTiltX"
  | "setTiltY"
  | "setVideoMuted"
  | "setVideoLoop"
  | "setVideoAutoplay"
  | "setVideoPosterTime"
  | "setVideoDuration"
  | "setVideoTrimStart"
  | "setVideoTrimEnd"
  | "setVideoQuality"
>;

/** Media loading, layer lifecycle/ordering, and per-layer style/video setters. */
export function createLayersSlice(set: EditorStoreSetter): LayersSlice {
  return {
    setMedia: (mediaUrl, mediaType, mediaName = null) =>
      set((s) => {
        const layer = activeLayer(s.scene, s.activeLayerId);
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
          ...pushHistory(s, { ...s.scene, layers: nextLayers }),
          activeLayerId,
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
          ...pushHistory(s, { ...s.scene, layers }),
          activeLayerId: newLayer.id,
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
          ...pushHistory(s, { ...s.scene, layers }),
          activeLayerId: clone.id,
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
        const activeLayerId = s.activeLayerId === id ? layers[0]?.id ?? null : s.activeLayerId;
        return { ...pushHistory(s, { ...s.scene, layers }), activeLayerId };
      }),
    selectLayer: (id) =>
      set((s) => {
        // Selecting lives in store-root state, never touching `scene` — a new
        // scene object would re-render every `scene` subscriber (and rebuild the
        // whole preview CSS) for a pure selection change.
        if (s.activeLayerId === id) return {};
        return { activeLayerId: id };
      }),
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
        const layer = activeLayer(s.scene, s.activeLayerId);
        if (!layer) return {};
        const layers = s.scene.layers.map((l) => (l.id === layer.id ? { ...l, ...patch } : l));
        return pushHistory(s, { ...s.scene, layers }, Object.keys(patch).join(","));
      }),
    setStylePreset: (stylePreset) => set((s) => pushHistory(s, { ...s.scene, stylePreset })),
    setAnimationPreset: (animationPreset) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { animationPreset }, s.activeLayerId) }, "animation")),
    setAnimationEasing: (animationEasing) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { animationEasing }, s.activeLayerId) }, "animation")),
    setAnimationDuration: (animationDurationMs) => set((s) => pushHistory(s, { ...s.scene, animationDurationMs: Math.max(500, Math.min(20000, Math.round(animationDurationMs))) }, "animationDuration")),
    setZoom: (zoom) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { zoom }, s.activeLayerId) }, "zoom")),
    setMediaOffsetX: (mediaOffsetX) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaOffsetX }, s.activeLayerId) }, "mediaOffset")),
    setMediaOffsetY: (mediaOffsetY) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaOffsetY }, s.activeLayerId) }, "mediaOffset")),
    setMediaFit: (mediaFit) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaFit }, s.activeLayerId) }, "mediaFit")),
    setBrightness: (brightness) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { brightness }, s.activeLayerId) }, "layerFilter")),
    setContrast: (contrast) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { contrast }, s.activeLayerId) }, "layerFilter")),
    setSaturate: (saturate) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { saturate }, s.activeLayerId) }, "layerFilter")),
    setBlur: (blur) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { blur }, s.activeLayerId) }, "layerFilter")),
    setGrayscale: (grayscale) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { grayscale }, s.activeLayerId) }, "layerFilter")),
    setShadowOpacity: (shadowOpacity) => set((s) => pushHistory(s, { ...s.scene, shadowOpacity }, "shadow")),
    setBorderRadius: (borderRadius) => set((s) => pushHistory(s, { ...s.scene, borderRadius }, "radius")),
    setTiltX: (tiltX) => set((s) => pushHistory(s, { ...s.scene, tiltX }, "tilt")),
    setTiltY: (tiltY) => set((s) => pushHistory(s, { ...s.scene, tiltY }, "tilt")),
    setVideoMuted: (videoMuted) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoMuted }, s.activeLayerId) })),
    setVideoLoop: (videoLoop) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoLoop }, s.activeLayerId) })),
    setVideoAutoplay: (videoAutoplay) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoAutoplay }, s.activeLayerId) })),
    setVideoPosterTime: (videoPosterTime) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoPosterTime }, s.activeLayerId) }, "poster")),
    setVideoDuration: (videoDuration, layerId) =>
      set((s) => {
        const targetId = layerId ?? s.activeLayerId ?? s.scene.layers[0]?.id;
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
    setVideoTrimStart: (videoTrimStart) =>
      set((s) =>
        pushHistory(s, {
          ...s.scene,
          layers: patchActive(s.scene, {
            videoTrimStart: Math.min(videoTrimStart, activeLayer(s.scene, s.activeLayerId)?.videoTrimEnd ?? videoTrimStart)
          }, s.activeLayerId)
        }, "trimStart")
      ),
    setVideoTrimEnd: (videoTrimEnd) =>
      set((s) =>
        pushHistory(s, {
          ...s.scene,
          layers: patchActive(s.scene, {
            // A zero (or negative) end means "not trimmed" — clamp to the full
            // duration so 0 never lingers in state as a confusing sentinel.
            videoTrimEnd: videoTrimEnd <= 0 ? (activeLayer(s.scene, s.activeLayerId)?.videoDuration ?? 0) : Math.max(videoTrimEnd, activeLayer(s.scene, s.activeLayerId)?.videoTrimStart ?? 0)
          }, s.activeLayerId)
        }, "trimEnd")
      ),
    setVideoQuality: (videoQuality) => set((s) => pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoQuality }, s.activeLayerId) }))
  };
}
