"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export type ExportFormat = "png" | "webp" | "svg" | "html" | "mp4" | "webm" | "gif" | "webpAnim";

/** Raster formats honor the 1×/2×/4× scale control; vector formats don't. */
const RASTER_FORMATS: ExportFormat[] = ["png", "webp", "mp4", "webm", "gif", "webpAnim"];

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
  const IMAGE_FORMATS: { value: ExportFormat; label: string }[] = [
    { value: "png", label: t("export.png") },
    { value: "webp", label: t("export.webp") },
    { value: "svg", label: t("export.svg") },
    { value: "html", label: t("export.html") }
  ];
  const VIDEO_FORMATS: { value: ExportFormat; label: string }[] = [
    { value: "mp4", label: t("export.mp4") },
    { value: "webm", label: t("export.webm") },
    { value: "gif", label: t("export.gif") },
    { value: "webpAnim", label: t("export.webpAnim") }
  ];
  const SCALES: { value: 1 | 2 | 4; label: string }[] = [
    { value: 1, label: t("export.scale1x") },
    { value: 2, label: t("export.scale2x") },
    { value: 4, label: t("export.scale4x") }
  ];
  const [format, setFormat] = useState<ExportFormat>("png");
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const formatLabel = t(`export.${format}`);
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal export"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="export-title">{t("export.title")}</h3>
        <div className="field-group">
          <label className="field">
            <span>{t("export.image")}</span>
            <div className="segmented" role="group" aria-label={t("export.image")}>
              {IMAGE_FORMATS.map((f) => (
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
            <span>{t("export.video")}</span>
            <div className="segmented" role="group" aria-label={t("export.video")}>
              {VIDEO_FORMATS.map((f) => (
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
          {RASTER_FORMATS.includes(format) ? (
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
          ) : null}
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
            title={t("export.exportActionShortcut", { format: formatLabel })}
          >
            {t("export.exportAction", { format: formatLabel })}
          </button>
        </div>
      </div>
    </div>
  );
}
