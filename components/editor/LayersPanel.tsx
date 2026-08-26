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
import { Eye, EyeOff, Lock, LockOpen } from "lucide-react";

export function LayersPanel() {
  const t = useTranslations();
  const scene = useEditorStore((s) => s.scene);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const addLayer = useEditorStore((s) => s.addLayer);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const selectLayerRange = useEditorStore((s) => s.selectLayerRange);
  const toggleLayerSelected = useEditorStore((s) => s.toggleLayerSelected);
  const removeLayers = useEditorStore((s) => s.removeLayers);
  const renameLayer = useEditorStore((s) => s.renameLayer);
  const setMedia = useEditorStore((s) => s.setMedia);
  const isMediaLoading = useEditorStore((s) => s.isMediaLoading);
  const setMediaLoading = useEditorStore((s) => s.setMediaLoading);
  const selectedSet = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);
  const [error, setError] = useAutoDismissError();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroupCollapse = (groupId: string) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
    return next;
  });
  const renameGroup = useEditorStore((s) => s.renameGroup);
  const toggleGroupHidden = useEditorStore((s) => s.toggleGroupHidden);
  const toggleGroupLocked = useEditorStore((s) => s.toggleGroupLocked);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupDraftName, setGroupDraftName] = useState("");
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

  /** Keyboard navigation for the layer listbox. Implements roving tabindex
   *  with ArrowUp/Down, Home/End, Enter (activate), Space (toggle select),
   *  F2 (rename), Delete (remove), and Alt+Arrow (reorder). */
  const handleLayerKeyDown = (e: React.KeyboardEvent<HTMLLIElement>, layerId: string) => {
    if (editingId) return;
    const ids = scene.layers.map((l) => l.id);
    const idx = ids.indexOf(layerId);
    if (idx < 0) return;

    const focusLayer = (nextIdx: number) => {
      const id = ids[nextIdx];
      if (!id) return;
      selectLayer(id);
      // Move roving tabindex to the newly focused item.
      const items = e.currentTarget.parentElement?.querySelectorAll('[role="option"]');
      (items?.[nextIdx] as HTMLElement | undefined)?.focus();
    };

    if (e.key === "ArrowDown" && !e.altKey) {
      e.preventDefault();
      focusLayer(Math.min(idx + 1, ids.length - 1));
    } else if (e.key === "ArrowUp" && !e.altKey) {
      e.preventDefault();
      focusLayer(Math.max(idx - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      focusLayer(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusLayer(ids.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectLayer(layerId);
    } else if (e.key === " ") {
      e.preventDefault();
      toggleLayerSelected(layerId);
    } else if (e.key === "F2") {
      e.preventDefault();
      const layer = scene.layers.find((l) => l.id === layerId);
      if (layer) {
        setDraftName(layer.mediaName ?? t("editor.textLabel"));
        setEditingId(layerId);
      }
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeLayers([layerId]);
    } else if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      move(layerId, -1);
    } else if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      move(layerId, 1);
    }
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
        <ul
          className="layers-list"
          role="listbox"
          aria-label={t("editor.layers")}
          aria-multiselectable="true"
          style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, minWidth: 0 }}
        >
          {scene.layers.map((layer, index) => {
            const active = layer.id === activeLayerId;
            const isDragging = dragId === layer.id;
            const isSelected = selectedSet.has(layer.id);
            const isTarget = dropTarget?.id === layer.id;
            const dropIndicator = isTarget && !isDragging
              ? { inset: dropTarget?.pos === "above" ? ("top" as const) : ("bottom" as const) }
              : undefined;

            const groupId = layer.groupId;
            const isFirstInGroup = !!groupId && scene.layers.findIndex((l) => l.groupId === groupId) === index;
            const isGrouped = !!groupId;
            const isCollapsed = groupId ? collapsedGroups.has(groupId) : false;

            // Skip rendering layers inside a collapsed group (except the first one which shows the header).
            if (isGrouped && groupId && !isFirstInGroup && isCollapsed) return null;

            const items: React.ReactNode[] = [];

            if (isFirstInGroup && groupId) {
              const groupLabel = layer.mediaName ?? t("editor.groupUntitled");
              const members = scene.layers.filter((l) => l.groupId === groupId);
              const allHidden = members.every((l) => l.hidden);
              const allLocked = members.every((l) => l.locked);
              const isEditingGroup = editingGroupId === groupId;

              items.push(
                <li
                  key={`group-${groupId}`}
                  role="presentation"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 6px",
                    borderRadius: 6,
                    background: "rgba(0,217,255,0.04)",
                    border: "1px solid var(--panel-border)",
                    marginTop: index > 0 ? 4 : 0,
                  }}
                >
                  <button
                    type="button"
                    aria-label={isCollapsed ? t("editor.expandGroup") : t("editor.collapseGroup")}
                    onClick={() => toggleGroupCollapse(groupId)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--text-dim)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}>
                      <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {isEditingGroup ? (
                    <input
                      autoFocus
                      value={groupDraftName}
                      onChange={(e) => setGroupDraftName(e.target.value)}
                      onBlur={() => { renameGroup(groupId, groupDraftName.trim()); setEditingGroupId(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { renameGroup(groupId, groupDraftName.trim()); setEditingGroupId(null); } if (e.key === "Escape") setEditingGroupId(null); }}
                      style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "1px 4px", background: "var(--panel)", color: "var(--text)", border: "1px solid var(--accent)", borderRadius: 4 }}
                    />
                  ) : (
                    <span
                      style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "var(--text)", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      onDoubleClick={() => { setEditingGroupId(groupId); setGroupDraftName(groupLabel); }}
                      title={t("editor.renameHint")}
                    >
                      {groupLabel}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{members.length}</span>
                  <button
                    type="button"
                    aria-label={allHidden ? t("editor.showGroup") : t("editor.hideGroup")}
                    onClick={() => toggleGroupHidden(groupId)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--text-dim)" }}
                  >
                    {allHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button
                    type="button"
                    aria-label={allLocked ? t("editor.unlockGroup") : t("editor.lockGroup")}
                    onClick={() => toggleGroupLocked(groupId)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--text-dim)" }}
                  >
                    {allLocked ? <Lock size={12} /> : <LockOpen size={12} />}
                  </button>
                </li>
              );
            }

            items.push(
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
                onKeyDown={handleLayerKeyDown}
                onContext={(e) => openLayerContextMenu(e, layer.id)}
                onMove={move}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            );

            return items;
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
