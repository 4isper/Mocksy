"use client";

import { Check, Minus, Plus, Upload, X } from "lucide-react";
import { useEffect, useRef, type ChangeEvent } from "react";
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

/** Upload + optional clear buttons (no positioning wrapper — the parent dock
 *  bar owns the layout). In single-frame mode they target the active layer;
 *  in multi-frame mode they target the selected (or first) instance's layer.
 *  Upload stays visible even when there is media to clear, so replacing media
 *  is one click instead of clear-then-upload. The hidden file input is keyed
 *  so picking the same file re-triggers. */
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

  return (
    <>
      <UploadChip
        label={t("editor.uploadMedia")}
        fileInputKey={fileInputKey}
        targetLayerId={isMultiFrame ? (targetLayerId ?? undefined) : undefined}
        onFile={onFile}
      />
      {canClearActive ? (
        <button
          type="button"
          className="preview-chip"
          title={t("editor.clearMedia")}
          onClick={() => (targetLayerId ? useEditorStore.getState().setMediaOnLayer(targetLayerId, null, "none", null) : setMedia(null, "none", null))}
        >
          <X size={13} aria-hidden="true" />
          <span className="chip-label">{t("editor.clearMedia")}</span>
        </button>
      ) : null}
    </>
  );
}

/**
 * Upload chip for the preview canvas. A native <label>+hidden-input pairing
 * wasn't keyboard-focusable (the styled input is display:none), so instead the
 * visible chip is a real button that programmatically opens the file dialog —
 * this keeps it in the tab order and activates with Enter/Space like any other
 * control.
 */
function UploadChip({
  label,
  fileInputKey,
  targetLayerId,
  onFile
}: {
  label: string;
  fileInputKey: number;
  targetLayerId?: string;
  onFile: (event: ChangeEvent<HTMLInputElement>, layerId?: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openFileDialog = () => inputRef.current?.click();
  return (
    <>
      <button type="button" className="preview-chip" title={label} onClick={openFileDialog}>
        <Upload size={13} aria-hidden="true" />
        <span className="chip-label">{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(e) => onFile(e, targetLayerId)}
        key={fileInputKey}
        style={{ display: "none" }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );
}

/** View zoom control: −/+ steps, a logarithmic continuous slider, the current
 *  percentage (click resets to 100%) and Fit. Pure view state. Zoom anchors
 *  at the viewport center — cursor-anchored zooming lives on the canvas wheel
 *  handler in useCanvasViewport. No positioning wrapper — lives in the dock. */
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
      <span className="dock-sep" aria-hidden="true" />
      <button
        type="button"
        className={`preview-chip preview-zoom-fit${previewZoom === "fit" ? " is-active" : ""}`}
        onClick={resetPreviewView}
      >
        {t("editor.fit")}
      </button>
    </div>
  );
}

/** Grid toggle + divisions select. No positioning wrapper — lives in the dock. */
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
    <>
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
    </>
  );
}

/** Single docked control bar pinned to the bottom of the preview panel (not
 *  the canvas): Upload/Clear | zoom | grid. One stable row that never covers
 *  the artwork and never shifts with the scene aspect ratio. */
export function PreviewDockBar({
  isMultiFrame,
  canClearActive,
  targetLayerId,
  fileInputKey,
  onFile,
  showGrid,
  gridDivisions,
  setShowGrid,
  setGridDivisions
}: {
  isMultiFrame: boolean;
  canClearActive: boolean;
  targetLayerId: string | null;
  fileInputKey: number;
  onFile: (event: ChangeEvent<HTMLInputElement>, layerId?: string) => void;
  showGrid: boolean;
  gridDivisions: number;
  setShowGrid: (v: boolean) => void;
  setGridDivisions: (n: number) => void;
}) {
  const t = useTranslations();
  const barRef = useRef<HTMLDivElement>(null);

  // The hidden file input is programmatic-only (keyboard users go through the
  // Upload button), so it never joins the keyboard walk — also keeps
  // layout-less test DOMs, where hidden nodes are still focusable, honest.
  const items = () =>
    barRef.current
      ? Array.from(
          barRef.current.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled):not([type='file']), select:not(:disabled)"
          )
        )
      : [];

  // Roving tabindex (toolbar pattern, mirrors the right-panel tabs): one Tab
  // stop for the whole bar, arrows move between controls. Sliders and selects
  // keep their native arrow behavior. focus() on a CSS-hidden control is a
  // no-op, so the walk verifies each step and skips ahead (e.g. the %-reset
  // hidden in the compact phone layout).
  useEffect(() => {
    const root = barRef.current;
    if (!root) return;
    const paint = () => {
      const list = items();
      const active = document.activeElement;
      const inside = active && root.contains(active);
      list.forEach((el) => {
        el.tabIndex = inside ? (el === active ? 0 : -1) : -1;
      });
      if (!inside && list.length > 0) list[0]!.tabIndex = 0;
    };
    paint();
    root.addEventListener("focusin", paint);
    return () => root.removeEventListener("focusin", paint);
  });

  const moveFocus = (from: number, direction: 1 | -1) => {
    const list = items();
    if (list.length === 0) return;
    let i = from;
    for (let step = 0; step < list.length; step++) {
      i = (i + direction + list.length) % list.length;
      list[i]!.focus();
      if (document.activeElement === list[i]) return;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const target = e.target as HTMLElement;
    if (target.matches('input[type="range"], select')) return;
    e.preventDefault();
    const list = items();
    const idx = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Home") {
      list[0]?.focus();
      return;
    }
    if (e.key === "End") {
      list[list.length - 1]?.focus();
      return;
    }
    moveFocus(idx, e.key === "ArrowRight" ? 1 : -1);
  };

  return (
    <div
      className="preview-dock-bar"
      ref={barRef}
      role="toolbar"
      aria-label={t("editor.canvasControls")}
      onKeyDown={onKeyDown}
    >
      <div className="dock-group">
        <PreviewChips
          isMultiFrame={isMultiFrame}
          canClearActive={canClearActive}
          targetLayerId={targetLayerId}
          fileInputKey={fileInputKey}
          onFile={onFile}
        />
      </div>
      <span className="dock-sep" aria-hidden="true" />
      <div className="dock-group">
        <PreviewZoomControl />
      </div>
      <span className="dock-sep" aria-hidden="true" />
      <div className="dock-group">
        <PreviewGridToggle
          showGrid={showGrid}
          gridDivisions={gridDivisions}
          setShowGrid={setShowGrid}
          setGridDivisions={setGridDivisions}
        />
      </div>
    </div>
  );
}
