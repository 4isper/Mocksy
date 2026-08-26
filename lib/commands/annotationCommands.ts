import type { Command, EditorScene, AnnotationType } from "@/lib/types/editor";

export function createAnnotationCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
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
      category: "annotation",
      label: t("commandPalette.addTextAnnotation"),
      description: t("commandPalette.addTextAnnotationDesc"),
      shortcut: "⌘⇧T",
      keywords: ["annotation", "text", "label", "caption"],
      action: () => addAnnotation("text"),
    },
    {
      id: "anno-arrow",
      category: "annotation",
      label: t("commandPalette.addArrowAnnotation"),
      description: t("commandPalette.addArrowAnnotationDesc"),
      shortcut: "⌘⇧I",
      keywords: ["annotation", "arrow", "pointer", "direction"],
      action: () => addAnnotation("arrow"),
    },
    {
      id: "anno-rect",
      category: "annotation",
      label: t("commandPalette.addRectangleAnnotation"),
      description: t("commandPalette.addRectangleAnnotationDesc"),
      shortcut: "⌘⇧R",
      keywords: ["annotation", "rectangle", "box", "highlight", "shape"],
      action: () => addAnnotation("rect"),
    },
    {
      id: "anno-circle",
      category: "annotation",
      label: t("commandPalette.addCircleAnnotation"),
      description: t("commandPalette.addCircleAnnotationDesc"),
      shortcut: "⌘⇧O",
      keywords: ["annotation", "circle", "ellipse", "ring", "shape"],
      action: () => addAnnotation("circle"),
    },
    {
      id: "anno-blur",
      category: "annotation",
      label: t("commandPalette.addBlurAnnotation"),
      description: t("commandPalette.addBlurAnnotationDesc"),
      shortcut: "⌘⇧B",
      keywords: ["annotation", "blur", "censor", "obscure", "hide"],
      action: () => addAnnotation("blur"),
    },
    {
      id: "anno-clear",
      category: "annotation",
      label: t("commandPalette.clearAnnotations"),
      description: t("commandPalette.clearAnnotationsDesc"),
      keywords: ["annotation", "clear", "remove", "delete", "all"],
      action: clearAnnotations,
      disabled: scene.annotations.length === 0,
    },
  ];
}