"use client";

import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { loadMediaFromFile } from "@/lib/media/loadFile";
import { pickGradientPair } from "@/lib/media/palette";
import { backgroundPresets } from "@/lib/presets/presets";

interface BackgroundControlsProps {
  scenePalette: string[] | null;
  backgroundMode: string;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  backgroundBlur: number;
  setBackgroundSolid: (color: string) => void;
  setBackgroundGradient: (from: string, to: string, angle?: number) => void;
  setBackgroundTransparent: () => void;
  setBackgroundImage: (url: string) => void;
  setBackgroundBlur: (blur: number) => void;
}

export function BackgroundControls({
  scenePalette,
  backgroundMode,
  backgroundColor,
  gradientFrom,
  gradientTo,
  backgroundBlur,
  setBackgroundSolid,
  setBackgroundGradient,
  setBackgroundTransparent,
  setBackgroundImage,
  setBackgroundBlur
}: BackgroundControlsProps) {
  const t = useTranslations();

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
          const angles = [0, 45, 90, 135, 180];
          const angle = angles[Math.floor(Math.random() * angles.length)]!;
          setBackgroundGradient(from, to, angle);
        }}
      >
        {t("editor.autoBackground")}
      </button>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {backgroundPresets.map((preset) => {
          const active =
            (preset.kind === "transparent" && backgroundMode === "transparent") ||
            (preset.kind === "solid" && backgroundMode === "solid" && backgroundColor === preset.backgroundColor) ||
            (preset.kind === "gradient" &&
              backgroundMode === "gradient" &&
              gradientFrom === preset.gradientFrom &&
              gradientTo === preset.gradientTo);
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
      {backgroundMode === "image" ? (
        <>
          <label className="field">
            <span>{t("editor.bgBlurLabel", { val: backgroundBlur })}</span>
            <div className="range-wrap">
              <input type="range" min={0} max={40} step={1} value={backgroundBlur} aria-label={t("editor.bgBlurLabel", { val: backgroundBlur })} aria-valuetext={`${backgroundBlur}px`} onChange={(e) => setBackgroundBlur(Number(e.target.value))} />
              <span className="range-val">{backgroundBlur}px</span>
            </div>
          </label>
          <button type="button" className="btn btn-sm" onClick={() => setBackgroundTransparent()}>
            {t("editor.removeBgImage")}
          </button>
        </>
      ) : null}
    </div>
  );
}
