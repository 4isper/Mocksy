"use client";

import { Check, Minus, Plus } from "lucide-react";
import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { GRID_DIVISION_OPTIONS } from "@/lib/render/grid";
import {
  ZOOM_SLIDER_MAX,
  panForZoom,
  resolveZoomScale,
  snapZoom,
  sliderToZoom,
  stepZoomDirection,
  zoomToSlider
} from "@/lib/render/previewViewport";
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

/** Bottom-left view zoom control: −/+ steps, a logarithmic continuous slider,
 *  the current percentage (click resets to 100%) and Fit. Pure view state.
 *  Zoom anchors at the viewport center — cursor-anchored zooming lives on the
 *  canvas wheel handler in useCanvasViewport. */
export function PreviewZoomControl() {
  const t = useTranslations();
  const previewZoom = useEditorStore((s) => s.previewZoom);
  const previewPan = useEditorStore((s) => s.previewPan);
  const setPreviewZoom = useEditorStore((s) => s.setPreviewZoom);
  const setPreviewPan = useEditorStore((s) => s.setPreviewPan);
  const resetPreviewView = useEditorStore((s) => s.resetPreviewView);

  /** Applies an absolute scale, keeping whichever content point is centered
   *  centered (pan scales proportionally, so nothing drifts off-canvas). */
  const applyScale = (next: number) => {
    const prev = resolveZoomScale(previewZoom);
    if (next === prev) return;
    setPreviewPan(panForZoom(previewPan, { x: 0, y: 0 }, prev, next));
    setPreviewZoom(next);
  };
  const step = (direction: 1 | -1) => applyScale(stepZoomDirection(resolveZoomScale(previewZoom), direction));

  const scale = resolveZoomScale(previewZoom);
  const percent = Math.round(scale * 100);

  return (
    <div className="preview-chip-stack" style={{ bottom: 8, left: 8 }}>
      <div className="preview-zoom-bar" role="group" aria-label={t("editor.previewZoom")}>
        <button type="button" className="preview-zoom-btn" aria-label={t("editor.zoomOut")} onClick={() => step(-1)}>
          <Minus size={13} />
        </button>
        <input
          type="range"
          className="preview-zoom-slider"
          min={0}
          max={ZOOM_SLIDER_MAX}
          step={1}
          value={zoomToSlider(scale)}
          aria-label={t("editor.previewZoom")}
          aria-valuetext={`${percent}%`}
          onChange={(e) => {
            const next = snapZoom(sliderToZoom(Number(e.target.value)));
            applyScale(next);
          }}
        />
        <button type="button" className="preview-zoom-btn" aria-label={t("editor.zoomIn")} onClick={() => step(1)}>
          <Plus size={13} />
        </button>
        <button
          type="button"
          className="preview-chip preview-zoom-value"
          onClick={() => applyScale(1)}
          title={t("editor.zoomReset")}
        >
          {percent}%
        </button>
        <button
          type="button"
          className={`preview-chip preview-zoom-fit${previewZoom === "fit" ? " is-active" : ""}`}
          onClick={resetPreviewView}
        >
          {t("editor.fit")}
        </button>
      </div>
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
