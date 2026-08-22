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
    setWatermarkImage: (watermarkImageUrl) => set((s) => pushHistory(s, { ...s.scene, watermarkImageUrl })),
    setScreenChrome: (patch) => set((s) => pushHistory(s, { ...s.scene, screen: { ...s.scene.screen, ...patch } }, "screen")),
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
