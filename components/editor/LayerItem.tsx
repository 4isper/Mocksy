"use client";

import type { DragEvent } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Lock, LockOpen, Video } from "lucide-react";
import type { MediaLayer } from "@/lib/types/editor";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { useEditorStore } from "@/lib/state/editorStore";

interface LayerItemProps {
  layer: MediaLayer;
  index: number;
  total: number;
  active: boolean;
  selected: boolean;
  isDragging: boolean;
  dropIndicator?: { inset: "top" | "bottom" };
  editing: boolean;
  draftName: string;
  onStartEdit: (name: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDraftChange: (v: string) => void;
  onSelect: (e: React.MouseEvent<HTMLLIElement>) => void;
  onContext: (e: React.MouseEvent<HTMLLIElement>) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDragStart: (e: DragEvent<HTMLLIElement>, id: string) => void;
  onDragOver: (e: DragEvent<HTMLLIElement>, id: string) => void;
  onDrop: (e: DragEvent<HTMLLIElement>, id: string) => void;
  onDragEnd: () => void;
}

/** One row in the layer list: thumbnail, editable name, and per-layer
 *  hide/duplicate/move/remove actions. Selection-aware via the parent. */
export function LayerItem({
  layer,
  index,
  total,
  active,
  selected,
  isDragging,
  dropIndicator,
  editing,
  draftName,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDraftChange,
  onSelect,
  onContext,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: LayerItemProps) {
  const t = useTranslations();
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds);
  const toggleLayersHidden = useEditorStore((s) => s.toggleLayersHidden);
  const toggleLayersLocked = useEditorStore((s) => s.toggleLayersLocked);
  const duplicateLayers = useEditorStore((s) => s.duplicateLayers);
  const removeLayers = useEditorStore((s) => s.removeLayers);

  const label = layer.mediaName ?? (layer.mediaType === "video" ? t("editor.videoLabel") : t("editor.imageLabel"));
  const dropStyle = dropIndicator
    ? { boxShadow: dropIndicator.inset === "top" ? "0 -2px 0 0 var(--accent) inset" : "0 2px 0 0 var(--accent) inset" }
    : undefined;

  return (
    <li
      key={layer.id}
      className={active ? "layer-item is-active" : "layer-item"}
      draggable
      onDragStart={(e) => onDragStart(e, layer.id)}
      onDragOver={(e) => onDragOver(e, layer.id)}
      onDrop={(e) => onDrop(e, layer.id)}
      onDragEnd={onDragEnd}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 8px",
        borderRadius: 8,
        border: active ? "2px solid var(--accent)" : selected ? "1px solid var(--accent)" : "1px solid var(--panel-border)",
        background: active ? "rgba(0,217,255,0.08)" : selected ? "rgba(0,217,255,0.04)" : "transparent",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.45 : layer.hidden ? 0.5 : 1,
        minWidth: 0,
        ...dropStyle
      }}
      onClick={onSelect}
      onContextMenu={onContext}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          display: "grid",
          placeItems: "center",
          color: "var(--text-dim)",
          fontSize: 12,
          lineHeight: 1,
          letterSpacing: 1
        }}
      >
        ⋮⋮
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          flex: "0 0 auto",
          borderRadius: 5,
          overflow: "hidden",
          background: "#0a0a0a",
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--panel-border)"
        }}
      >
        {layer.mediaUrl ? (
          isVideoLayer(layer) ? (
            <video src={layer.mediaUrl} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <img src={layer.mediaUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}><Video size={10} /></span>
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
        {editing ? (
          <input
            type="text"
            value={draftName}
            aria-label={t("editor.renameLayer")}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit();
              else if (e.key === "Escape") onCancelEdit();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            style={{ width: "100%", fontSize: 12 }}
          />
        ) : (
          <span
            title={t("editor.renameHint")}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEdit(layer.mediaName ?? label);
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "text" }}
          >
            {label}
            {isVideoLayer(layer) ? <Video size={10} aria-label={t("editor.videoLabel")} /> : null}
          </span>
        )}
      </span>
      <button
        type="button"
        className="btn-icon"
        aria-label={layer.hidden ? t("editor.showLayer") : t("editor.hideLayer")}
        title={layer.hidden ? t("editor.showLayer") : t("editor.hideLayer")}
        onClick={(e) => {
          e.stopPropagation();
          toggleLayersHidden(selected ? selectedLayerIds : [layer.id]);
        }}
      >
        {layer.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      <button
        type="button"
        className="btn-icon"
        aria-label={layer.locked ? t("editor.unlockLayer") : t("editor.lockLayer")}
        title={layer.locked ? t("editor.unlockLayer") : t("editor.lockLayer")}
        onClick={(e) => {
          e.stopPropagation();
          toggleLayersLocked(selected ? selectedLayerIds : [layer.id]);
        }}
      >
        {layer.locked ? <Lock size={12} /> : <LockOpen size={12} />}
      </button>
      <button
        type="button"
        className="btn-icon"
        aria-label={t("editor.duplicateLayer")}
        title={t("editor.duplicateLayer")}
        onClick={(e) => {
          e.stopPropagation();
          duplicateLayers(selected ? selectedLayerIds : [layer.id]);
        }}
      >
        ⧉
      </button>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={t("editor.moveUp")}
        data-tooltip={t("editor.moveUp")}
        disabled={index === 0}
        onClick={(e) => {
          e.stopPropagation();
          onMove(layer.id, -1);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={t("editor.moveDown")}
        data-tooltip={t("editor.moveDown")}
        disabled={index === total - 1}
        onClick={(e) => {
          e.stopPropagation();
          onMove(layer.id, 1);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M6 10l4-4M6 10l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={t("editor.removeLayer", { label })}
        data-tooltip={t("editor.removeLayer", { label })}
        disabled={total <= 1 || layer.locked}
        onClick={(e) => {
          e.stopPropagation();
          removeLayers(selected ? selectedLayerIds : [layer.id]);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </li>
  );
}
