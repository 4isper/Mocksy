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

/** Tiny schematic preview of each layout preset so the buttons read at a
 *  glance instead of as bare words. */
function LayoutIcon({ layout }: { layout: (typeof layoutPresets)[number] }) {
  const rects: Array<[number, number, number, number]> =
    layout === "grid"
      ? [[1, 1, 9, 6], [12, 1, 9, 6], [1, 9, 9, 6], [12, 9, 9, 6]]
      : layout === "fan"
        ? [[6, 2, 8, 12], [1, 5, 7, 9], [16, 5, 7, 9]]
        : layout === "cascade"
          ? [[1, 1, 9, 7], [7, 6, 9, 7], [13, 11, 9, 7]]
          : layout === "masonry"
            ? [[1, 1, 9, 10], [12, 1, 9, 6], [1, 13, 9, 6], [12, 9, 9, 10]]
            : /* stack */
              [[1, 3, 10, 8], [6, 7, 10, 8], [11, 11, 10, 8]];
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden focusable="false">
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="1" fill="currentColor" opacity={0.85 - i * 0.08} />
      ))}
    </svg>
  );
}

export function FrameSection() {
  const t = useTranslations();
  const [expandedFrameId, setExpandedFrameId] = useState<string | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [layoutCount, setLayoutCount] = useState(2);
  const [countEdited, setCountEdited] = useState(false);
  const {
    scene,
    activeLayerId,
    activeFrameInstanceId,
    selectedFrameIds,
    setFrame,
    setCustomFrame,
    setFrameInstances,
    removeFrameInstance,
    addFrameInstance,
    reorderFrameInstances,
    updateFrameInstance,
    selectFrameInstance,
    selectFrameIds,
    toggleFrameSelected,
    layoutFrameGrid,
    applyFrameLayout,
    alignFrameInstances,
    distributeFrameInstances,
    setStylePreset,
      setAspectRatio,
      setBrowserUrl,
      setBrowserChromeTheme,
      setFrameMaterial,
      setCustomExportSize
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      activeLayerId: s.activeLayerId,
      activeFrameInstanceId: s.activeFrameInstanceId,
      selectedFrameIds: s.selectedFrameIds,
      setFrame: s.setFrame,
      setCustomFrame: s.setCustomFrame,
      setFrameInstances: s.setFrameInstances,
      removeFrameInstance: s.removeFrameInstance,
      addFrameInstance: s.addFrameInstance,
      reorderFrameInstances: s.reorderFrameInstances,
      updateFrameInstance: s.updateFrameInstance,
      selectFrameInstance: s.selectFrameInstance,
      selectFrameIds: s.selectFrameIds,
      toggleFrameSelected: s.toggleFrameSelected,
      layoutFrameGrid: s.layoutFrameGrid,
      applyFrameLayout: s.applyFrameLayout,
      alignFrameInstances: s.alignFrameInstances,
      distributeFrameInstances: s.distributeFrameInstances,
      setStylePreset: s.setStylePreset,
      setAspectRatio: s.setAspectRatio,
      setBrowserUrl: s.setBrowserUrl,
      setBrowserChromeTheme: s.setBrowserChromeTheme,
      setFrameMaterial: s.setFrameMaterial,
      setCustomExportSize: s.setCustomExportSize
    }))
  );

  // Until the user manually edits the count, it tracks the number of frames
  // already on the canvas so "apply layout" rearranges what's there instead of
  // a hardcoded 2 (which previously dropped distinct frames such as "none").
  const effectiveCount = countEdited ? layoutCount : Math.max(1, scene.frameInstances.length || 1);

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
        <div className="field field-row">
          <span className="text-dim-sm">{t("editor.frameGrid")}</span>
          <div className="field-row-full">
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
          <div className="field-row-full">
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
        <div className="field field-row">
          <span className="text-dim-sm">{t("editor.layoutLabel")}</span>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            {t("editor.layoutCount")}
            <input
              type="number"
              min={1}
              max={12}
              value={effectiveCount}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                setLayoutCount(Number.isFinite(n) ? Math.min(12, Math.max(1, n)) : 1);
                setCountEdited(true);
              }}
              className="frame-count-input"
              aria-label={t("editor.layoutCount")}
            />
          </label>
          <div className="field-row-full">
            {layoutPresets.map((layout) => {
              const disabled = scene.frameInstances.length === 0;
              const label = t(`editor.layout${layout.charAt(0).toUpperCase() + layout.slice(1)}`);
              return (
                <button
                  key={layout}
                  type="button"
                  className="btn btn-sm"
                  disabled={disabled}
                  title={disabled ? t("editor.layoutNeedsFrames") : label}
                  aria-label={label}
                  onClick={() => applyFrameLayout(scene.frame, effectiveCount, layout)}
                >
                  <LayoutIcon layout={layout} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="field field-row">
          <span className="text-dim-sm">{t("editor.alignLabel")}</span>
          <div className="field-row-full">
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
          selectFrameIds={selectFrameIds}
          toggleFrameSelected={toggleFrameSelected}
          selectedFrameIds={selectedFrameIds}
          setFrameInstances={setFrameInstances}
          updateFrameInstance={updateFrameInstance}
          removeFrameInstance={removeFrameInstance}
          addFrameInstance={addFrameInstance}
          reorderFrameInstances={reorderFrameInstances}
        />
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
