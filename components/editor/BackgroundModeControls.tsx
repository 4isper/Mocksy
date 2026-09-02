"use client";

import { useTranslations } from "next-intl";

interface BackgroundSolidControlsProps {
  backgroundColor: string;
  setBackgroundSolid: (color: string, coalesce?: boolean) => void;
}

export function BackgroundSolidControls({ backgroundColor, setBackgroundSolid }: BackgroundSolidControlsProps) {
  const t = useTranslations();
  return (
    <label className="color-input-row">
      <span>{t("editor.customColor")}</span>
      <input type="color" value={backgroundColor} onChange={(e) => setBackgroundSolid(e.target.value, true)} className="color-input" />
    </label>
  );
}

interface BackgroundGradientControlsProps {
  gradientFrom: string;
  gradientTo: string;
  gradientVia: string | null;
  gradientType: "linear" | "radial";
  gradientAngle: number;
  setBackgroundGradient: (from: string, to: string, angle?: number, gradientVia?: string | null, gradientType?: "linear" | "radial", coalesce?: boolean) => void;
  setGradientType: (gradientType: "linear" | "radial") => void;
  setGradientVia: (gradientVia: string | null, coalesce?: boolean) => void;
}

export function BackgroundGradientControls({
  gradientFrom,
  gradientTo,
  gradientVia,
  gradientType,
  gradientAngle,
  setBackgroundGradient,
  setGradientType,
  setGradientVia
}: BackgroundGradientControlsProps) {
  const t = useTranslations();
  return (
    <>
      <div role="radiogroup" aria-label={t("editor.gradientType")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="radio" name="grad-type" checked={gradientType === "linear"} onChange={() => setGradientType("linear")} />
          {t("editor.gradientLinear")}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="radio" name="grad-type" checked={gradientType === "radial"} onChange={() => setGradientType("radial")} />
          {t("editor.gradientRadial")}
        </label>
      </div>
      <div className="color-input-row">
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={gradientVia != null} onChange={(e) => setGradientVia(e.target.checked ? (gradientVia ?? "#ffffff") : null)} />
          {t("editor.gradientMiddle")}
        </label>
        <input
          type="color"
          value={gradientVia ?? "#ffffff"}
          disabled={gradientVia == null}
          aria-label={t("editor.gradientMiddle")}
          onChange={(e) => setGradientVia(e.target.value, true)}
          className="color-input"
        />
      </div>
      <label className="color-input-row">
        <span>{t("editor.gradientFrom")}</span>
        <input type="color" value={gradientFrom} onChange={(e) => setBackgroundGradient(e.target.value, gradientTo, gradientAngle, gradientVia, gradientType, true)} className="color-input" />
      </label>
      <label className="color-input-row">
        <span>{t("editor.gradientTo")}</span>
        <input type="color" value={gradientTo} onChange={(e) => setBackgroundGradient(gradientFrom, e.target.value, gradientAngle, gradientVia, gradientType, true)} className="color-input" />
      </label>
      {gradientType === "linear" ? (
        <label className="field">
          <span>{t("editor.gradientAngle", { val: gradientAngle })}</span>
          <div className="range-wrap">
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={gradientAngle}
              aria-label={t("editor.gradientAngle", { val: gradientAngle })}
              aria-valuetext={`${gradientAngle}°`}
              onChange={(e) => setBackgroundGradient(gradientFrom, gradientTo, Number(e.target.value), gradientVia, gradientType, true)}
            />
            <span className="range-val">{gradientAngle}°</span>
          </div>
        </label>
      ) : null}
    </>
  );
}

interface BackgroundImageControlsProps {
  backgroundBlur: number;
  setBackgroundBlur: (blur: number) => void;
  setBackgroundTransparent: () => void;
}

export function BackgroundImageControls({ backgroundBlur, setBackgroundBlur, setBackgroundTransparent }: BackgroundImageControlsProps) {
  const t = useTranslations();
  return (
    <>
      <label className="field">
        <span>{t("editor.bgBlurLabel", { val: backgroundBlur })}</span>
        <div className="range-wrap">
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={backgroundBlur}
            aria-label={t("editor.bgBlurLabel", { val: backgroundBlur })}
            aria-valuetext={`${backgroundBlur}px`}
            onChange={(e) => setBackgroundBlur(Number(e.target.value))}
          />
          <span className="range-val">{backgroundBlur}px</span>
        </div>
      </label>
      <button type="button" className="btn btn-sm" onClick={() => setBackgroundTransparent()}>
        {t("editor.removeBgImage")}
      </button>
    </>
  );
}
