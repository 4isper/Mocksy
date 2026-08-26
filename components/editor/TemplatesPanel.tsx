"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { sceneStylePresets, applySceneStylePreset, randomSceneStyle } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";
import { cloneUserScene, MAX_USER_TEMPLATES, useTemplatesStore } from "@/lib/state/templatesStore";

export function TemplatesPanel({ onShareTemplate }: { onShareTemplate: () => Promise<void> }) {
  const t = useTranslations();
  const setScene = useEditorStore((s) => s.setScene);
  const templates = useTemplatesStore((s) => s.templates);
  const hydrated = useTemplatesStore((s) => s.hydrated);
  const hydrate = useTemplatesStore((s) => s.hydrate);
  const saveTemplate = useTemplatesStore((s) => s.saveTemplate);
  const deleteTemplate = useTemplatesStore((s) => s.deleteTemplate);

  const [draftName, setDraftName] = useState("");
  const [limitHit, setLimitHit] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleSave = () => {
    const scene = useEditorStore.getState().scene;
    const id = saveTemplate(scene, draftName);
    if (id === null) {
      setLimitHit(true);
      return;
    }
    setLimitHit(false);
    setDraftName("");
  };

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
    <div className="templates">
      <button
        type="button"
        className="btn btn-compact"
        onClick={() => {
          const palette = useEditorStore.getState().scenePalette ?? [];
          setScene(randomSceneStyle(Math.random, palette.length ? palette : undefined), true);
        }}
        title={t("templates.surpriseTitle")}
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
        className="btn btn-compact"
        onClick={() => void onShareTemplate()}
        title={t("templates.copyLinkTitle")}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M5.5 8.5 8.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M6.2 3.6 7.4 2.4a2.4 2.4 0 0 1 3.4 0l.8.8a2.4 2.4 0 0 1 0 3.4L10.4 7.8M7.8 10.4 6.6 11.6a2.4 2.4 0 0 1-3.4 0l-.8-.8a2.4 2.4 0 0 1 0-3.4L3.6 6.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {t("templates.copyLink")}
      </button>

      <div className="template-save-row">
        <input
          type="text"
          value={draftName}
          maxLength={60}
          placeholder={t("templates.savePlaceholder")}
          title={t("templates.saveTitle")}
          aria-label={t("templates.savePlaceholder")}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "6px 8px" }}
        />
        <button
          type="button"
          className="btn btn-compact"
          onClick={handleSave}
          disabled={!hydrated}
          title={t("templates.saveTitle")}
          style={{ whiteSpace: "nowrap" }}
        >
          {t("templates.save")}
        </button>
      </div>
      {limitHit ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: 12 }}>
          {t("templates.limitReached", { max: MAX_USER_TEMPLATES })}
        </span>
      ) : null}

      {templates.length > 0 ? (
        <>
          <div className="text-dim-xs" style={{ marginTop: 4 }}>
            {t("templates.myTemplates")}
          </div>
          <ul className="template-list">
            {templates.map((tpl) => (
              <li key={tpl.id} className="template-item">
                <button
                  type="button"
                  className="template-card"
                  onClick={() => setScene(cloneUserScene(tpl.scene), true)}
                  title={t("templates.apply", { name: tpl.name })}
                >
                  <div className="t-name">{tpl.name}</div>
                </button>
                <button
                  type="button"
                  className="btn-icon template-delete-btn"
                  onClick={() => deleteTemplate(tpl.id)}
                  title={t("templates.deleteTitle", { name: tpl.name })}
                  aria-label={t("templates.deleteTitle", { name: tpl.name })}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3.5 3.5l7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="text-dim-sm" style={{ textAlign: "center", padding: "4px 0" }}>
          {t("templates.noTemplates")}
        </div>
      )}

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
