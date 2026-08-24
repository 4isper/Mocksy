import type { CSSProperties } from "react";

/** Font families offered for text annotations, shared between the editor panel
 *  and the font embedding used by the HTML/SVG exporters so the picker and the
 *  exported output stay in sync. */
export const ANNOTATION_FONT_OPTIONS: { value: string; label: string }[] = [
  { value: "Inter, system-ui, sans-serif", label: "Inter" },
  { value: "Montserrat, sans-serif", label: "Montserrat" },
  { value: "Roboto, sans-serif", label: "Roboto" },
  { value: "Lora, Georgia, serif", label: "Lora" },
  { value: "Caveat, cursive", label: "Caveat" },
  { value: "system-ui", label: "System UI" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Comic Sans MS', cursive", label: "Comic Sans MS" }
];

export const DEFAULT_ANNOTATION_FONT = "Inter, system-ui, sans-serif";

export type AnnotationAlign = "left" | "center" | "right";

export type AnnotationFontWeight = "bold" | "normal";

export type AnnotationFontStyle = "normal" | "italic";

export const FONT_WEIGHT_OPTIONS: { value: AnnotationFontWeight; labelKey: "annotation.bold" | "annotation.regular" }[] = [
  { value: "bold", labelKey: "annotation.bold" },
  { value: "normal", labelKey: "annotation.regular" }
];

export const FONT_STYLE_OPTIONS: { value: AnnotationFontStyle; labelKey: "annotation.normal" | "annotation.italic" }[] = [
  { value: "normal", labelKey: "annotation.normal" },
  { value: "italic", labelKey: "annotation.italic" }
];

export const ALIGN_OPTIONS: { value: AnnotationAlign; labelKey: `annotation.align${"Left" | "Center" | "Right"}` }[] = [
  { value: "left", labelKey: "annotation.alignLeft" },
  { value: "center", labelKey: "annotation.alignCenter" },
  { value: "right", labelKey: "annotation.alignRight" }
];

/** Resolves the CSS `fontWeight` used when rendering a text annotation. */
export function annotationFontWeight(weight: AnnotationFontWeight | undefined): CSSProperties["fontWeight"] {
  return weight ?? "bold";
}

/** Resolves the CSS `fontStyle` used when rendering a text annotation. */
export function annotationFontStyle(style: AnnotationFontStyle | undefined): CSSProperties["fontStyle"] {
  return style ?? "normal";
}
