"use client";

import { useTranslations } from "next-intl";
import type { WatermarkPosition } from "@/lib/types/editor";

interface WatermarkControlsProps {
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkPosition: WatermarkPosition;
  watermarkSize: number;
  toggleWatermark: (checked: boolean) => void;
  setWatermarkText: (text: string) => void;
  setWatermarkPosition: (pos: WatermarkPosition) => void;
  setWatermarkSize: (size: number) => void;
}

export function WatermarkControls({
  watermarkEnabled,
  watermarkText,
  watermarkPosition,
  watermarkSize,
  toggleWatermark,
  setWatermarkText,
  setWatermarkPosition,
  setWatermarkSize
}: WatermarkControlsProps) {
  const t = useTranslations();

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
