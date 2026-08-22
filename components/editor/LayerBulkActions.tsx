"use client";

import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";

/** Footer shown when multiple layers are selected: count + bulk hide/duplicate/
 *  delete, plus a group-transform section that applies a transform to the whole
 *  selection at once. Locked layers are skipped by the store actions. */
export function LayerBulkActions({ count, total }: { count: number; total: number }) {
  const t = useTranslations();
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const toggleLayersHidden = useEditorStore((s) => s.toggleLayersHidden);
  const duplicateLayers = useEditorStore((s) => s.duplicateLayers);
  const removeLayers = useEditorStore((s) => s.removeLayers);
  const transformLayers = useEditorStore((s) => s.transformLayers);
  const nudgeLayers = useEditorStore((s) => s.nudgeLayers);

  // Read the first selected layer to seed the group sliders with a current
  // value; applying the slider writes the same value to every selected layer.
  const seed = useEditorStore((s) => {
    const id = s.selectedLayerIds[0];
    return s.scene.layers.find((l) => l.id === id);
  });
  const nudgeStep = 0.02;

  return (
    <div style={{ display: "grid", gap: 8 }}>
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
      <div className="bulk-transform" style={{ display: "grid", gap: 6, padding: 8, border: "1px solid var(--panel-border)", borderRadius: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>{t("editor.groupTransform")}</span>
        <div className="nudge-pad" style={{ display: "grid", gridTemplateColumns: "repeat(3, 28px)", gridTemplateRows: "repeat(3, 28px)", justifyItems: "center", alignContent: "center", gap: 2 }}>
          <span />
          <button type="button" className="btn btn-sm" aria-label={t("editor.nudgeUp")} onClick={() => nudgeLayers(selectedLayerIds, 0, -nudgeStep)}>↑</button>
          <span />
          <button type="button" className="btn btn-sm" aria-label={t("editor.nudgeLeft")} onClick={() => nudgeLayers(selectedLayerIds, -nudgeStep, 0)}>←</button>
          <span />
          <button type="button" className="btn btn-sm" aria-label={t("editor.nudgeRight")} onClick={() => nudgeLayers(selectedLayerIds, nudgeStep, 0)}>→</button>
          <span />
          <button type="button" className="btn btn-sm" aria-label={t("editor.nudgeDown")} onClick={() => nudgeLayers(selectedLayerIds, 0, nudgeStep)}>↓</button>
          <span />
        </div>
        <label className="field" style={{ gap: 4 }}>
          <span>{t("editor.filterOpacity", { val: Math.round((seed?.opacity ?? 100)) })}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={seed?.opacity ?? 100}
            aria-label={t("editor.filterOpacity", { val: Math.round(seed?.opacity ?? 100) })}
            onChange={(e) => transformLayers(selectedLayerIds, { opacity: Number(e.target.value) })}
          />
        </label>
        <label className="field" style={{ gap: 4 }}>
          <span>{t("editor.rotation")}</span>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={seed?.rotation ?? 0}
            aria-label={t("editor.rotation")}
            onChange={(e) => transformLayers(selectedLayerIds, { rotation: Number(e.target.value) })}
          />
        </label>
        <label className="field" style={{ gap: 4 }}>
          <span>{t("editor.zoom")}</span>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.1}
            value={seed?.zoom ?? 1}
            aria-label={t("editor.zoom")}
            onChange={(e) => transformLayers(selectedLayerIds, { zoom: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}
