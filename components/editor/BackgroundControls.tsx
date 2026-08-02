"use client";

import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { loadMediaFromFile } from "@/lib/media/loadFile";
import { pickBestSolid, pickGradientPair } from "@/lib/media/palette";
import { backgroundPresets } from "@/lib/presets/presets";
import type { PatternId } from "@/lib/types/editor";

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
    default:
      return "transparent";
  }
}

interface BackgroundControlsProps {
  scenePalette: string[] | null;
  backgroundMode: string;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientVia: string | null;
  gradientType: "linear" | "radial";
  gradientAngle: number;
  patternId: string | null;
  backgroundBlur: number;
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
      <div style={{ display: "flex", gap: 6 }}>
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
        <button
          type="button"
          className="auto-bg-btn"
          disabled={!scenePalette || scenePalette.length < 1}
          title={t("editor.autoSolidTooltip")}
          onClick={() => {
            if (!scenePalette || scenePalette.length < 1) return;
            setBackgroundSolid(pickBestSolid(scenePalette));
          }}
        >
          {t("editor.autoSolid")}
        </button>
      </div>
      {scenePalette && scenePalette.length > 0 ? (
        <>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{t("editor.mediaPalette")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {scenePalette.map((color) => (
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
        </>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {backgroundPresets.map((preset) => {
          const active =
            (preset.kind === "transparent" && backgroundMode === "transparent") ||
            (preset.kind === "solid" && backgroundMode === "solid" && backgroundColor === preset.backgroundColor) ||
            (preset.kind === "gradient" &&
              backgroundMode === "gradient" &&
              gradientFrom === preset.gradientFrom &&
              gradientTo === preset.gradientTo) ||
            (preset.kind === "pattern" && backgroundMode === "pattern" && patternId === preset.patternId);
          return (
            <button
              key={preset.id}
              type="button"
              title={t(`preset.${preset.id}`)}
              aria-pressed={active}
              onClick={() => {
                if (preset.kind === "transparent") setBackgroundTransparent();
                else if (preset.kind === "solid" && preset.backgroundColor) setBackgroundSolid(preset.backgroundColor);
                else if (preset.kind === "gradient" && preset.gradientFrom && preset.gradientTo)
                  setBackgroundGradient(preset.gradientFrom, preset.gradientTo, gradientAngle);
                else if (preset.kind === "pattern" && preset.patternId) setBackgroundPattern(preset.patternId);
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
                      : preset.kind === "pattern"
                        ? buildPatternSwatchStyle(preset.patternId!)
                        : preset.swatch
              }}
            />
          );
        })}
      </div>
      {backgroundMode === "solid" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
          <span>{t("editor.customColor")}</span>
          <input type="color" value={backgroundColor} onChange={(e) => setBackgroundSolid(e.target.value)}
            style={{ width: 32, height: 28, padding: 0, border: "1px solid var(--panel-border)", borderRadius: 6, cursor: "pointer", background: "none" }} />
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
            <input type="color" value={gradientFrom} onChange={(e) => setBackgroundGradient(e.target.value, gradientTo, gradientAngle, gradientVia ?? undefined, gradientType)}
              style={{ width: 32, height: 28, padding: 0, border: "1px solid var(--panel-border)", borderRadius: 6, cursor: "pointer", background: "none" }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span>{t("editor.gradientMiddle")}</span>
            <input type="color" value={gradientVia ?? "#ffffff"} onChange={(e) => setGradientVia(e.target.value)}
              style={{ width: 32, height: 28, padding: 0, border: "1px solid var(--panel-border)", borderRadius: 6, cursor: "pointer", background: "none" }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span>{t("editor.gradientTo")}</span>
            <input type="color" value={gradientTo} onChange={(e) => setBackgroundGradient(gradientFrom, e.target.value, gradientAngle, gradientVia ?? undefined, gradientType)}
              style={{ width: 32, height: 28, padding: 0, border: "1px solid var(--panel-border)", borderRadius: 6, cursor: "pointer", background: "none" }} />
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
