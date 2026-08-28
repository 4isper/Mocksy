"use client";

import { useTranslations } from "next-intl";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import type { ChangeEvent } from "react";
import { useState } from "react";
import type { WatermarkPosition } from "@/lib/types/editor";

interface WatermarkControlsProps {
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkPosition: WatermarkPosition;
  watermarkSize: number;
  watermarkImageUrl: string | null;
  toggleWatermark: (checked: boolean) => void;
  setWatermarkText: (text: string) => void;
  setWatermarkPosition: (pos: WatermarkPosition) => void;
  setWatermarkSize: (size: number) => void;
  setWatermarkImage: (url: string | null) => void;
}

export function WatermarkControls({
  watermarkEnabled,
  watermarkText,
  watermarkPosition,
  watermarkSize,
  watermarkImageUrl,
  toggleWatermark,
  setWatermarkText,
  setWatermarkPosition,
  setWatermarkSize,
  setWatermarkImage
}: WatermarkControlsProps) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);

  const handleLogoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await loadMediaFromFile(file);
      setError(null);
      setWatermarkImage(url);
    } catch (err) {
      setError(err instanceof UnsupportedMediaError ? err.message : t("editor.watermarkLogoError"));
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="field-group">
      <label className="toggle">
        <input
          type="checkbox"
          checked={watermarkEnabled}
          onChange={(e) => toggleWatermark(e.target.checked)}
        />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.watermark")}</span>
      </label>
      <div className="field">
        <span>{t("editor.watermarkLogo")}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {watermarkImageUrl ? (
            <img
              src={watermarkImageUrl}
              alt={t("editor.watermarkLogoPreview")}
              className="watermark-logo-thumb"
              height={32}
            />
          ) : null}
          <label className="file-trigger" style={{ flex: 1 }}>
            {watermarkImageUrl ? t("editor.watermarkLogoReplace") : t("editor.watermarkLogoUpload")}
            <input type="file" accept="image/*" onChange={handleLogoFile} />
          </label>
          {watermarkImageUrl ? (
            <button type="button" className="btn btn-sm" onClick={() => setWatermarkImage(null)}>
              {t("editor.watermarkLogoRemove")}
            </button>
          ) : null}
        </div>
        {error ? (
          <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
            {error}
          </span>
        ) : null}
      </div>
      <label className="field">
        <span>{t("editor.watermarkText")}</span>
        <input value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />
      </label>
      <label className="field">
        <span>{t("editor.watermarkPosition")}</span>
        <select
          className="select"
          value={watermarkPosition}
          onChange={(e) => setWatermarkPosition(e.target.value as WatermarkPosition)}
        >
          <option value="bottom-right">{t("editor.posBottomRight")}</option>
          <option value="bottom-left">{t("editor.posBottomLeft")}</option>
          <option value="top-right">{t("editor.posTopRight")}</option>
          <option value="top-left">{t("editor.posTopLeft")}</option>
        </select>
      </label>
      <label className="field">
        <span>{t("editor.watermarkSize", { val: watermarkSize })}</span>
        <div className="range-wrap">
          <input type="range" min={8} max={64} step={1} value={watermarkSize} aria-label={t("editor.watermarkSize", { val: watermarkSize })} aria-valuetext={`${watermarkSize}px`} onChange={(e) => setWatermarkSize(Number(e.target.value))} />
          <span className="range-val">{watermarkSize}px</span>
        </div>
      </label>
    </div>
  );
}
