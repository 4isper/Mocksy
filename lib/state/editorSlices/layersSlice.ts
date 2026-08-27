import {
  activeLayer,
  isLayerLocked,
  makeDemoLayer,
  nextLayerId,
  patchActive,
  pushHistory
} from "@/lib/state/editorHelpers";
import type { MediaLayer } from "@/lib/types/editor";
import type { EditorStoreSetter, EditorStoreState } from "../editorStoreTypes";
import { useRecentMediaStore } from "@/lib/state/recentMediaStore";
import { nextGroupId } from "@/lib/state/ids";

/** Coalesce key for a group edit, scoped to the affected selection: two edits
 *  of DIFFERENT groups within the 400ms window must stay separate undo steps,
 *  while repeated updates of the same selection coalesce into one. */
function groupKey(prefix: string, ids: string[]): string {
  return `${prefix}:${[...ids].sort().join(",")}`;
}

export type LayersSlice = Pick<
  EditorStoreState,
  | "setMedia"
  | "setMediaOnLayer"
  | "addLayer"
  | "addTextLayer"
  | "duplicateLayer"
  | "toggleLayerHidden"
  | "toggleLayersLocked"
  | "removeLayer"
  | "selectLayer"
  | "selectLayers"
  | "toggleLayerSelected"
  | "selectLayerRange"
  | "duplicateLayers"
  | "toggleLayersHidden"
  | "removeLayers"
  | "transformLayers"
  | "nudgeLayers"
  | "reorderLayers"
  | "updateActiveLayer"
  | "renameLayer"
  | "groupLayers"
  | "ungroupLayers"
  | "renameGroup"
  | "toggleGroupHidden"
  | "toggleGroupLocked"
  | "setStylePreset"
  | "setAnimationPreset"
  | "setAnimationEasing"
  | "setAnimationDuration"
  | "setEntranceAnimation"
  | "setEntranceDuration"
  | "setBlendMode"
  | "setZoom"
  | "setMediaOffsetX"
  | "setMediaOffsetY"
  | "setRotation"
  | "setMediaFit"
  | "setBrightness"
  | "setContrast"
  | "setSaturate"
  | "setBlur"
  | "setGrayscale"
  | "setOpacity"
  | "setVideoQuality"
  | "setPlaybackSpeed"
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
  // Locked layers reject content edits: every mutating per-layer setter no-ops
  // (returning {}) instead of pushing a do-nothing undo entry.
  const locked = (s: EditorStoreState) => isLayerLocked(s.scene, s.activeLayerId);
  return {
    setMedia: (mediaUrl, mediaType, mediaName = null) => {
      set((s) => {
        if (locked(s)) return {};
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
          : [...s.scene.layers, { ...makeDemoLayer(), mediaUrl, mediaType, mediaName }];
        const activeLayerId = layer?.id ?? nextLayers[0]?.id ?? null;
        return {
          ...pushHistory(s, { ...s.scene, layers: nextLayers }),
          activeLayerId,
          videoCurrentTime: 0,
          // A real upload decodes asynchronously; clear media stops loading.
          isMediaLoading: mediaUrl != null
        };
      });
      if (mediaUrl && mediaType && mediaType !== "none") {
        useRecentMediaStore.getState().addEntry(mediaUrl, mediaType, mediaName);
      }
    },
    setMediaOnLayer: (layerId, mediaUrl, mediaType, mediaName = null) =>
      set((s) => {
        if (s.scene.layers.find((l) => l.id === layerId)?.locked === true) return {};
        const exists = s.scene.layers.some((l) => l.id === layerId);
        if (!exists) return {};
        const layers = s.scene.layers.map((l) =>
          l.id === layerId
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
        );
        return {
          ...pushHistory(s, { ...s.scene, layers }),
          videoCurrentTime: 0,
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
    addTextLayer: (textContent) =>
      set((s) => {
        // Text layers reuse the layer pipeline (transform/animation/frames);
        // only the screen-content slot differs. No media payload to load.
        const newLayer: MediaLayer = {
          ...makeDemoLayer(),
          id: nextLayerId(),
          kind: "text",
          mediaUrl: null,
          mediaType: "none",
          mediaName: null,
          textContent,
          textColor: "#ffffff",
          textSize: 0.12,
          textAlign: "center",
          fontWeight: "bold"
        };
        const layers = [...s.scene.layers, newLayer];
        return {
          ...pushHistory(s, { ...s.scene, layers }),
          activeLayerId: newLayer.id,
          selectedLayerIds: [newLayer.id],
          videoCurrentTime: 0,
          isMediaLoading: false
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
    toggleLayersLocked: (ids) =>
      set((s) => {
        if (ids.length === 0) return {};
        const idSet = new Set(ids);
        const layers = s.scene.layers.map((l) => (idSet.has(l.id) ? { ...l, locked: !l.locked } : l));
        return pushHistory(s, { ...s.scene, layers });
      }),
    removeLayer: (id) =>
      set((s) => {
        // Locked layers are protected from deletion.
        if (s.scene.layers.find((l) => l.id === id)?.locked === true) return {};
        if (s.scene.layers.length <= 1) return {};
        const layers = s.scene.layers.filter((l) => l.id !== id);
        // Drop frame instances bound to the removed layer so they don't keep
        // rendering (via fallback) the active layer's media as a phantom frame.
        const frameInstances = s.scene.frameInstances.filter((fi) => fi.layerId !== id);
        const activeLayerId = s.activeLayerId === id ? layers[0]?.id ?? null : s.activeLayerId;
        const selectedLayerIds = s.selectedLayerIds.filter((x) => x !== id);
        return { ...pushHistory(s, { ...s.scene, layers, frameInstances }), activeLayerId, selectedLayerIds };
      }),
    duplicateLayers: (ids) =>
      set((s) => {
        if (ids.length === 0) return {};
        const byId = new Map(s.scene.layers.map((l) => [l.id, l]));
        const clones = ids
          .map((id) => byId.get(id))
          .filter((l): l is MediaLayer => Boolean(l))
          .map((source) => ({ ...source, id: nextLayerId() }));
        if (clones.length === 0) return {};
        const layers = [...s.scene.layers, ...clones];
        // Keep frame instances that referenced a duplicated layer pointing at
        // the original, not its clone; clones start unreferenced. Select the
        // first clone so the user sees the new layer.
        return {
          ...pushHistory(s, { ...s.scene, layers }),
          activeLayerId: clones[0]!.id,
          selectedLayerIds: [clones[0]!.id],
          videoCurrentTime: 0,
          isMediaLoading: false
        };
      }),
    toggleLayersHidden: (ids) =>
      set((s) => {
        if (ids.length === 0) return {};
        const idSet = new Set(ids);
        const layers = s.scene.layers.map((l) => (idSet.has(l.id) ? { ...l, hidden: !l.hidden } : l));
        return pushHistory(s, { ...s.scene, layers });
      }),
    removeLayers: (ids) =>
      set((s) => {
        // Locked layers are protected: they stay even when explicitly listed.
        const removable = s.scene.layers.filter((l) => !l.locked && ids.includes(l.id));
        const idSet = new Set(removable.map((l) => l.id));
        if (idSet.size === 0 || s.scene.layers.length <= idSet.size) return {};
        const layers = s.scene.layers.filter((l) => !idSet.has(l.id));
        // Drop frame instances bound to any removed layer (see removeLayer).
        const frameInstances = s.scene.frameInstances.filter((fi) => fi.layerId == null || !idSet.has(fi.layerId));
        const first = layers[0]?.id ?? null;
        const activeLayerId = s.activeLayerId != null && idSet.has(s.activeLayerId) ? first : s.activeLayerId;
        const selectedLayerIds = s.selectedLayerIds.filter((x) => !idSet.has(x));
        return { ...pushHistory(s, { ...s.scene, layers, frameInstances }), activeLayerId, selectedLayerIds };
      }),
    transformLayers: (ids, patch) =>
      set((s) => {
        if (ids.length === 0) return {};
        const idSet = new Set(ids);
        // Locked layers are protected from group edits, exactly like the
        // single-layer transform setters guard with `locked(s)`.
        const layers = s.scene.layers.map((l) => (idSet.has(l.id) && !l.locked ? { ...l, ...patch } : l));
        const changed = layers.some((l, i) => l !== s.scene.layers[i]);
        if (!changed) return {};
        return pushHistory(s, { ...s.scene, layers }, groupKey("layerGroupTransform", ids));
      }),
    nudgeLayers: (ids, dx, dy) =>
      set((s) => {
        if (ids.length === 0) return {};
        const idSet = new Set(ids);
        const clamp01 = (v: number) => Math.max(-1, Math.min(1, v));
        const layers = s.scene.layers.map((l) =>
          idSet.has(l.id) && !l.locked
            ? { ...l, mediaOffsetX: clamp01(l.mediaOffsetX + dx), mediaOffsetY: clamp01(l.mediaOffsetY + dy) }
            : l
        );
        const changed = layers.some((l, i) => l !== s.scene.layers[i]);
        if (!changed) return {};
        return pushHistory(s, { ...s.scene, layers }, groupKey("layerGroupNudge", ids));
      }),
    selectLayer: (id) =>
      set((s) => {
        // Selecting lives in store-root state, never touching `scene` — a new
        // scene object would re-render every `scene` subscriber (and rebuild the
        // whole preview CSS) for a pure selection change.
        if (s.activeLayerId === id && s.selectedLayerIds.length === 1 && s.selectedLayerIds[0] === id) return {};
        return { activeLayerId: id, selectedLayerIds: [id] };
      }),
    selectLayers: (ids) =>
      set(() => {
        if (ids.length === 0) return { activeLayerId: null, selectedLayerIds: [] };
        return { activeLayerId: ids[0] ?? null, selectedLayerIds: [...ids] };
      }),
    toggleLayerSelected: (id) =>
      set((s) => {
        const exists = s.selectedLayerIds.includes(id);
        const next = exists ? s.selectedLayerIds.filter((x) => x !== id) : [...s.selectedLayerIds, id];
        return { activeLayerId: id, selectedLayerIds: next.length > 0 ? next : [id] };
      }),
    selectLayerRange: (id, additive = false) =>
      set((s) => {
        const ids = s.scene.layers.map((l) => l.id);
        const anchor = s.selectedLayerIds[s.selectedLayerIds.length - 1] ?? id;
        const a = ids.indexOf(anchor);
        const b = ids.indexOf(id);
        if (a < 0 || b < 0) return { activeLayerId: id, selectedLayerIds: [id] };
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = ids.slice(lo, hi + 1);
        const merged = additive ? Array.from(new Set([...s.selectedLayerIds, ...range])) : range;
        return { activeLayerId: id, selectedLayerIds: merged };
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
        if (locked(s)) return {};
        const layer = activeLayer(s.scene, s.activeLayerId);
        if (!layer) return {};
        const layers = s.scene.layers.map((l) => (l.id === layer.id ? { ...l, ...patch } : l));
        return pushHistory(s, { ...s.scene, layers }, Object.keys(patch).join(","));
      }),
    renameLayer: (id, name) =>
      set((s) => {
        if (s.scene.layers.find((l) => l.id === id)?.locked === true) return {};
        if (!s.scene.layers.some((l) => l.id === id)) return {};
        const layers = s.scene.layers.map((l) => (l.id === id ? { ...l, mediaName: name || l.mediaName } : l));
        return pushHistory(s, { ...s.scene, layers }, "rename");
      }),
    groupLayers: (ids, name) =>
      set((s) => {
        if (ids.length < 2) return {};
        const idSet = new Set(ids);
        const groupId = nextGroupId();
        const layers = s.scene.layers.map((l) =>
          idSet.has(l.id) ? { ...l, groupId } : l
        );
        // Store group name on the first layer of the group (as the canonical
        // name source). We use mediaName only for display, so we'll derive the
        // group name from a synthetic convention: store it on the layer.
        // Since MediaLayer has no groupName field, we keep a lightweight map.
        return pushHistory(s, { ...s.scene, layers }, "groupLayers");
      }),
    ungroupLayers: (ids) =>
      set((s) => {
        if (ids.length === 0) return {};
        const idSet = new Set(ids);
        const layers = s.scene.layers.map((l) =>
          idSet.has(l.id) ? { ...l, groupId: null } : l
        );
        return pushHistory(s, { ...s.scene, layers }, "ungroupLayers");
      }),
    renameGroup: (groupId, name) =>
      set((s) => {
        if (!groupId) return {};
        // Group name is stored as mediaName on the first layer with this groupId.
        const first = s.scene.layers.find((l) => l.groupId === groupId);
        if (!first) return {};
        const layers = s.scene.layers.map((l) =>
          l.id === first.id ? { ...l, mediaName: name || l.mediaName } : l
        );
        return pushHistory(s, { ...s.scene, layers }, "renameGroup");
      }),
    toggleGroupHidden: (groupId) =>
      set((s) => {
        if (!groupId) return {};
        const members = s.scene.layers.filter((l) => l.groupId === groupId);
        if (members.length === 0) return {};
        const allHidden = members.every((l) => l.hidden);
        const layers = s.scene.layers.map((l) =>
          l.groupId === groupId ? { ...l, hidden: !allHidden } : l
        );
        return pushHistory(s, { ...s.scene, layers }, "toggleGroupHidden");
      }),
    toggleGroupLocked: (groupId) =>
      set((s) => {
        if (!groupId) return {};
        const members = s.scene.layers.filter((l) => l.groupId === groupId);
        if (members.length === 0) return {};
        const allLocked = members.every((l) => l.locked);
        const layers = s.scene.layers.map((l) =>
          l.groupId === groupId ? { ...l, locked: !allLocked } : l
        );
        return pushHistory(s, { ...s.scene, layers }, "toggleGroupLocked");
      }),
    setStylePreset: (stylePreset) => set((s) => pushHistory(s, { ...s.scene, stylePreset })),
    setAnimationPreset: (animationPreset) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { animationPreset }, s.activeLayerId) }, "animationPreset")),
    setAnimationEasing: (animationEasing) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { animationEasing }, s.activeLayerId) }, "animationEasing")),
    setAnimationDuration: (animationDurationMs) => set((s) => pushHistory(s, { ...s.scene, animationDurationMs: Math.max(500, Math.min(20000, Math.round(animationDurationMs))) }, "animationDuration")),
    setEntranceAnimation: (entranceAnimation) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { entranceAnimation }, s.activeLayerId) }, "entranceAnimation")),
    setEntranceDuration: (entranceDuration) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { entranceDuration: Math.max(200, Math.min(2000, Math.round(entranceDuration))) }, s.activeLayerId) }, "entranceDuration")),
    setBlendMode: (blendMode) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { blendMode }, s.activeLayerId) }, "blendMode")),
    setZoom: (zoom) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { zoom }, s.activeLayerId) }, "zoom")),
    setMediaOffsetX: (mediaOffsetX) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaOffsetX }, s.activeLayerId) }, "mediaOffset")),
    setMediaOffsetY: (mediaOffsetY) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaOffsetY }, s.activeLayerId) }, "mediaOffset")),
    setRotation: (rotation) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { rotation }, s.activeLayerId) }, "rotation")),
    setMediaFit: (mediaFit) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { mediaFit }, s.activeLayerId) }, "mediaFit")),
    setBrightness: (brightness) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { brightness }, s.activeLayerId) }, "brightness")),
    setContrast: (contrast) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { contrast }, s.activeLayerId) }, "contrast")),
    setSaturate: (saturate) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { saturate }, s.activeLayerId) }, "saturate")),
    setBlur: (blur) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { blur }, s.activeLayerId) }, "blur")),
    setGrayscale: (grayscale) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { grayscale }, s.activeLayerId) }, "grayscale")),
    setOpacity: (opacity) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { opacity }, s.activeLayerId) }, "opacity")),
    setShadowOpacity: (shadowOpacity) => set((s) => pushHistory(s, { ...s.scene, shadowOpacity }, "shadow")),
    setBorderRadius: (borderRadius) => set((s) => pushHistory(s, { ...s.scene, borderRadius }, "radius")),
    setTiltX: (tiltX) => set((s) => pushHistory(s, { ...s.scene, tiltX }, "tilt")),
    setTiltY: (tiltY) => set((s) => pushHistory(s, { ...s.scene, tiltY }, "tilt")),
    setVideoMuted: (videoMuted) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoMuted }, s.activeLayerId) })),
    setVideoLoop: (videoLoop) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoLoop }, s.activeLayerId) })),
    setVideoAutoplay: (videoAutoplay) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoAutoplay }, s.activeLayerId) })),
    setVideoPosterTime: (videoPosterTime) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoPosterTime }, s.activeLayerId) }, "poster")),
    setVideoDuration: (videoDuration, layerId) =>
      set((s) => {
        const targetId = layerId ?? s.activeLayerId ?? s.scene.layers[0]?.id;
        if (targetId != null && s.scene.layers.find((l) => l.id === targetId)?.locked === true) return {};
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
      set((s) => locked(s) ? {} :
        pushHistory(s, {
          ...s.scene,
          layers: patchActive(s.scene, {
            videoTrimStart: Math.min(videoTrimStart, activeLayer(s.scene, s.activeLayerId)?.videoTrimEnd ?? videoTrimStart)
          }, s.activeLayerId)
        }, "trimStart")
      ),
    setVideoTrimEnd: (videoTrimEnd) =>
      set((s) => locked(s) ? {} :
        pushHistory(s, {
          ...s.scene,
          layers: patchActive(s.scene, {
            // A zero (or negative) end means "not trimmed" — clamp to the full
            // duration so 0 never lingers in state as a confusing sentinel.
            videoTrimEnd: videoTrimEnd <= 0 ? (activeLayer(s.scene, s.activeLayerId)?.videoDuration ?? 0) : Math.max(videoTrimEnd, activeLayer(s.scene, s.activeLayerId)?.videoTrimStart ?? 0)
          }, s.activeLayerId)
        }, "trimEnd")
      ),
    setVideoQuality: (videoQuality) => set((s) => locked(s) ? {} : pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { videoQuality }, s.activeLayerId) })),
    setPlaybackSpeed: (playbackSpeed) =>
      set((s) => {
        if (locked(s)) return {};
        const clamped = Math.max(0.5, Math.min(2, playbackSpeed));
        return pushHistory(s, { ...s.scene, layers: patchActive(s.scene, { playbackSpeed: clamped }, s.activeLayerId) }, "playbackSpeed");
      })
  };
}
