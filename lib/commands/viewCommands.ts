import type { Command } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";

export function createViewCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  callbacks: {
    toggleFullscreenPreview: () => void;
  }
): Command[] {
  const { toggleFullscreenPreview } = callbacks;
  return [
    {
      id: "fullscreen-preview",
      category: "view",
      label: t("commandPalette.fullscreenPreview"),
      description: t("commandPalette.fullscreenPreviewDesc"),
      keywords: ["fullscreen", "full screen", "preview", "focus", "zen", "present", "hide panels"],
      shortcut: "F",
      action: toggleFullscreenPreview,
    },
    {
      id: "toggle-glare",
      category: "view",
      label: t("commandPalette.toggleGlare"),
      description: t("commandPalette.toggleGlareDesc"),
      keywords: ["glare", "gloss", "reflection", "shine", "screen", "light", "sweep"],
      action: () => {
        const st = useEditorStore.getState();
        st.setScreenGlare(!st.scene.screenGlare);
      },
    },
    {
      id: "toggle-reflection",
      category: "view",
      label: t("commandPalette.toggleReflection"),
      description: t("commandPalette.toggleReflectionDesc"),
      keywords: ["reflection", "mirror", "floor", "shadow", "device"],
      action: () => {
        const st = useEditorStore.getState();
        st.setFloorReflection(!st.scene.floorReflection);
      },
    },
    {
      id: "show-onboarding",
      category: "view",
      label: t("commandPalette.showOnboarding"),
      description: t("commandPalette.showOnboardingDesc"),
      keywords: ["onboarding", "tour", "guide", "intro", "help", "tutorial", "getting started"],
      action: () => useEditorStore.getState().setOnboardingOpen(true),
    },
  ];
}

/** Commands that jump straight to a right-panel tab (templates/layers/…).
 *  They also leave full-screen preview so the target tab is actually visible. */
export function createPanelTabCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string
): Command[] {
  const goTo = (tab: "templates" | "layers" | "annotations" | "history" | "projects") => {
    const st = useEditorStore.getState();
    st.setFullscreenPreview(false);
    st.setRightTab(tab);
  };
  return [
    {
      id: "go-templates",
      category: "view",
      label: t("commandPalette.goTemplates"),
      description: t("commandPalette.goTemplatesDesc"),
      keywords: ["templates", "presets", "right panel", "tab", "open"],
      action: () => goTo("templates"),
    },
    {
      id: "go-layers",
      category: "view",
      label: t("commandPalette.goLayers"),
      description: t("commandPalette.goLayersDesc"),
      keywords: ["layers", "right panel", "tab", "open", "select"],
      action: () => goTo("layers"),
    },
    {
      id: "go-annotations",
      category: "view",
      label: t("commandPalette.goAnnotations"),
      description: t("commandPalette.goAnnotationsDesc"),
      keywords: ["annotations", "notes", "labels", "right panel", "tab", "open"],
      action: () => goTo("annotations"),
    },
    {
      id: "go-history",
      category: "view",
      label: t("commandPalette.goHistory"),
      description: t("commandPalette.goHistoryDesc"),
      keywords: ["history", "undo", "timeline", "versions", "right panel", "tab", "open"],
      action: () => goTo("history"),
    },
    {
      id: "go-projects",
      category: "view",
      label: t("commandPalette.goProjects"),
      description: t("commandPalette.goProjectsDesc"),
      keywords: ["projects", "save", "manage", "right panel", "tab", "open"],
      action: () => goTo("projects"),
    },
  ];
}
