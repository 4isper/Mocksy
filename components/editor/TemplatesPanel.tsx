"use client";

import { useTranslations } from "next-intl";
import { sceneStylePresets, applySceneStylePreset, randomSceneStyle } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";

export function TemplatesPanel({ onShareTemplate }: { onShareTemplate: () => Promise<void> }) {
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
      <button
        type="button"
        className="btn"
        onClick={() => setScene(randomSceneStyle(), true)}
        title={t("templates.surpriseTitle")}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, padding: "6px 10px" }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.3"/>
          <circle cx="5" cy="5" r="1" fill="currentColor"/>
          <circle cx="9" cy="9" r="1" fill="currentColor"/>
          <circle cx="9" cy="5" r="1" fill="currentColor"/>
          <circle cx="5" cy="9" r="1" fill="currentColor"/>
        </svg>
        {t("templates.surprise")}
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => void onShareTemplate()}
        title={t("templates.copyLinkTitle")}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, padding: "6px 10px" }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M5.5 8.5 8.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M6.2 3.6 7.4 2.4a2.4 2.4 0 0 1 3.4 0l.8.8a2.4 2.4 0 0 1 0 3.4L10.4 7.8M7.8 10.4 6.6 11.6a2.4 2.4 0 0 1-3.4 0l-.8-.8a2.4 2.4 0 0 1 0-3.4L3.6 6.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {t("templates.copyLink")}
      </button>
      {sceneStylePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="template-card"
            onClick={() => setScene(applySceneStylePreset(preset), true)}
            title={t("templates.apply", { name: t(`preset.${preset.id}`) })}
            style={{ background: presetBackground(preset) }}
          >
            <div className="t-name">{t(`preset.${preset.id}`)}</div>
          </button>
          ))}
      </div>
    );
  }