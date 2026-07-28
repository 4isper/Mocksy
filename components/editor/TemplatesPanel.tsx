"use client";

import { useTranslations } from "next-intl";
import { sceneStylePresets, applySceneStylePreset } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";

export function TemplatesPanel() {
  const t = useTranslations();
  const setScene = useEditorStore((s) => s.setScene);

  const presetBackground = (preset: (typeof sceneStylePresets)[number]): string => {
    if (preset.backgroundMode === "gradient" && preset.gradientFrom && preset.gradientTo) {
      return `linear-gradient(120deg, ${preset.gradientFrom}, ${preset.gradientTo})`;
    }
    if (preset.backgroundMode === "solid" && preset.backgroundColor) {
      return preset.backgroundColor;
    }
    return "repeating-conic-gradient(#3f3f46 0% 25%, #18181b 0% 50%) 50% / 12px 12px";
  };

  return (
    <div className="templates" style={{ padding: 10, display: "grid", gap: 8, alignContent: "start" }}>
      {sceneStylePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="template-card"
            onClick={() => setScene(applySceneStylePreset(preset), true)}
            title={t("templates.apply", { name: preset.name })}
            style={{ background: presetBackground(preset) }}
          >
            <div className="t-name">{preset.name}</div>
          </button>
          ))}
      </div>
    );
  }