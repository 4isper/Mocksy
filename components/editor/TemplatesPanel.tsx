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
    <div className="panel templates-panel" style={{ padding: 16, display: "grid", gap: 10, alignContent: "start" }}>
      <h2 className="panel-title">{t("templates.title")}</h2>
      <div className="templates">
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
    </div>
  );
}