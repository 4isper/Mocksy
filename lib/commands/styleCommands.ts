import type { Command } from "@/lib/types/editor";
import { sceneStylePresets, applySceneStylePreset, randomSceneStyle } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";

export function createStyleCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): Command[] {
  const presetCommands = sceneStylePresets.map(preset => ({
    id: `preset-${preset.id}`,
    category: "style",
    label: t("commandPalette.styleLabel", { name: t(`preset.${preset.id}`) }),
    description: `${preset.frame} • ${preset.stylePreset} • ${preset.backgroundMode}`,
    keywords: ["preset", "style", "theme", "template", t(`preset.${preset.id}`).toLowerCase()],
    action: () => {
      const scenePatch = applySceneStylePreset(preset);
      useEditorStore.getState().setScene(scenePatch);
    },
  }));
  return [
    ...presetCommands,
    {
      id: "surprise-style",
      category: "style",
      label: t("commandPalette.surpriseStyle"),
      description: t("commandPalette.surpriseStyleDesc"),
      keywords: ["surprise", "random", "shuffle", "dice", "style", "background", "inspiration"],
      action: () => {
        const palette = useEditorStore.getState().scenePalette ?? [];
        useEditorStore.getState().setScene(randomSceneStyle(Math.random, palette.length ? palette : undefined));
      },
    },
  ];
}