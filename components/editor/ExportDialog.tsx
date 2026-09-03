"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import type { ExportSize } from "@/lib/types/editor";
import { useExportPresetsStore } from "@/lib/state/exportPresetsStore";
import { PLATFORM_PRESETS, closestAspectRatio } from "@/lib/export/platformPresets";

export type { ExportFormat } from "@/lib/types/editor";
import type { ExportFormat } from "@/lib/types/editor";

/** Image raster formats honor the 1×/2×/4× scale control (and custom size);
 *  video, batch, and vector formats don't. */
const IMAGE_SCALE_FORMATS: ExportFormat[] = ["png", "jpeg", "webp", "avif"];

/** Fallback size offered when the user first enables the custom-size option. */
const DEFAULT_CUSTOM_SIZE: ExportSize = { width: 1280, height: 720 };

export function ExportDialog({
  open,
  onClose,
  scale,
  onScaleChange,
  customSize,
  onCustomSizeChange,
  onExport,
  onCopy,
  onCopyJpeg,
  onCopyWebp,
  onCopySvg,
  onCopyHtml,
  busy,
  onCancel,
  isMultiFrame = false,
  onAspectRatioChange
}: {
  open: boolean;
  onClose: () => void;
  scale: 1 | 2 | 4;
  onScaleChange: (s: 1 | 2 | 4) => void;
  customSize: ExportSize | null;
  onCustomSizeChange: (size: ExportSize | null) => void;
  onExport: (format: ExportFormat) => void;
  onCopy: () => void;
  onCopyJpeg?: () => void;
  onCopyWebp?: () => void;
  onCopySvg?: () => void;
  onCopyHtml?: () => void;
  busy?: boolean;
  onCancel?: () => void;
  /** When true (multi-frame mode), offers the per-frame ZIP batch export. */
  isMultiFrame?: boolean;
  /** Applies the scene aspect ratio closest to a platform preset's proportion. */
  onAspectRatioChange?: (aspectRatio: string) => void;
}) {
  const t = useTranslations();
  const IMAGE_FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
    { value: "png", label: t("export.png"), hint: t("export.hint.png") },
    { value: "jpeg", label: t("export.jpeg"), hint: t("export.hint.jpeg") },
    { value: "webp", label: t("export.webp"), hint: t("export.hint.webp") },
    { value: "avif", label: t("export.avif"), hint: t("export.hint.avif") },
    ...(isMultiFrame ? [{ value: "zip" as ExportFormat, label: t("export.zip"), hint: t("export.hint.zip") }] : []),
    { value: "svg", label: t("export.svg"), hint: t("export.hint.svg") },
    { value: "html", label: t("export.html"), hint: t("export.hint.html") },
    { value: "pdf", label: t("export.pdf"), hint: t("export.hint.pdf") }
  ];
  const VIDEO_FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
    { value: "mp4", label: t("export.mp4"), hint: t("export.hint.mp4") },
    { value: "webm", label: t("export.webm"), hint: t("export.hint.webm") },
    ...(isMultiFrame ? [{ value: "zipVideo" as ExportFormat, label: t("export.zipVideo"), hint: t("export.hint.zipVideo") }] : []),
    { value: "gif", label: t("export.gif"), hint: t("export.hint.gif") },
    { value: "webpAnim", label: t("export.webpAnim"), hint: t("export.hint.webpAnim") }
  ];
  const SCALES: { value: 1 | 2 | 4 | "custom"; label: string }[] = [
    { value: 1, label: t("export.scale1x") },
    { value: 2, label: t("export.scale2x") },
    { value: 4, label: t("export.scale4x") },
    { value: "custom", label: t("export.custom") }
  ];
  const [format, setFormat] = useState<ExportFormat>("png");
  const trapRef = useFocusTrap(open);
  const presets = useExportPresetsStore((s) => s.presets);
  const savePreset = useExportPresetsStore((s) => s.savePreset);
  const removePreset = useExportPresetsStore((s) => s.removePreset);

  const isCustom = customSize !== null;
  const activeScale: 1 | 2 | 4 | "custom" = isCustom ? "custom" : scale;
  // The store always mirrors the input values (every change round-trips through
  // onCustomSizeChange), so the inputs are fully controlled by `customSize`.
  const size = customSize ?? DEFAULT_CUSTOM_SIZE;
  const sizeMp = (size.width * size.height) / 1_000_000;
  const sizeMpLabel = sizeMp >= 10 ? String(Math.round(sizeMp)) : sizeMp.toFixed(1);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Closing never cancels a running export: progress and the cancel
      // button stay visible in the toolbar, so Esc/backdrop/× just dismiss
      // the dialog while the job continues in the background.
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
        <div className="export-head">
          <h3 id="export-title">{t("export.title")}</h3>
          <button
            type="button"
            className="btn-tb btn-tb-icon export-close"
            onClick={onClose}
            title={t("shortcuts.close")}
            aria-label={t("shortcuts.close")}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="field-group">
          {presets.length > 0 ? (
            <label className="field">
              <span>{t("export.presets")}</span>
              <div className="segmented" role="group" aria-label={t("export.presets")}>
                {presets.map((preset) => (
                  <span key={preset.id} style={{ display: "inline-flex", gap: 4, flex: "1 1 auto", minWidth: 0 }}>
                    <button
                      type="button"
                      title={t("export.applyPreset", { label: preset.label })}
                      onClick={() => {
                        setFormat(preset.format);
                        if (preset.customSize) {
                          onCustomSizeChange({ ...preset.customSize });
                        } else {
                          onScaleChange(preset.scale);
                          onCustomSizeChange(null);
                        }
                      }}
                    >
                      {preset.label}
                    </button>
                    <button
                      type="button"
                      aria-label={t("export.deletePreset", { label: preset.label })}
                      title={t("export.deletePreset", { label: preset.label })}
                      onClick={() => removePreset(preset.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button type="button" onClick={() => savePreset(format, scale, customSize)}>
                  + {t("export.savePreset")}
                </button>
              </div>
            </label>
          ) : (
            <label className="field">
              <span>{t("export.presets")}</span>
              <div className="segmented" role="group" aria-label={t("export.presets")}>
                <button type="button" onClick={() => savePreset(format, scale, customSize)}>
                  + {t("export.savePreset")}
                </button>
              </div>
            </label>
          )}
          <label className="field">
            <span>{t("export.image")}</span>
            <div className="segmented" role="group" aria-label={t("export.image")}>
              {IMAGE_FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={format === f.value}
                  className={format === f.value ? "is-active" : undefined}
                  title={f.hint}
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
                  title={f.hint}
                  onClick={() => setFormat(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </label>
          <p className="field-hint" role="status">{t(`export.hint.${format}`)}</p>
          {IMAGE_SCALE_FORMATS.includes(format) ? (
            <label className="field">
              <span>{t("export.size")}</span>
              <div className="segmented" role="group" aria-label={t("export.size")}>
                {SCALES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={activeScale === s.value}
                    className={activeScale === s.value ? "is-active" : undefined}
                    onClick={() => {
                      if (s.value === "custom") {
                        if (!isCustom) onCustomSizeChange({ ...DEFAULT_CUSTOM_SIZE });
                      } else {
                        onScaleChange(s.value);
                        onCustomSizeChange(null);
                      }
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {activeScale === "custom" ? (
                <>
                  <div className="custom-size">
                    <input
                      type="number"
                      min={1}
                      max={8192}
                      value={size.width}
                      aria-label={t("export.width")}
                      onChange={(e) => {
                        const width = Math.max(1, Math.min(8192, Math.round(Number(e.target.value) || 0)));
                        onCustomSizeChange({ width, height: size.height });
                      }}
                    />
                    <span aria-hidden="true">×</span>
                    <input
                      type="number"
                      min={1}
                      max={8192}
                      value={size.height}
                      aria-label={t("export.height")}
                      onChange={(e) => {
                        const height = Math.max(1, Math.min(8192, Math.round(Number(e.target.value) || 0)));
                        onCustomSizeChange({ width: size.width, height });
                      }}
                    />
                  </div>
                  <p className="field-hint" role="status">
                    {size.width}×{size.height} · {closestAspectRatio(size.width, size.height)} · {sizeMpLabel} MP
                  </p>
                </>
              ) : null}
              <p className="field-hint">{t("export.platformAspectNote")}</p>
              <div className="segmented" role="group" aria-label={t("export.platformPresets")}>
                {PLATFORM_PRESETS.map((p) => {
                  const active = isCustom && size.width === p.width && size.height === p.height;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={active}
                      className={active ? "is-active" : undefined}
                      title={t("export.platformHint", { label: t(`export.platform.${p.id}`), width: p.width, height: p.height })}
                      onClick={() => {
                        onCustomSizeChange({ width: p.width, height: p.height });
                        onAspectRatioChange?.(closestAspectRatio(p.width, p.height));
                      }}
                    >
                      {t(`export.platform.${p.id}`)}
                    </button>
                  );
                })}
              </div>
            </label>
          ) : null}
        </div>
        <div className="modal-actions">
          {format === "png" ? (
            <button type="button" className="btn" onClick={onCopy} disabled={busy} title={t("shortcuts.copyPng")}>
              {t("export.copy")}
            </button>
          ) : format === "jpeg" && onCopyJpeg ? (
            <button type="button" className="btn" onClick={onCopyJpeg} disabled={busy}>
              {t("export.copy")}
            </button>
          ) : format === "webp" && onCopyWebp ? (
            <button type="button" className="btn" onClick={onCopyWebp} disabled={busy}>
              {t("export.copy")}
            </button>
          ) : format === "svg" && onCopySvg ? (
            <button type="button" className="btn" onClick={onCopySvg} disabled={busy}>
              {t("export.copy")}
            </button>
          ) : format === "html" && onCopyHtml ? (
            <button type="button" className="btn" onClick={onCopyHtml} disabled={busy}>
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
          {busy && onCancel ? (
            <button type="button" className="btn" onClick={onCancel}>
              {t("editor.cancel")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
