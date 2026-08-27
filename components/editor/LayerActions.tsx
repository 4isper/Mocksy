"use client";

import { useTranslations } from "next-intl";
import { Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import type { MediaLayer } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";

interface LayerActionsProps {
  layer: MediaLayer | undefined;
  index: number;
  total: number;
  onMove: (id: string, dir: -1 | 1) => void;
}

/** Toolbar of per-layer actions (hide/lock/duplicate/move/remove) that operates
 *  on the active layer. Kept OUT of the listbox rows so each ARIA `option` stays
 *  free of nested interactive controls (axe "nested-interactive"). */
export function LayerActions({ layer, index, total, onMove }: LayerActionsProps) {
  const t = useTranslations();
  const toggleLayerHidden = useEditorStore((s) => s.toggleLayerHidden);
  const toggleLayersLocked = useEditorStore((s) => s.toggleLayersLocked);
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);

  if (!layer) return null;

  const label = layer.mediaName ?? (layer.mediaType === "video" ? t("editor.videoLabel") : t("editor.imageLabel"));

  return (
    <div className="layer-actions" role="group" aria-label={t("editor.layerActions")}>
      <button
        type="button"
        className="btn-icon"
        aria-label={layer.hidden ? t("editor.showLayer") : t("editor.hideLayer")}
        title={layer.hidden ? t("editor.showLayer") : t("editor.hideLayer")}
        onClick={() => toggleLayerHidden(layer.id)}
      >
        {layer.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      <button
        type="button"
        className="btn-icon"
        aria-label={layer.locked ? t("editor.unlockLayer") : t("editor.lockLayer")}
        title={layer.locked ? t("editor.unlockLayer") : t("editor.lockLayer")}
        onClick={() => toggleLayersLocked([layer.id])}
      >
        {layer.locked ? <Lock size={12} /> : <LockOpen size={12} />}
      </button>
      <button
        type="button"
        className="btn-icon"
        aria-label={t("editor.duplicateLayer")}
        title={t("editor.duplicateLayer")}
        onClick={() => duplicateLayer(layer.id)}
      >
        ⧉
      </button>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={t("editor.moveUp")}
        data-tooltip={index === 0 ? t("editor.moveUpDisabled") : t("editor.moveUp")}
        disabled={index === 0}
        onClick={() => onMove(layer.id, -1)}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={t("editor.moveDown")}
        data-tooltip={index === total - 1 ? t("editor.moveDownDisabled") : t("editor.moveDown")}
        disabled={index === total - 1}
        onClick={() => onMove(layer.id, 1)}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M6 10l4-4M6 10l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={layer.locked ? t("editor.removeLayerLocked") : t("editor.removeLayer", { label })}
        data-tooltip={layer.locked ? t("editor.removeLayerLocked") : t("editor.removeLayer", { label })}
        disabled={total <= 1 || layer.locked}
        onClick={() => removeLayer(layer.id)}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
