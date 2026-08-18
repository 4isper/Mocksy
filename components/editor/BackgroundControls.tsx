"use client";

import type { ChangeEvent, CSSProperties } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/editor/Segmented";
import { loadMediaFromFile } from "@/lib/media/loadFile";
import { pickBestSolid, pickGradientPair } from "@/lib/media/palette";
import { backgroundPresets } from "@/lib/presets/presets";
import type { BackgroundMode, PatternId } from "@/lib/types/editor";

function buildPatternSwatchStyle(patternId: PatternId): string {
  switch (patternId) {
    case "dots":
      return `radial-gradient(circle, rgba(255,255,255,0.25) 1.5px, transparent 1.5px)`;
    case "grid":
      return `repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 10px), repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 10px)`;
    case "diagonal":
      return `repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 10px)`;
    case "noise": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="60" height="60" filter="url(%23n)" opacity="0.25"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    case "plus": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M9 4h2v5h5v2h-5v5h-2v-5h-5v-2h5z" fill="rgba(255,255,255,0.25)"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    case "cross": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M6 6l8 8M14 6l-8 8" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-linecap="round"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    case "triangle": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M5 0L10 20H0zM15 20L10 0h10z" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    default:
      return "transparent";
  }
}

const MODE_ORDER: BackgroundMode[] = ["solid", "gradient", "pattern", "image", "transparent"];

const COLOR_INPUT_STYLE: CSSProperties = {
  width: 32,
  height: 28,
  padding: 0,
  border: "1px solid var(--panel-border)",
  borderRadius: 6,
  cursor: "pointer",
  background: "none"
};

interface BackgroundControlsProps {
  scenePalette: string[] | null;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientVia: string | null;
  gradientType: "linear" | "radial";
  gradientAngle: number;
  patternId: PatternId | null;
  backgroundBlur: number;
  backgroundImageUrl: string | null;
  setBackgroundSolid: (color: string) => void;
  setBackgroundGradient: (from: string, to: string, angle?: number, gradientVia?: string, gradientType?: "linear" | "radial") => void;
  setBackgroundTransparent: () => void;
  setBackgroundImage: (url: string) => void;
  setBackgroundPattern: (patternId: PatternId) => void;
  setGradientType: (gradientType: "linear" | "radial") => void;
  setGradientVia: (gradientVia: string) => void;
  setBackgroundBlur: (blur: number) => void;
}

export function BackgroundControls({
  scenePalette,
  backgroundMode,
  backgroundColor,
  gradientFrom,
  gradientTo,
  gradientVia,
  gradientType,
  gradientAngle,
  patternId,
  backgroundBlur,
  backgroundImageUrl,
  setBackgroundSolid,
  setBackgroundGradient,
  setBackgroundTransparent,
  setBackgroundImage,
  setBackgroundPattern,
  setGradientType,
  setGradientVia,
  setBackgroundBlur
}: BackgroundControlsProps) {
  const t = useTranslations();

  const hasPalette = scenePalette != null && scenePalette.length > 0;
  const [error, setError] = useState<string | null>(null);

  const handleBgFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await loadMediaFromFile(file);
      setError(null);
      setBackgroundImage(url);
    } catch {
      setError(t("editor.bgUploadError"));
    } finally {
      event.target.value = "";
    }
  };

  const modeLabels: Record<BackgroundMode, string> = {
    solid: t("editor.bgModeSolid"),
    gradient: t("editor.bgModeGradient"),
    pattern: t("editor.bgModePattern"),
    image: t("editor.bgModeImage"),
    transparent: t("editor.bgModeTransparent")
  };

  const handleModeChange = (mode: BackgroundMode) => {
    if (mode === backgroundMode) return;
    switch (mode) {
      case "solid":
        setBackgroundSolid(backgroundColor);
        break;
      case "gradient":
        setBackgroundGradient(gradientFrom, gradientTo, gradientAngle, gradientVia ?? undefined, gradientType);
        break;
      case "pattern":
        setBackgroundPattern(patternId ?? "dots");
        break;
      case "image":
        // Without an uploaded image there is nothing to switch to; surface a
        // hint instead of silently doing nothing.
        if (backgroundImageUrl) setBackgroundImage(backgroundImageUrl);
        else setError(t("editor.bgNeedImage"));
        break;
      case "transparent":
        setBackgroundTransparent();
        break;
    }
  };

  const showPresetGrid =
    backgroundMode === "solid" || backgroundMode === "gradient" || backgroundMode === "pattern";

  return (
    <div className="field-group">
      <Segmented value={backgroundMode} options={MODE_ORDER.map((m) => ({ value: m, label: modeLabels[m] }))} onChange={handleModeChange} />

      {showPresetGrid ? (
        <div className="bg-preset-group">
          <span className="field-label">{t("editor.bgPresets")}</span>
          <div className="bg-swatches">
            {backgroundPresets
              .filter((preset) => preset.kind === backgroundMode)
              .map((preset) => {
                const active =
                  (preset.kind === "solid" && backgroundColor === preset.backgroundColor) ||
                  (preset.kind === "gradient" &&
                    gradientFrom === preset.gradientFrom &&
                    gradientTo === preset.gradientTo) ||
                  (preset.kind === "pattern" && patternId === preset.patternId);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className="swatch-btn"
                    title={t(`preset.${preset.id}`)}
                    aria-pressed={active}
                    onClick={() => {
                      if (preset.kind === "solid" && preset.backgroundColor) setBackgroundSolid(preset.backgroundColor);
                      else if (preset.kind === "gradient" && preset.gradientFrom && preset.gradientTo)
                        setBackgroundGradient(preset.gradientFrom, preset.gradientTo, gradientAngle);
                      else if (preset.kind === "pattern" && preset.patternId) setBackgroundPattern(preset.patternId);
                    }}
                    style={{
                      background:
                        preset.kind === "gradient"
                          ? `linear-gradient(135deg, ${preset.gradientFrom}, ${preset.gradientTo})`
                          : preset.kind === "pattern"
                            ? buildPatternSwatchStyle(preset.patternId!)
                            : preset.swatch,
                      border: active ? "2px solid var(--accent)" : undefined
                    }}
                  />
                );
              })}
          </div>
        </div>
      ) : null}

      {backgroundMode === "solid" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
          <span>{t("editor.customColor")}</span>
          <input type="color" value={backgroundColor} onChange={(e) => setBackgroundSolid(e.target.value)} style={COLOR_INPUT_STYLE} />
        </label>
      ) : null}

      {backgroundMode === "gradient" ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="radio" name="grad-type" checked={gradientType === "linear"} onChange={() => setGradientType("linear")} />
              {t("editor.gradientLinear")}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="radio" name="grad-type" checked={gradientType === "radial"} onChange={() => setGradientType("radial")} />
              {t("editor.gradientRadial")}
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span>{t("editor.gradientFrom")}</span>
            <input type="color" value={gradientFrom} onChange={(e) => setBackgroundGradient(e.target.value, gradientTo, gradientAngle, gradientVia ?? undefined, gradientType)} style={COLOR_INPUT_STYLE} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span>{t("editor.gradientMiddle")}</span>
            <input type="color" value={gradientVia ?? "#ffffff"} onChange={(e) => setGradientVia(e.target.value)} style={COLOR_INPUT_STYLE} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span>{t("editor.gradientTo")}</span>
            <input type="color" value={gradientTo} onChange={(e) => setBackgroundGradient(gradientFrom, e.target.value, gradientAngle, gradientVia ?? undefined, gradientType)} style={COLOR_INPUT_STYLE} />
          </label>
          <label className="field">
            <span>{t("editor.gradientAngle", { val: gradientAngle })}</span>
            <div className="range-wrap">
              <input type="range" min={0} max={360} step={1} value={gradientAngle} aria-label={t("editor.gradientAngle", { val: gradientAngle })} aria-valuetext={`${gradientAngle}°`} onChange={(e) => setBackgroundGradient(gradientFrom, gradientTo, Number(e.target.value), gradientVia ?? undefined, gradientType)} />
              <span className="range-val">{gradientAngle}°</span>
            </div>
          </label>
        </>
      ) : null}

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

      <div className="bg-media-group">
        <span className="field-label">{t("editor.bgFromMedia")}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="auto-bg-btn"
            disabled={!hasPalette}
            title={hasPalette ? t("editor.autoBgTooltip") : t("editor.autoBgDisabled")}
            onClick={() => {
              if (!hasPalette) return;
              const [from, to] = pickGradientPair(scenePalette!);
              // Cycle through a fixed set of angles so repeated clicks are
              // predictable instead of jumping to a random angle each time.
              const angles = [0, 45, 90, 135, 180];
              const currentIndex = angles.indexOf(gradientAngle);
              const angle = angles[(currentIndex + 1) % angles.length]!;
              setBackgroundGradient(from, to, angle);
            }}
          >
            {t("editor.autoBackground")}
          </button>
          <button
            type="button"
            className="auto-bg-btn"
            disabled={!hasPalette}
            title={t("editor.autoSolidTooltip")}
            onClick={() => {
              if (!hasPalette) return;
              setBackgroundSolid(pickBestSolid(scenePalette!));
            }}
          >
            {t("editor.autoSolid")}
          </button>
        </div>
        {hasPalette ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {scenePalette!.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={backgroundMode === "solid" && backgroundColor === color}
                title={color}
                onClick={() => setBackgroundSolid(color)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: backgroundMode === "solid" && backgroundColor === color
                    ? "2px solid var(--accent)" : "1px solid var(--panel-border)",
                  background: color
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <label className="file-trigger">
        {t("editor.uploadBgImage")}
        <input type="file" accept="image/*" onChange={handleBgFile} />
      </label>
      {error ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
