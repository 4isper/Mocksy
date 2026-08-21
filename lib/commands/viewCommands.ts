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
      id: "show-onboarding",
      category: "view",
      label: t("commandPalette.showOnboarding"),
      description: t("commandPalette.showOnboardingDesc"),
      keywords: ["onboarding", "tour", "guide", "intro", "help", "tutorial", "getting started"],
      action: () => useEditorStore.getState().setOnboardingOpen(true),
    },
  ];
}
