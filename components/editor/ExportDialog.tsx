"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export type ExportFormat = "png" | "mp4" | "gif";

export function ExportDialog({
  open,
  onClose,
  scale,
  onScaleChange,
  onExport,
  onCopy,
  busy
}: {
  open: boolean;
  onClose: () => void;
  scale: 1 | 2 | 4;
  onScaleChange: (s: 1 | 2 | 4) => void;
  onExport: (format: ExportFormat) => void;
  onCopy: () => void;
  busy?: boolean;
}) {
  const t = useTranslations();
  const FORMATS: { value: ExportFormat; label: string }[] = [
    { value: "png", label: t("export.png") },
    { value: "mp4", label: t("export.mp4") },
    { value: "gif", label: t("export.gif") }
  ];
  const SCALES: { value: 1 | 2 | 4; label: string }[] = [
    { value: 1, label: t("export.scale1x") },
    { value: 2, label: t("export.scale2x") },
    { value: 4, label: t("export.scale4x") }
  ];
  const [format, setFormat] = useState<ExportFormat>("png");
  if (!open) return null;
  const formatLabel = t(`export.${format}`);
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="export-title">{t("export.title")}</h3>
        <div className="field-group">
          <label className="field">
            <span>{t("export.format")}</span>
            <div className="segmented" role="group" aria-label={t("export.format")}>
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={format === f.value}
                  className={format === f.value ? "is-active" : undefined}
                  onClick={() => setFormat(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </label>
          <label className="field">
            <span>{t("export.size")}</span>
            <div className="segmented" role="group" aria-label={t("export.size")}>
              {SCALES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={scale === s.value}
                  className={scale === s.value ? "is-active" : undefined}
                  onClick={() => onScaleChange(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </label>
        </div>
        <div className="modal-actions">
          {format === "png" ? (
            <button type="button" className="btn" onClick={onCopy} disabled={busy} title={t("shortcuts.copyPng")}>
              {t("export.copy")}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => onExport(format)}
            title={`Export ${formatLabel} (⌘E)`}
          >
            Export {formatLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
