import { makeAnnotation, pushHistory } from "@/lib/state/editorHelpers";
import { nextAnnotationId } from "@/lib/state/ids";
import type { EditorStoreSetter, EditorStoreState } from "../editorStoreTypes";

export type AppearanceSlice = Pick<
  EditorStoreState,
  | "setBackgroundSolid"
  | "setBackgroundGradient"
  | "setBackgroundTransparent"
  | "setBackgroundImage"
  | "setBackgroundPattern"
  | "setGradientType"
  | "setGradientVia"
  | "setBackgroundBlur"
  | "toggleWatermark"
  | "setWatermarkText"
  | "setWatermarkPosition"
  | "setWatermarkSize"
  | "setWatermarkImage"
  | "setScreenChrome"
  | "setFrameInstanceScreen"
  | "setFrameInstanceFloorReflection"
  | "clearFrameInstanceOverrides"
  | "applyInstanceToAll"
  | "setScreenGlare"
  | "setFloorReflection"
  | "setBrowserUrl"
  | "setBrowserChromeTheme"
  | "setAspectRatio"
  | "addAnnotation"
  | "updateAnnotation"
  | "duplicateAnnotation"
  | "reorderAnnotation"
  | "applyAnnotationPatches"
  | "removeAnnotation"
  | "selectAnnotation"
  | "selectAnnotations"
  | "clearAnnotations"
  | "setBackgroundAudio"
  | "clearBackgroundAudio"
  | "setAudioFadeIn"
  | "setAudioFadeOut"
>;

/** Background, watermark, annotation and background-audio setters. */
export function createAppearanceSlice(set: EditorStoreSetter): AppearanceSlice {
  return {
    setBackgroundSolid: (backgroundColor, coalesce) =>
      set((s) => pushHistory(s, { ...s.scene, backgroundMode: "solid", backgroundColor }, coalesce ? "backgroundColor" : undefined)),
    // gradientVia === null clears the middle stop; undefined keeps the current
    // value. The coalesce key collapses color-picker / angle-slider drags
    // (which fire per-pixel) into a single undo step.
    setBackgroundGradient: (gradientFrom, gradientTo, gradientAngle, gradientVia, gradientType, coalesce) =>
      set((s) => pushHistory(s, {
        ...s.scene,
        backgroundMode: "gradient",
        gradientFrom,
        gradientTo,
        ...(gradientAngle !== undefined ? { gradientAngle } : {}),
        ...(gradientVia !== undefined ? { gradientVia } : {}),
        ...(gradientType !== undefined ? { gradientType } : {})
      }, coalesce ? "gradient" : undefined)),
    setBackgroundTransparent: () => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "transparent" })),
    setBackgroundImage: (backgroundImageUrl) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "image", backgroundImageUrl })),
    setBackgroundPattern: (patternId) => set((s) => pushHistory(s, { ...s.scene, backgroundMode: "pattern", patternId })),
    setGradientType: (gradientType) => set((s) => pushHistory(s, { ...s.scene, gradientType })),
    setGradientVia: (gradientVia, coalesce) => set((s) => pushHistory(s, { ...s.scene, gradientVia }, coalesce ? "gradientVia" : undefined)),
    setBackgroundBlur: (backgroundBlur) => set((s) => pushHistory(s, { ...s.scene, backgroundBlur: Math.max(0, Math.min(40, Math.round(backgroundBlur))) }, "bgBlur")),
    toggleWatermark: (watermarkEnabled) => set((s) => pushHistory(s, { ...s.scene, watermarkEnabled })),
    setWatermarkText: (watermarkText) => set((s) => pushHistory(s, { ...s.scene, watermarkText })),
    setWatermarkPosition: (watermarkPosition) => set((s) => pushHistory(s, { ...s.scene, watermarkPosition })),
    setWatermarkSize: (watermarkSize) => set((s) => pushHistory(s, { ...s.scene, watermarkSize: Math.max(8, Math.min(64, Math.round(watermarkSize))) }, "watermarkSize")),
    setWatermarkImage: (watermarkImageUrl) => set((s) => pushHistory(s, { ...s.scene, watermarkImageUrl })),
    setScreenChrome: (patch) => set((s) => pushHistory(s, { ...s.scene, screen: { ...s.scene.screen, ...patch } }, "screen")),
    // Per-device screen chrome. Seeds the override from the effective screen
    // (instance override ?? scene default) so the first edit of a device that
    // previously inherited the default still keeps the other fields intact.
    setFrameInstanceScreen: (id, patch) =>
      set((s) => {
        const inst = s.scene.frameInstances.find((i) => i.id === id);
        if (!inst) return {};
        const base = inst.screen ?? s.scene.screen;
        const screen = { ...base, ...patch };
        return pushHistory(
          s,
          { ...s.scene, frameInstances: s.scene.frameInstances.map((i) => (i.id === id ? { ...i, screen } : i)) },
          "screen"
        );
      }),
    // Per-device floor reflection toggle (creates an override seeded from the
    // current effective value so the first edit keeps the other devices' state).
    setFrameInstanceFloorReflection: (id, on) =>
      set((s) => {
        const inst = s.scene.frameInstances.find((i) => i.id === id);
        if (!inst) return {};
        return pushHistory(
          s,
          { ...s.scene, frameInstances: s.scene.frameInstances.map((i) => (i.id === id ? { ...i, floorReflection: on } : i)) },
          "screen"
        );
      }),
    // Drops a device's screen + floor-reflection overrides so it inherits the
    // scene defaults again.
    clearFrameInstanceOverrides: (id) =>
      set((s) => {
        if (!s.scene.frameInstances.some((i) => i.id === id)) return {};
        return pushHistory(
          s,
          { ...s.scene, frameInstances: s.scene.frameInstances.map((i) => (i.id === id ? { ...i, screen: undefined, floorReflection: undefined } : i)) },
          "screen"
        );
      }),
    // Copies the selected device's effective screen chrome and floor reflection
    // to the scene defaults and clears every instance override, so all devices
    // share that configuration.
    applyInstanceToAll: (id) =>
      set((s) => {
        const inst = s.scene.frameInstances.find((i) => i.id === id);
        if (!inst) return {};
        const screen = inst.screen ?? s.scene.screen;
        const floorReflection = inst.floorReflection ?? s.scene.floorReflection;
        return pushHistory(
          s,
          {
            ...s.scene,
            screen: { ...screen },
            floorReflection,
            frameInstances: s.scene.frameInstances.map((i) => ({ ...i, screen: undefined, floorReflection: undefined }))
          },
          "screen"
        );
      }),
    setScreenGlare: (screenGlare) => set((s) => pushHistory(s, { ...s.scene, screenGlare })),
    setFloorReflection: (floorReflection) => set((s) => pushHistory(s, { ...s.scene, floorReflection })),
    setBrowserUrl: (browserUrl) => set((s) => pushHistory(s, { ...s.scene, browserUrl }, "browserUrl")),
    setBrowserChromeTheme: (theme) => set((s) => pushHistory(s, { ...s.scene, browserChromeTheme: theme }, "browserChromeTheme")),
    setAspectRatio: (aspectRatio) => set((s) => pushHistory(s, { ...s.scene, aspectRatio })),
    addAnnotation: (type) =>
      set((s) => {
        const annotation = makeAnnotation(type);
        return {
          ...pushHistory(s, { ...s.scene, annotations: [...s.scene.annotations, annotation] }),
          selectedAnnotationId: annotation.id,
          selectedAnnotationIds: [annotation.id]
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
          // Key per-annotation so a quick drag of annotation A followed by a
          // drag of annotation B does not collapse into one undo step (which
          // would overwrite A's edit and undo both at once).
          `annotation:${id}`
        )
      ),
    duplicateAnnotation: (id) =>
      set((s) => {
        const src = s.scene.annotations.find((a) => a.id === id);
        if (!src) return {};
        const copy = {
          ...src,
          id: nextAnnotationId(),
          x: Math.min(1, src.x + 0.04),
          y: Math.min(1, src.y + 0.04)
        };
        return {
          ...pushHistory(s, { ...s.scene, annotations: [...s.scene.annotations, copy] }),
          selectedAnnotationId: copy.id,
          selectedAnnotationIds: [copy.id]
        };
      }),
    reorderAnnotation: (id, to) =>
      set((s) => {
        const idx = s.scene.annotations.findIndex((a) => a.id === id);
        if (idx < 0) return {};
        const annotations = [...s.scene.annotations];
        const [item] = annotations.splice(idx, 1);
        if (!item) return {};
        if (to === "front") annotations.push(item);
        else annotations.unshift(item);
        return pushHistory(s, { ...s.scene, annotations });
      }),
    applyAnnotationPatches: (patches) =>
      set((s) =>
        pushHistory(
          s,
          {
            ...s.scene,
            annotations: s.scene.annotations.map((a) => (a.id in patches ? { ...a, ...patches[a.id]! } : a))
          },
          // One history entry for the whole align/distribute operation.
          "annotations:align"
        )
      ),
    removeAnnotation: (id) =>
      set((s) => {
        const annotations = s.scene.annotations.filter((a) => a.id !== id);
        return {
          ...pushHistory(s, { ...s.scene, annotations }),
          selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
          selectedAnnotationIds: s.selectedAnnotationIds.filter((x) => x !== id)
        };
      }),
    selectAnnotation: (id, additive = false) => {
      if (id === null) return set({ selectedAnnotationId: null, selectedAnnotationIds: [] });
      if (!additive) return set({ selectedAnnotationId: id, selectedAnnotationIds: [id] });
      // Shift-click toggles membership in the multi-selection.
      set((s) => {
        const exists = s.selectedAnnotationIds.includes(id);
        const next = exists ? s.selectedAnnotationIds.filter((x) => x !== id) : [...s.selectedAnnotationIds, id];
        return {
          selectedAnnotationIds: next,
          selectedAnnotationId: next.length > 0 ? next[next.length - 1]! : null
        };
      });
    },
    selectAnnotations: (ids) => set({
      selectedAnnotationIds: [...new Set(ids)],
      selectedAnnotationId: ids.length > 0 ? ids[ids.length - 1]! : null
    }),
    clearAnnotations: () => set((s) => ({ ...pushHistory(s, { ...s.scene, annotations: [] }), selectedAnnotationId: null })),
    setBackgroundAudio: (backgroundAudioUrl, backgroundAudioName) =>
      set((s) => pushHistory(s, { ...s.scene, backgroundAudioUrl, backgroundAudioName })),
    clearBackgroundAudio: () =>
      set((s) => pushHistory(s, { ...s.scene, backgroundAudioUrl: null, backgroundAudioName: null })),
    setAudioFadeIn: (audioFadeIn) =>
      set((s) => pushHistory(s, { ...s.scene, audioFadeIn: Math.max(0, Math.min(10, audioFadeIn)) }, "audioFade")),
    setAudioFadeOut: (audioFadeOut) =>
      set((s) => pushHistory(s, { ...s.scene, audioFadeOut: Math.max(0, Math.min(10, audioFadeOut)) }, "audioFade"))
  };
}
