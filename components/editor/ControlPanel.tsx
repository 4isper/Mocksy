"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import type { AnimationPreset, MockupFrame, StylePreset } from "@/lib/types/editor";
import { FRAME_ORDER } from "@/lib/render/frames";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { backgroundPresets } from "@/lib/presets/presets";
import { VideoOptions } from "@/components/editor/VideoOptions";

const frames: MockupFrame[] = FRAME_ORDER;
const styles: StylePreset[] = ["default", "glassLight", "glassDark", "outline"];
const animations: AnimationPreset[] = ["none", "zoomIn", "zoomOut", "parallax"];
const aspectRatios = ["16 / 9", "4 / 3", "3 / 2", "1 / 1", "9 / 16"];

export function ControlPanel() {
  const [mediaError, setMediaError] = useState<string | null>(null);
  const {
    scene,
    setMedia,
    setFrame,
    setStylePreset,
    setAnimationPreset,
    setZoom,
    setShadowOpacity,
    setBorderRadius,
    setBackgroundSolid,
    setBackgroundGradient,
    setBackgroundTransparent,
    toggleWatermark,
    setWatermarkText,
    setAspectRatio
  } = useEditorStore();

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = loadMediaFromFile(file);
      setMediaError(null);
      setMedia(url, mediaType, mediaName);
    } catch (err) {
      if (err instanceof UnsupportedMediaError) setMediaError(err.message);
      else setMediaError("Could not load that file.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="panel" style={{ padding: 16, display: "grid", gap: 16 }}>
      <h2 className="panel-title">Controls</h2>
      <div className="field-group">
        <div className="field">
          <span>Media</span>
          <input type="file" accept="image/*,video/*" onChange={handleFile} />
        </div>
        {mediaError ? (
          <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
            {mediaError}
          </span>
        ) : null}
        {scene.mediaType === "video" && <VideoOptions />}
      </div>

      <div className="divider" />

      <div className="field-group">
        <label className="field">
          <span>Frame</span>
          <select value={scene.frame} onChange={(e) => setFrame(e.target.value as MockupFrame)}>
            {frames.map((frame) => (
              <option key={frame} value={frame}>
                {frame}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Aspect ratio</span>
          <select value={scene.aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
            {aspectRatios.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Style</span>
          <select value={scene.stylePreset} onChange={(e) => setStylePreset(e.target.value as StylePreset)}>
            {styles.map((style) => (
              <option key={style} value={style}>
                {style}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Animation</span>
          <select value={scene.animationPreset} onChange={(e) => setAnimationPreset(e.target.value as AnimationPreset)}>
            {animations.map((anim) => (
              <option key={anim} value={anim}>
                {anim}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="divider" />

      <div className="field-group">
        <label className="field">
          <span>Zoom</span>
          <input type="range" min={0.8} max={1.5} step={0.01} value={scene.zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Shadow</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={scene.shadowOpacity}
            onChange={(e) => setShadowOpacity(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Radius</span>
          <input type="range" min={0} max={48} step={1} value={scene.borderRadius} onChange={(e) => setBorderRadius(Number(e.target.value))} />
        </label>
      </div>

      <div className="divider" />

      <div className="field-group">
        <span style={{ color: "var(--text-dim)", fontSize: 12, fontWeight: 500 }}>Background</span>
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
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={scene.watermarkEnabled} onChange={(e) => toggleWatermark(e.target.checked)} />
          <span>Watermark</span>
        </label>
        <label className="field">
          <span>Watermark text</span>
          <input value={scene.watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />
        </label>
      </div>
    </div>
  );
}
