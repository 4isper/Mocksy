import type { Command } from "@/lib/types/editor";

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
  ];
}
