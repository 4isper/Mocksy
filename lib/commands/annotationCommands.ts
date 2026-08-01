import type { Command, EditorScene, AnnotationType } from "@/lib/types/editor";

export function createAnnotationCommands(
  t: (key: string, values?: Record<string, any>) => string,
  scene: EditorScene,
  callbacks: {
    addAnnotation: (type: AnnotationType) => void;
    clearAnnotations: () => void;
  }
): Command[] {
  const { addAnnotation, clearAnnotations } = callbacks;
  return [
    {
      id: "anno-text",
      label: t("commandPalette.addTextAnnotation"),
      description: t("commandPalette.addTextAnnotationDesc"),
      keywords: ["annotation", "text", "label", "caption"],
      action: () => addAnnotation("text"),
    },
    {
      id: "anno-arrow",
      label: t("commandPalette.addArrowAnnotation"),
      description: t("commandPalette.addArrowAnnotationDesc"),
      keywords: ["annotation", "arrow", "pointer", "direction"],
      action: () => addAnnotation("arrow"),
    },
    {
      id: "anno-rect",
      label: t("commandPalette.addRectangleAnnotation"),
      description: t("commandPalette.addRectangleAnnotationDesc"),
      keywords: ["annotation", "rectangle", "box", "highlight", "shape"],
      action: () => addAnnotation("rect"),
    },
    {
      id: "anno-clear",
      label: t("commandPalette.clearAnnotations"),
      description: t("commandPalette.clearAnnotationsDesc"),
      keywords: ["annotation", "clear", "remove", "delete", "all"],
      action: clearAnnotations,
      disabled: scene.annotations.length === 0,
    },
  ];
}