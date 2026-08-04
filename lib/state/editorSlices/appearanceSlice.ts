import { makeAnnotation, pushHistory } from "@/lib/state/editorHelpers";
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
  | "setAspectRatio"
  | "addAnnotation"
  | "updateAnnotation"
  | "removeAnnotation"
  | "selectAnnotation"
  | "clearAnnotations"
  | "setBackgroundAudio"
  | "clearBackgroundAudio"
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
    setBackgroundAudio: (backgroundAudioUrl, backgroundAudioName) =>
      set((s) => pushHistory(s, { ...s.scene, backgroundAudioUrl, backgroundAudioName })),
    clearBackgroundAudio: () =>
      set((s) => pushHistory(s, { ...s.scene, backgroundAudioUrl: null, backgroundAudioName: null }))
  };
}
