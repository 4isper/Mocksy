"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import type { StylePreset } from "@/lib/types/editor";
import { ASPECT_RATIOS } from "@/lib/render/frames";
import { SOCIAL_PRESETS } from "@/lib/presets/socialPresets";
import { loadCustomFrameFromFile, UnsupportedFrameError } from "@/lib/media/customFrame";
import { Segmented } from "@/components/editor/Segmented";
import { FrameInstanceList } from "@/components/editor/FrameInstanceList";
import { FramePicker } from "@/components/editor/FramePicker";
import { Section } from "@/components/editor/Section";

const styles: StylePreset[] = ["default", "glassLight", "glassDark", "outline"];
const aspectRatios = ASPECT_RATIOS;
const layoutPresets = ["grid", "fan", "cascade", "masonry", "stack"] as const;
const alignModes = ["left", "centerX", "right", "top", "centerY", "bottom"] as const;

const ALIGN_GLYPHS: Record<(typeof alignModes)[number], string> = {
  left: "⇤",
  centerX: "↔",
  right: "⇥",
  top: "⇧",
  centerY: "↕",
  bottom: "⇩"
};

export function FrameSection() {
  const t = useTranslations();
  const [expandedFrameId, setExpandedFrameId] = useState<string | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const {
    scene,
    activeLayerId,
    setFrame,
    setCustomFrame,
    setFrameInstances,
    removeFrameInstance,
    updateFrameInstance,
    selectFrameInstance,
    layoutFrameGrid,
    applyFrameLayout,
    alignFrameInstances,
    distributeFrameInstances,
    setStylePreset,
    setAspectRatio,
    setBrowserUrl,
    setCustomExportSize
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      activeLayerId: s.activeLayerId,
      setFrame: s.setFrame,
      setCustomFrame: s.setCustomFrame,
      setFrameInstances: s.setFrameInstances,
      removeFrameInstance: s.removeFrameInstance,
      updateFrameInstance: s.updateFrameInstance,
      selectFrameInstance: s.selectFrameInstance,
      layoutFrameGrid: s.layoutFrameGrid,
      applyFrameLayout: s.applyFrameLayout,
      alignFrameInstances: s.alignFrameInstances,
      distributeFrameInstances: s.distributeFrameInstances,
      setStylePreset: s.setStylePreset,
      setAspectRatio: s.setAspectRatio,
      setBrowserUrl: s.setBrowserUrl,
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
        <div className="field" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.frameGrid")}</span>
          <div style={{ display: "flex", gap: 4, alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: 13 }}>↔</span>
            {[2, 3, 4].map((n) => (
              <button
                key={`h-${n}`}
                type="button"
                className="btn btn-sm"
                onClick={() => layoutFrameGrid(scene.frame, n, "horizontal")}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center", width: "100%" }}>
            <span style={{ fontSize: 13 }}>↕</span>
            {[2, 3, 4].map((n) => (
              <button
                key={`v-${n}`}
                type="button"
                className="btn btn-sm"
                onClick={() => layoutFrameGrid(scene.frame, n, "vertical")}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="field" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.layoutLabel")}</span>
          <div style={{ display: "flex", gap: 4, width: "100%" }}>
            {layoutPresets.map((layout) => {
              const disabled = scene.frameInstances.length === 0;
              return (
                <button
                  key={layout}
                  type="button"
                  className="btn btn-sm"
                  disabled={disabled}
                  title={disabled ? t("editor.layoutNeedsFrames") : t(`editor.layout${layout.charAt(0).toUpperCase() + layout.slice(1)}`)}
                  onClick={() => {
                    const count = Math.max(2, scene.frameInstances.length || 2);
                    applyFrameLayout(scene.frame, count, layout);
                  }}
                >
                  {t(`editor.layout${layout.charAt(0).toUpperCase() + layout.slice(1)}`)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.alignLabel")}</span>
          <div style={{ display: "flex", gap: 4, width: "100%" }}>
            {alignModes.map((mode) => {
              const disabled = scene.frameInstances.length < 2;
              return (
                <button
                  key={mode}
                  type="button"
                  className="btn btn-sm"
                  disabled={disabled}
                  title={disabled ? t("editor.layoutNeedsFrames") : t(`editor.align${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                  aria-label={t(`editor.align${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                  onClick={() => alignFrameInstances(mode)}
                >
                  {ALIGN_GLYPHS[mode]}
                </button>
              );
            })}
            <button
              type="button"
              className="btn btn-sm"
              disabled={scene.frameInstances.length < 3}
              title={scene.frameInstances.length < 3 ? t("editor.distributeNeedsFrames") : t("editor.distributeHorizontal")}
              aria-label={t("editor.distributeHorizontal")}
              onClick={() => distributeFrameInstances("horizontal")}
            >
              ⇔
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={scene.frameInstances.length < 3}
              title={scene.frameInstances.length < 3 ? t("editor.distributeNeedsFrames") : t("editor.distributeVertical")}
              aria-label={t("editor.distributeVertical")}
              onClick={() => distributeFrameInstances("vertical")}
            >
              ⇕
            </button>
          </div>
        </div>
        <FrameInstanceList
          scene={scene}
          expandedFrameId={expandedFrameId}
          setExpandedFrameId={setExpandedFrameId}
          selectFrameInstance={selectFrameInstance}
          setFrameInstances={setFrameInstances}
          updateFrameInstance={updateFrameInstance}
          removeFrameInstance={removeFrameInstance}
        />
        <Segmented
          label={t("editor.aspectRatio")}
          value={scene.aspectRatio}
          options={aspectRatios.map((r) => ({ value: r, label: r }))}
          onChange={setAspectRatio}
        />
        <div className="field" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.socialPresets")}</span>
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
