"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import type { StylePreset } from "@/lib/types/editor";
import { ASPECT_RATIOS, getFrameSpec } from "@/lib/render/frames";
import type { FrameMaterial } from "@/lib/types/editor";
import { SOCIAL_PRESETS } from "@/lib/presets/socialPresets";
import { loadCustomFrameFromFile, UnsupportedFrameError } from "@/lib/media/customFrame";
import { Segmented } from "@/components/editor/Segmented";
import { FramePicker } from "@/components/editor/FramePicker";
import { Section } from "@/components/editor/Section";

const styles: StylePreset[] = ["default", "glassLight", "glassDark", "outline"];
const aspectRatios = ASPECT_RATIOS;

export function FrameSection() {
  const t = useTranslations();
  const [frameError, setFrameError] = useState<string | null>(null);
  const {
    scene,
    activeFrameInstanceId,
    setFrame,
    setCustomFrame,
    setStylePreset,
    setAspectRatio,
    setBrowserUrl,
    setBrowserChromeTheme,
    setFrameMaterial,
    setCustomExportSize
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      activeFrameInstanceId: s.activeFrameInstanceId,
      setFrame: s.setFrame,
      setCustomFrame: s.setCustomFrame,
      setStylePreset: s.setStylePreset,
      setAspectRatio: s.setAspectRatio,
      setBrowserUrl: s.setBrowserUrl,
      setBrowserChromeTheme: s.setBrowserChromeTheme,
      setFrameMaterial: s.setFrameMaterial,
      setCustomExportSize: s.setCustomExportSize
    }))
  );

  const styleLabels: Record<StylePreset, string> = {
    default: t("style.default"),
    glassLight: t("style.glassLight"),
    glassDark: t("style.glassDark"),
    outline: t("style.outline")
  };

  const showBrowserUrl =
    scene.frame === "browser" || scene.frameInstances.some((inst) => inst.frame === "browser");

  const activeInst = activeFrameInstanceId
    ? scene.frameInstances.find((i) => i.id === activeFrameInstanceId)
    : undefined;
  const targetSpec = getFrameSpec(activeInst?.frame ?? scene.frame, scene.customFrame);
  const materials: FrameMaterial[] | null = targetSpec.materials
    ? ["graphite", "silver", "white"]
    : null;
  const materialValue: FrameMaterial = activeInst?.material ?? scene.frameMaterial ?? "graphite";

  return (
    <Section
      id="frame"
      title={t("editor.frame")}
      icon={(
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="2.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 2.5v7M1.5 5h9" stroke="currentColor" strokeWidth="0.8" opacity="0.45"/></svg>
      )}
    >
      <div className="field-group">
        <FramePicker
          value={scene.frame}
          onChange={setFrame}
          customFrame={scene.customFrame}
          onUploadCustom={async (file) => {
            try {
              setFrameError(null);
              setCustomFrame(await loadCustomFrameFromFile(file));
            } catch (err) {
              setFrameError(err instanceof UnsupportedFrameError ? err.message : String(err));
            }
          }}
          onRemoveCustom={() => setCustomFrame(null)}
        />
        {frameError ? <span className="field-error">{frameError}</span> : null}
        {showBrowserUrl ? (
          <label className="field">
            <span>{t("editor.browserUrl")}</span>
            <input
              value={scene.browserUrl}
              placeholder={t("editor.browserUrlPlaceholder")}
              onChange={(e) => setBrowserUrl(e.target.value)}
            />
          </label>
        ) : null}
        {showBrowserUrl ? (
          <Segmented
            label={t("editor.browserTheme")}
            value={scene.browserChromeTheme}
            options={[
              { value: "light", label: t("editor.browserThemeLight") },
              { value: "dark", label: t("editor.browserThemeDark") }
            ]}
            onChange={setBrowserChromeTheme}
          />
        ) : null}
        {materials ? (
          <Segmented
            label={t("editor.frameMaterial")}
            value={materialValue}
            options={materials.map((m) => ({ value: m, label: t(`editor.material.${m}`) }))}
            onChange={setFrameMaterial}
          />
        ) : null}
        <Segmented
          label={t("editor.aspectRatio")}
          value={scene.aspectRatio}
          options={aspectRatios.map((r) => ({ value: r, label: r }))}
          onChange={setAspectRatio}
        />
        <div className="field field-row">
          <span className="text-dim-sm">{t("editor.socialPresets")}</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: "100%" }}>
            {SOCIAL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="btn btn-sm"
                title={t("editor.socialTooltip", { ratio: preset.aspectRatio, width: preset.width, height: preset.height })}
                onClick={() => {
                  setAspectRatio(preset.aspectRatio);
                  setCustomExportSize({ width: preset.width, height: preset.height });
                }}
              >
                {t(`editor.social.${preset.id}`)}
              </button>
            ))}
          </div>
        </div>
        <Segmented
          label={t("editor.style")}
          value={scene.stylePreset}
          options={styles.map((s) => ({ value: s, label: styleLabels[s] }))}
          onChange={setStylePreset}
        />
      </div>
    </Section>
  );
}
