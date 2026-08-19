"use client";

import { Check } from "lucide-react";
import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { GRID_DIVISION_OPTIONS } from "@/lib/render/grid";
import { useEditorStore } from "@/lib/state/editorStore";

/** Top-left upload/clear chips: in single-frame mode they target the active
 *  layer and the upload label is always shown alongside an optional clear
 *  button; in multi-frame mode they target the selected (or first) instance's
 *  layer and show either upload or clear. The hidden file input is keyed so
 *  picking the same file re-triggers. */
export function PreviewChips({
  isMultiFrame,
  canClearActive,
  targetLayerId,
  fileInputKey,
  onFile
}: {
  isMultiFrame: boolean;
  canClearActive: boolean;
  targetLayerId: string | null;
  fileInputKey: number;
  onFile: (event: ChangeEvent<HTMLInputElement>, layerId?: string) => void;
}) {
  const t = useTranslations();
  const setMedia = useEditorStore((s) => s.setMedia);

  if (!isMultiFrame) {
    return (
      <div className="preview-chip-stack" style={{ top: 8, left: 8 }}>
        <label className="preview-chip">
          <span>{t("editor.uploadMedia")}</span>
          <input type="file" accept="image/*,video/*" onChange={(e) => onFile(e)} key={fileInputKey} style={{ display: "none" }} />
        </label>
        {canClearActive ? (
          <button type="button" className="preview-chip" onClick={() => setMedia(null, "none", null)}>
            {t("editor.clearMedia")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="preview-chip-stack" style={{ top: 8, left: 8 }}>
      {!canClearActive ? (
        <label className="preview-chip">
          <span>{t("editor.uploadMedia")}</span>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => onFile(e, targetLayerId ?? undefined)}
            key={fileInputKey}
            style={{ display: "none" }}
          />
        </label>
      ) : (
        <button
          type="button"
          className="preview-chip"
          onClick={() => (targetLayerId ? useEditorStore.getState().setMediaOnLayer(targetLayerId, null, "none", null) : setMedia(null, "none", null))}
        >
          {t("editor.clearMedia")}
        </button>
      )}
    </div>
  );
}

/** Bottom-right grid toggle + divisions select. */
export function PreviewGridToggle({
  showGrid,
  gridDivisions,
  setShowGrid,
  setGridDivisions
}: {
  showGrid: boolean;
  gridDivisions: number;
  setShowGrid: (v: boolean) => void;
  setGridDivisions: (n: number) => void;
}) {
  const t = useTranslations();
  return (
    <div className="preview-chip-stack" style={{ bottom: 8, right: 8 }}>
      <button
        type="button"
        className="preview-chip"
        aria-pressed={showGrid}
        aria-label={t("editor.grid")}
        onClick={() => setShowGrid(!showGrid)}
      >
        {showGrid ? <Check size={12} /> : ""}
        {t("editor.grid")}
      </button>
      {showGrid ? (
        <select
          className="preview-chip"
          style={{ cursor: "pointer" }}
          value={gridDivisions}
          aria-label={t("editor.gridDivisions")}
          onChange={(e) => setGridDivisions(Number(e.target.value))}
        >
          {GRID_DIVISION_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
