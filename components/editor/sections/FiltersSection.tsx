"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import type { BlendMode } from "@/lib/types/editor";
import { Section } from "@/components/editor/Section";
import { canRemoveBackground, cutoutMediaName, removeImageBackground } from "@/lib/media/backgroundRemoval";

const BLEND_MODE_OPTIONS: BlendMode[] = [
  "normal", "multiply", "screen", "overlay", "soft-light", "hard-light",
  "color-dodge", "color-burn", "difference", "exclusion", "hue", "saturation", "color", "luminosity"
];

function FilterSlider({
  label,
  value,
  min,
  max,
  suffix,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="range-wrap">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={`${value}${suffix}`}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="range-val">{value}{suffix}</span>
      </div>
    </label>
  );
}

export function FiltersSection() {
  const t = useTranslations();
  const {
    scene,
    activeLayerId,
    setBrightness,
    setContrast,
    setSaturate,
    setBlur,
    setGrayscale,
    setOpacity,
    setBlendMode,
    isRemovingBackground,
    setRemovingBackground,
    setMediaOnLayer,
    setMediaUploadError
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      activeLayerId: s.activeLayerId,
      setBrightness: s.setBrightness,
      setContrast: s.setContrast,
      setSaturate: s.setSaturate,
      setBlur: s.setBlur,
      setGrayscale: s.setGrayscale,
      setOpacity: s.setOpacity,
      setBlendMode: s.setBlendMode,
      isRemovingBackground: s.isRemovingBackground,
      setRemovingBackground: s.setRemovingBackground,
      setMediaOnLayer: s.setMediaOnLayer,
      setMediaUploadError: s.setMediaUploadError
    }))
  );

  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  // A locked layer rejects every edit; the controls say so instead of silently
  // doing nothing.
  const layerLocked = activeLayer?.locked === true;
  const eligible = canRemoveBackground(activeLayer);
  const [progress, setProgress] = useState<number | null>(null);

  const handleRemoveBackground = async () => {
    if (!activeLayer || !eligible || isRemovingBackground || activeLayer.id == null) return;
    const layerId = activeLayer.id;
    setRemovingBackground(true);
    setProgress(0);
    try {
      const cutoutUrl = await removeImageBackground(activeLayer.mediaUrl!, (p) => {
        if (typeof p.progress === "number") setProgress(Math.round(p.progress));
      });
      setMediaOnLayer(layerId, cutoutUrl, "image", cutoutMediaName(activeLayer.mediaName));
    } catch {
      setMediaUploadError(t("editor.removeBackgroundError"));
    } finally {
      setRemovingBackground(false);
      setProgress(null);
    }
  };

  return (
    <Section
      id="filters"
      defaultOpen={false}
      title={t("editor.filters")}
      icon={(
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M2 6h8M2 9h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="4.5" cy="3" r="1.2" fill="currentColor" opacity="0.5"/><circle cx="7.5" cy="6" r="1.2" fill="currentColor" opacity="0.5"/><circle cx="5" cy="9" r="1.2" fill="currentColor" opacity="0.5"/></svg>
      )}
    >
      <div className="field-group">
        {layerLocked ? <span role="status" style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.layerLockedHint")}</span> : null}
        <FilterSlider label={t("editor.filterBrightness", { val: Math.round(activeLayer?.brightness ?? 100) })} value={activeLayer?.brightness ?? 100} min={0} max={200} suffix="%" disabled={layerLocked} onChange={setBrightness} />
        <FilterSlider label={t("editor.filterContrast", { val: Math.round(activeLayer?.contrast ?? 100) })} value={activeLayer?.contrast ?? 100} min={0} max={200} suffix="%" disabled={layerLocked} onChange={setContrast} />
        <FilterSlider label={t("editor.filterSaturate", { val: Math.round(activeLayer?.saturate ?? 100) })} value={activeLayer?.saturate ?? 100} min={0} max={200} suffix="%" disabled={layerLocked} onChange={setSaturate} />
        <FilterSlider label={t("editor.filterBlur", { val: activeLayer?.blur ?? 0 })} value={activeLayer?.blur ?? 0} min={0} max={20} suffix="px" disabled={layerLocked} onChange={setBlur} />
        <FilterSlider label={t("editor.filterGrayscale", { val: Math.round(activeLayer?.grayscale ?? 0) })} value={activeLayer?.grayscale ?? 0} min={0} max={100} suffix="%" disabled={layerLocked} onChange={setGrayscale} />
        <FilterSlider label={t("editor.filterOpacity", { val: Math.round(activeLayer?.opacity ?? 100) })} value={activeLayer?.opacity ?? 100} min={0} max={100} suffix="%" disabled={layerLocked} onChange={setOpacity} />
        <label className="field">
          <span>{t("editor.blendMode")}</span>
          <select
            value={activeLayer?.blendMode ?? "normal"}
            disabled={layerLocked}
            aria-label={t("editor.blendMode")}
            onChange={(e) => setBlendMode(e.target.value as BlendMode)}
            style={{ width: "100%" }}
          >
            {BLEND_MODE_OPTIONS.map((value) => (
              <option key={value} value={value}>{t(`editor.blendMode_${value}`)}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-sm"
          disabled={layerLocked}
          onClick={() => {
            setBrightness(100);
            setContrast(100);
            setSaturate(100);
            setBlur(0);
            setGrayscale(0);
            setOpacity(100);
          }}
        >
          {t("editor.resetFilters")}
        </button>
        {eligible || isRemovingBackground ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={!eligible || isRemovingBackground || layerLocked}
            title={t("editor.removeBackgroundHint")}
            onClick={handleRemoveBackground}
          >
            {isRemovingBackground
              ? t("editor.removingBackground", { progress: progress ?? 0 })
              : t("editor.removeBackground")}
          </button>
        ) : null}
      </div>
    </Section>
  );
}
