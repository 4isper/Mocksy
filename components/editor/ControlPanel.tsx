"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
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

const FRAME_LABELS: Record<MockupFrame, string> = {
  none: "None",
  iphone: "iPhone",
  iphone15: "15",
  iphone16pro: "16 Pro",
  desktop: "Desktop",
  tablet: "Tablet",
  watch: "Watch"
};

const STYLE_LABELS: Record<StylePreset, string> = {
  default: "Default",
  glassLight: "Glass",
  glassDark: "Dark glass",
  outline: "Outline"
};

const ANIM_LABELS: Record<AnimationPreset, string> = {
  none: "None",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  parallax: "Parallax"
};

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
    setShadowOpacity,
    setBorderRadius,
    setBackgroundSolid,
    setBackgroundGradient,
    setBackgroundTransparent,
    setScenePalette,
    toggleWatermark,
    setWatermarkText,
    setWatermarkPosition,
    setWatermarkSize,
    setAspectRatio
  } = useEditorStore();

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
      else setMediaError("Could not load that file.");
    } finally {
      event.target.value = "";
    }
  };

  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];

  return (
    <div className="panel control-panel" style={{ padding: 16, display: "grid", gap: 16 }}>
      <h2 className="panel-title">Controls</h2>
      <div className="field-group">
        <div className="field">
          <span>Media</span>
          <label className="file-trigger">
            Upload image or video
            <input type="file" accept="image/*,video/*" onChange={handleFile} />
          </label>
          {activeLayer?.mediaUrl ? (
            <button
              type="button"
              className="btn btn-sm"
              title="Clear the active layer's media"
              onClick={() => setMedia(null, "none", null)}
            >
              Clear media
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
          label="Frame"
          value={scene.frame}
          options={frames.map((f) => ({ value: f, label: FRAME_LABELS[f] }))}
          onChange={setFrame}
        />
        <Segmented
          label="Aspect ratio"
          value={scene.aspectRatio}
          options={aspectRatios.map((r) => ({ value: r, label: r }))}
          onChange={setAspectRatio}
        />
        <Segmented
          label="Style"
          value={scene.stylePreset}
          options={styles.map((s) => ({ value: s, label: STYLE_LABELS[s] }))}
          onChange={setStylePreset}
        />
        <Segmented
          label="Animation"
          value={activeLayer?.animationPreset ?? "none"}
          options={animations.map((a) => ({ value: a, label: ANIM_LABELS[a] }))}
          onChange={setAnimationPreset}
        />
      </div>

      <div className="divider" />

      <div className="field-group">
        <label className="field">
          <span>Zoom</span>
          <input
            className="range"
            type="range"
            min={0.8}
            max={1.5}
            step={0.01}
            value={activeLayer?.zoom ?? 1}
            aria-label="Zoom"
            aria-valuetext={`${Math.round((activeLayer?.zoom ?? 1) * 100)}%`}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Position X</span>
          <input
            className="range"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={activeLayer?.mediaOffsetX ?? 0}
            aria-label="Media horizontal position"
            aria-valuetext={`${Math.round((activeLayer?.mediaOffsetX ?? 0) * 100)}%`}
            onChange={(e) => setMediaOffsetX(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Position Y</span>
          <input
            className="range"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={activeLayer?.mediaOffsetY ?? 0}
            aria-label="Media vertical position"
            aria-valuetext={`${Math.round((activeLayer?.mediaOffsetY ?? 0) * 100)}%`}
            onChange={(e) => setMediaOffsetY(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Shadow</span>
          <input
            className="range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={scene.shadowOpacity}
            aria-label="Shadow opacity"
            aria-valuetext={`${Math.round(scene.shadowOpacity * 100)}%`}
            onChange={(e) => setShadowOpacity(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Radius</span>
          <input
            className="range"
            type="range"
            min={0}
            max={48}
            step={1}
            value={scene.borderRadius}
            aria-label="Corner radius"
            aria-valuetext={`${scene.borderRadius} pixels`}
            onChange={(e) => setBorderRadius(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="divider" />

      <div className="field-group">
        <span style={{ color: "var(--text-dim)", fontSize: 12, fontWeight: 500 }}>Background</span>
        <button
          type="button"
          className="auto-bg-btn"
          disabled={!scenePalette || scenePalette.length < 1}
          title={
            scenePalette && scenePalette.length >= 1
              ? "Generate a gradient from the media's colors"
              : "Upload an image or video first"
          }
          onClick={() => {
            if (!scenePalette || scenePalette.length < 1) return;
            const [from, to] = pickGradientPair(scenePalette);
            setBackgroundGradient(from, to);
          }}
        >
          Auto from media
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
          <span>Watermark</span>
        </label>
        <label className="field">
          <span>Watermark text</span>
          <input value={scene.watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />
        </label>
        <label className="field">
          <span>Watermark position</span>
          <select
            className="select"
            value={scene.watermarkPosition}
            onChange={(e) => setWatermarkPosition(e.target.value as EditorScene["watermarkPosition"])}
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
          </select>
        </label>
        <label className="field">
          <span>Watermark size ({scene.watermarkSize}px)</span>
          <input
            className="range"
            type="range"
            min={8}
            max={64}
            step={1}
            value={scene.watermarkSize}
            aria-label="Watermark size"
            aria-valuetext={`${scene.watermarkSize} pixels`}
            onChange={(e) => setWatermarkSize(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
