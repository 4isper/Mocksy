"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import type { AnimationPreset, EditorScene, MockupFrame, StylePreset } from "@/lib/types/editor";
import { FRAME_ORDER, ANIMATION_PRESETS, ASPECT_RATIOS } from "@/lib/render/frames";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { backgroundPresets } from "@/lib/presets/presets";
import { pickGradientPair } from "@/lib/media/palette";
import { VideoOptions } from "@/components/editor/VideoOptions";

const frames: MockupFrame[] = FRAME_ORDER;
const styles: StylePreset[] = ["default", "glassLight", "glassDark", "outline"];
const animations = ANIMATION_PRESETS;
const aspectRatios = ASPECT_RATIOS;

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            className={value === opt.value ? "is-active" : undefined}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </label>
  );
}

export function ControlPanel() {
  const t = useTranslations();
  const [mediaError, setMediaError] = useState<string | null>(null);
  const {
    scene,
    scenePalette,
    setMedia,
    setFrame,
    setStylePreset,
    setAnimationPreset,
    setZoom,
    setMediaOffsetX,
    setMediaOffsetY,
    setMediaFit,
    setShadowOpacity,
    setBorderRadius,
    setBackgroundSolid,
    setBackgroundGradient,
    setBackgroundTransparent,
    setBackgroundImage,
    setBackgroundBlur,
    setScenePalette,
    toggleWatermark,
    setWatermarkText,
    setWatermarkPosition,
    setWatermarkSize,
    setAspectRatio
  } = useEditorStore();

  const frameLabels: Record<MockupFrame, string> = {
    none: t("frame.none"),
    iphone: t("frame.iphone"),
    iphone15: t("frame.iphone15"),
    iphone16pro: t("frame.iphone16pro"),
    desktop: t("frame.desktop"),
    tablet: t("frame.tablet"),
    watch: t("frame.watch")
  };
  const styleLabels: Record<StylePreset, string> = {
    default: t("style.default"),
    glassLight: t("style.glassLight"),
    glassDark: t("style.glassDark"),
    outline: t("style.outline")
  };
  const animLabels: Record<AnimationPreset, string> = {
    none: t("animation.none"),
    zoomIn: t("animation.zoomIn"),
    zoomOut: t("animation.zoomOut"),
    parallax: t("animation.parallax")
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setMediaError(null);
      // Drop any palette from the previous media; a fresh one is computed once
      // the new file decodes in the preview.
      setScenePalette(null);
      setMedia(url, mediaType, mediaName);
    } catch (err) {
      if (err instanceof UnsupportedMediaError) setMediaError(err.message);
      else setMediaError(t("editor.uploadError"));
    } finally {
      event.target.value = "";
    }
  };

  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];

  const handleBgFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await loadMediaFromFile(file);
      setBackgroundImage(url);
    } catch {
      // Background images are images only; ignore unsupported files silently
      // rather than surfacing the media-error banner here.
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="panel control-panel" style={{ padding: 16, display: "grid", gap: 16 }}>
      <h2 className="panel-title">{t("editor.controls")}</h2>
      <div className="field-group">
        <div className="field">
          <span>{t("editor.media")}</span>
          <label className="file-trigger">
            {t("editor.uploadMediaShort")}
            <input type="file" accept="image/*,video/*" onChange={handleFile} />
          </label>
          {activeLayer?.mediaUrl ? (
            <button
              type="button"
              className="btn btn-sm"
              title={t("editor.clearMedia")}
              onClick={() => setMedia(null, "none", null)}
            >
              {t("editor.clearMedia")}
            </button>
          ) : null}
        </div>
        {mediaError ? (
          <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
            {mediaError}
          </span>
        ) : null}
        {activeLayer && isVideoLayer(activeLayer) && <VideoOptions />}
      </div>

      <div className="divider" />

      <div className="field-group">
        <Segmented
          label={t("editor.frame")}
          value={scene.frame}
          options={frames.map((f) => ({ value: f, label: frameLabels[f] }))}
          onChange={setFrame}
        />
        <Segmented
          label={t("editor.aspectRatio")}
          value={scene.aspectRatio}
          options={aspectRatios.map((r) => ({ value: r, label: r }))}
          onChange={setAspectRatio}
        />
        <Segmented
          label={t("editor.style")}
          value={scene.stylePreset}
          options={styles.map((s) => ({ value: s, label: styleLabels[s] }))}
          onChange={setStylePreset}
        />
        <Segmented
          label={t("editor.animation")}
          value={activeLayer?.animationPreset ?? "none"}
          options={animations.map((a) => ({ value: a, label: animLabels[a] }))}
          onChange={setAnimationPreset}
        />
      </div>

      <div className="divider" />

      <div className="field-group">
        <Segmented
          label={t("editor.fillFitLabel")}
          value={activeLayer?.mediaFit ?? "cover"}
          options={[
            { value: "cover", label: t("editor.fill") },
            { value: "contain", label: t("editor.fit") }
          ]}
          onChange={setMediaFit}
        />
        <label className="field">
          <span>{t("editor.zoom")}</span>
          <input
            className="range"
            type="range"
            min={0.8}
            max={1.5}
            step={0.01}
            value={activeLayer?.zoom ?? 1}
            aria-label={t("editor.zoom")}
            aria-valuetext={`${Math.round((activeLayer?.zoom ?? 1) * 100)}%`}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>{t("editor.positionX")}</span>
          <input
            className="range"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={activeLayer?.mediaOffsetX ?? 0}
            aria-label={t("editor.positionX")}
            aria-valuetext={`${Math.round((activeLayer?.mediaOffsetX ?? 0) * 100)}%`}
            onChange={(e) => setMediaOffsetX(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>{t("editor.positionY")}</span>
          <input
            className="range"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={activeLayer?.mediaOffsetY ?? 0}
            aria-label={t("editor.positionY")}
            aria-valuetext={`${Math.round((activeLayer?.mediaOffsetY ?? 0) * 100)}%`}
            onChange={(e) => setMediaOffsetY(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>{t("editor.shadowOpacity")}</span>
          <input
            className="range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={scene.shadowOpacity}
            aria-label={t("editor.shadowOpacity")}
            aria-valuetext={`${Math.round(scene.shadowOpacity * 100)}%`}
            onChange={(e) => setShadowOpacity(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>{t("editor.cornerRadius")}</span>
          <input
            className="range"
            type="range"
            min={0}
            max={48}
            step={1}
            value={scene.borderRadius}
            aria-label={t("editor.cornerRadius")}
            aria-valuetext={`${scene.borderRadius} pixels`}
            onChange={(e) => setBorderRadius(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="divider" />

      <div className="field-group">
        <span style={{ color: "var(--text-dim)", fontSize: 12, fontWeight: 500 }}>{t("editor.background")}</span>
        <button
          type="button"
          className="auto-bg-btn"
          disabled={!scenePalette || scenePalette.length < 1}
          title={
            scenePalette && scenePalette.length >= 1
              ? t("editor.autoBgTooltip")
              : t("editor.autoBgDisabled")
          }
          onClick={() => {
            if (!scenePalette || scenePalette.length < 1) return;
            const [from, to] = pickGradientPair(scenePalette);
            setBackgroundGradient(from, to);
          }}
        >
          {t("editor.autoBackground")}
        </button>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {backgroundPresets.map((preset) => {
            const active =
              (preset.kind === "transparent" && scene.backgroundMode === "transparent") ||
              (preset.kind === "solid" && scene.backgroundMode === "solid" && scene.backgroundColor === preset.backgroundColor) ||
              (preset.kind === "gradient" &&
                scene.backgroundMode === "gradient" &&
                scene.gradientFrom === preset.gradientFrom &&
                scene.gradientTo === preset.gradientTo);
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.name}
                aria-pressed={active}
                onClick={() => {
                  if (preset.kind === "transparent") setBackgroundTransparent();
                  else if (preset.kind === "solid" && preset.backgroundColor) setBackgroundSolid(preset.backgroundColor);
                  else if (preset.kind === "gradient" && preset.gradientFrom && preset.gradientTo)
                    setBackgroundGradient(preset.gradientFrom, preset.gradientTo);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: active ? "2px solid var(--accent)" : "1px solid var(--panel-border)",
                  background:
                    preset.swatch === "transparent"
                      ? "repeating-conic-gradient(#3f3f46 0% 25%, #18181b 0% 50%) 50% / 12px 12px"
                      : preset.kind === "gradient"
                        ? `linear-gradient(135deg, ${preset.gradientFrom}, ${preset.gradientTo})`
                        : preset.swatch
                }}
              />
            );
          })}
        </div>
        <label className="file-trigger">
          {t("editor.uploadBgImage")}
          <input type="file" accept="image/*" onChange={handleBgFile} />
        </label>
        {scene.backgroundMode === "image" ? (
          <>
            <label className="field">
              <span>{t("editor.bgBlurLabel", { val: scene.backgroundBlur })}</span>
              <input
                className="range"
                type="range"
                min={0}
                max={40}
                step={1}
                value={scene.backgroundBlur}
                aria-label={t("editor.bgBlurLabel", { val: scene.backgroundBlur })}
                aria-valuetext={`${scene.backgroundBlur} pixels`}
                onChange={(e) => setBackgroundBlur(Number(e.target.value))}
              />
            </label>
            <button type="button" className="btn btn-sm" onClick={() => setBackgroundTransparent()}>
              {t("editor.removeBgImage")}
            </button>
          </>
        ) : null}
      </div>

      <div className="divider" />

      <div className="field-group">
        <label className="toggle">
          <input
            type="checkbox"
            checked={scene.watermarkEnabled}
            onChange={(e) => toggleWatermark(e.target.checked)}
          />
          <span className="track" aria-hidden="true" />
          <span>{t("editor.watermark")}</span>
        </label>
        <label className="field">
          <span>{t("editor.watermarkText")}</span>
          <input value={scene.watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("editor.watermarkPosition")}</span>
          <select
            className="select"
            value={scene.watermarkPosition}
            onChange={(e) => setWatermarkPosition(e.target.value as EditorScene["watermarkPosition"])}
          >
            <option value="bottom-right">{t("editor.posBottomRight")}</option>
            <option value="bottom-left">{t("editor.posBottomLeft")}</option>
            <option value="top-right">{t("editor.posTopRight")}</option>
            <option value="top-left">{t("editor.posTopLeft")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("editor.watermarkSize", { val: scene.watermarkSize })}</span>
          <input
            className="range"
            type="range"
            min={8}
            max={64}
            step={1}
            value={scene.watermarkSize}
            aria-label={t("editor.watermarkSize", { val: scene.watermarkSize })}
            aria-valuetext={`${scene.watermarkSize} pixels`}
            onChange={(e) => setWatermarkSize(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
