import type { Command } from "@/lib/types/editor";
import { sceneStylePresets, applySceneStylePreset } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";

export function createStyleCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): Command[] {
  return sceneStylePresets.map(preset => ({
    id: `preset-${preset.id}`,
    label: t("commandPalette.styleLabel", { name: t(`preset.${preset.id}`) }),
    description: `${preset.frame} • ${preset.stylePreset} • ${preset.backgroundMode}`,
    keywords: ["preset", "style", "theme", "template", t(`preset.${preset.id}`).toLowerCase()],
    action: () => {
      const scenePatch = applySceneStylePreset(preset);
      useEditorStore.getState().setScene(scenePatch);
    },
  }));
}