"use client";

import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";

/** Footer shown when multiple layers are selected: count + bulk hide/duplicate/
 *  delete. Disabled delete when removing every remaining layer. */
export function LayerBulkActions({ count, total }: { count: number; total: number }) {
  const t = useTranslations();
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const toggleLayersHidden = useEditorStore((s) => s.toggleLayersHidden);
  const duplicateLayers = useEditorStore((s) => s.duplicateLayers);
  const removeLayers = useEditorStore((s) => s.removeLayers);
  return (
    <div className="bulk-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{t("editor.selectedCount", { count })}</span>
      <button type="button" className="btn btn-sm" onClick={() => toggleLayersHidden(selectedLayerIds)}>
        {t("editor.toggleVisibility")}
      </button>
      <button type="button" className="btn btn-sm" onClick={() => duplicateLayers(selectedLayerIds)}>
        {t("editor.duplicateLayer")}
      </button>
      <button
        type="button"
        className="btn btn-sm"
        disabled={total <= count}
        onClick={() => removeLayers(selectedLayerIds)}
      >
        {t("editor.deleteLayers")}
      </button>
    </div>
  );
}
