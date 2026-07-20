"use client";

import { useState } from "react";

export type ExportFormat = "png" | "mp4" | "gif";

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "mp4", label: "MP4" },
  { value: "gif", label: "GIF" }
];

const SCALES: { value: 1 | 2 | 4; label: string }[] = [
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 4, label: "4×" }
];

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
  const [format, setFormat] = useState<ExportFormat>("png");
  if (!open) return null;
  const formatLabel = format === "gif" ? "GIF" : format === "mp4" ? "MP4" : "PNG";
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="export-title">Export</h3>
        <div className="field-group">
          <label className="field">
            <span>Format</span>
            <div className="segmented" role="group" aria-label="Format">
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
            <span>Size</span>
            <div className="segmented" role="group" aria-label="Size">
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
            <button type="button" className="btn" onClick={onCopy} disabled={busy} title="Copy PNG to clipboard (⌘⇧C)">
              Copy PNG
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
