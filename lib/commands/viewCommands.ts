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
