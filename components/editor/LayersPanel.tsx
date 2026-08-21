"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { useAutoDismissError } from "@/lib/hooks/useAutoDismissError";
import { useLayerReorder } from "@/lib/hooks/useLayerReorder";
import { ContextMenu, type ContextMenuItem } from "@/components/editor/ContextMenu";
import { LayerItem } from "@/components/editor/LayerItem";
import { LayerBulkActions } from "@/components/editor/LayerBulkActions";

export function LayersPanel() {
  const t = useTranslations();
  const scene = useEditorStore((s) => s.scene);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const addLayer = useEditorStore((s) => s.addLayer);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const selectLayerRange = useEditorStore((s) => s.selectLayerRange);
  const toggleLayerSelected = useEditorStore((s) => s.toggleLayerSelected);
  const renameLayer = useEditorStore((s) => s.renameLayer);
  const setMedia = useEditorStore((s) => s.setMedia);
  const isMediaLoading = useEditorStore((s) => s.isMediaLoading);
  const setMediaLoading = useEditorStore((s) => s.setMediaLoading);
  const selectedSet = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);
  const [error, setError] = useAutoDismissError();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];

  const { dragId, dropTarget, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useLayerReorder(scene);

  const commitRename = (id: string) => {
    renameLayer(id, draftName.trim());
    setEditingId(null);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setMediaLoading(true);
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setError(null);
      addLayer(url, mediaType, mediaName);
    } catch (err) {
      setError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
    } finally {
      setMediaLoading(false);
      event.target.value = "";
    }
  };

  const move = (id: string, dir: -1 | 1) => {
    const ids = scene.layers.map((l) => l.id);
    const idx = ids.indexOf(id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= ids.length) return;
    const a = ids[idx];
    const b = ids[next];
    if (a === undefined || b === undefined) return;
    ids[idx] = b;
    ids[next] = a;
    useEditorStore.getState().reorderLayers(ids);
  };

  /** Right-click menu for one layer row: select it, then offer the same
   *  actions as the row buttons. */
  const openLayerContextMenu = (e: React.MouseEvent<HTMLLIElement>, layerId: string) => {
    e.preventDefault();
    selectLayer(layerId);
    const layer = scene.layers.find((l) => l.id === layerId);
    if (!layer) return;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { id: "dup", label: t("editor.ctxDuplicate"), onSelect: () => useEditorStore.getState().duplicateLayer(layerId) },
        { id: "hide", label: layer.hidden ? t("editor.ctxShow") : t("editor.ctxHide"), onSelect: () => useEditorStore.getState().toggleLayerHidden(layerId) },
        { id: "up", label: t("editor.ctxMoveUp"), disabled: scene.layers[0]?.id === layerId, onSelect: () => move(layerId, -1) },
        { id: "down", label: t("editor.ctxMoveDown"), disabled: scene.layers[scene.layers.length - 1]?.id === layerId, onSelect: () => move(layerId, 1) },
        { id: "remove", label: t("editor.deleteLayers"), danger: true, separatorBefore: true, disabled: scene.layers.length <= 1, onSelect: () => useEditorStore.getState().removeLayer(layerId) }
      ]
    });
  };

  return (
    <div style={{ padding: 10, display: "grid", gap: 8, alignContent: "start", overflow: "auto", minHeight: 0, minWidth: 0 }}>
      <label className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, padding: "6px 10px", cursor: "pointer" }}>
        + {t("editor.addLayer")}
        <input type="file" accept="image/*,video/*" onChange={handleFile} style={{ display: "none" }} />
      </label>
      {error ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
          {error}
        </span>
      ) : null}
      {isMediaLoading && scene.layers.length === 0 ? (
        <div aria-busy="true" aria-label={t("editor.loadingMedia")} style={{ display: "grid", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-row" style={{ height: 36, borderRadius: 8 }} />
          ))}
        </div>
      ) : scene.layers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M3 9h18M9 3v18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </div>
          <p className="empty-state-text">{t("editor.noLayers")}</p>
          <p className="empty-state-text" style={{ fontSize: 11, color: "var(--text-dim)" }}>{t("help.layersStack")}</p>
        </div>
      ) : (
        <ul className="layers-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, minWidth: 0 }}>
          {scene.layers.map((layer, index) => {
            const active = layer.id === activeLayerId;
            const isDragging = dragId === layer.id;
            const isSelected = selectedSet.has(layer.id);
            const isTarget = dropTarget?.id === layer.id;
            const dropIndicator = isTarget && !isDragging
              ? { inset: dropTarget?.pos === "above" ? ("top" as const) : ("bottom" as const) }
              : undefined;
            return (
              <LayerItem
                key={layer.id}
                layer={layer}
                index={index}
                total={scene.layers.length}
                active={active}
                selected={isSelected}
                isDragging={isDragging}
                dropIndicator={dropIndicator}
                editing={editingId === layer.id}
                draftName={draftName}
                onStartEdit={(name) => {
                  setDraftName(name);
                  setEditingId(layer.id);
                }}
                onCommitEdit={() => commitRename(layer.id)}
                onCancelEdit={() => setEditingId(null)}
                onDraftChange={setDraftName}
                onSelect={(e) => {
                  if (e.shiftKey) selectLayerRange(layer.id, e.metaKey || e.ctrlKey);
                  else if (e.metaKey || e.ctrlKey) toggleLayerSelected(layer.id);
                  else selectLayer(layer.id);
                }}
                onContext={(e) => openLayerContextMenu(e, layer.id)}
                onMove={move}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            );
          })}
          {isMediaLoading ? (
            <li className="layer-item" aria-busy="true" aria-label={t("editor.loadingMedia")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--panel-border)" }}>
              <span className="skeleton" style={{ flex: 1, height: 14, borderRadius: 6 }} />
            </li>
          ) : null}
        </ul>
      )}
      {selectedLayerIds.length > 1 ? (
        <LayerBulkActions count={selectedLayerIds.length} total={scene.layers.length} />
      ) : null}
      {activeLayer?.mediaUrl ? (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setMedia(null, "none", null)}
          title={t("editor.removeMediaTitle")}
        >
          {t("editor.clearMedia")}
        </button>
      ) : null}
      <p style={{ color: "var(--text-dim)", fontSize: 12, margin: 0 }}>
        {t("help.layersStack")}
      </p>
      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
}
