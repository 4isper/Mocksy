import type { Command, EditorScene } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";

export function createWatermarkCommands(
  t: (key: string, values?: Record<string, any>) => string,
  scene: EditorScene,
  callbacks: {
    toggleWatermark: (enabled: boolean) => void;
  }
): Command[] {
  const { toggleWatermark } = callbacks;
  return [
    {
      id: "watermark-toggle",
      label: scene.watermarkEnabled ? t("commandPalette.disableWatermark") : t("commandPalette.enableWatermark"),
      description: scene.watermarkEnabled ? t("commandPalette.disableWatermarkDesc") : t("commandPalette.enableWatermarkDesc"),
      keywords: ["watermark", "brand", "logo", "mocksy"],
      action: () => toggleWatermark(!scene.watermarkEnabled),
    },
    {
      id: "watermark-edit",
      label: t("commandPalette.editWatermarkText"),
      description: t("commandPalette.watermarkTextDesc", { text: scene.watermarkText }),
      keywords: ["watermark", "text", "edit", "change"],
      action: () => {
        const text = prompt(t("commandPalette.watermarkTextPrompt"), scene.watermarkText);
        if (text !== null) useEditorStore.getState().setWatermarkText(text);
      },
    },
  ];
}