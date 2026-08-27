"use client";

import { useTranslations } from "next-intl";
import { Video } from "lucide-react";
import type { MediaLayer } from "@/lib/types/editor";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { isTextLayer } from "@/lib/render/layerText";

interface LayerItemProps {
  layer: MediaLayer;
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
  onKeyDown: (e: React.KeyboardEvent<HTMLLIElement>, id: string) => void;
  onContext: (e: React.MouseEvent<HTMLLIElement>) => void;
  onDragStart: (e: React.DragEvent<HTMLLIElement>, id: string) => void;
  onDragOver: (e: React.DragEvent<HTMLLIElement>, id: string) => void;
  onDrop: (e: React.DragEvent<HTMLLIElement>, id: string) => void;
  onDragEnd: () => void;
}

/** One row in the layer listbox: thumbnail and editable name. The row itself is
 *  the `role="option"` element so it stays a direct, focusable listbox child
 *  (ARIA options must not contain interactive controls — the per-layer actions
 *  live in the separate `LayerActions` toolbar, not here). */
export function LayerItem({
  layer,
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
  onKeyDown,
  onContext,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: LayerItemProps) {
  const t = useTranslations();

  const label = isTextLayer(layer)
    ? layer.textContent?.trim() || t("editor.textLabel")
    : layer.mediaName ?? (layer.mediaType === "video" ? t("editor.videoLabel") : t("editor.imageLabel"));
  const dropStyle = dropIndicator
    ? { boxShadow: dropIndicator.inset === "top" ? "0 -2px 0 0 var(--accent) inset" : "0 2px 0 0 var(--accent) inset" }
    : undefined;

  return (
    <li
      key={layer.id}
      className={active ? "layer-item is-active" : "layer-item"}
      role="option"
      aria-selected={selected}
      tabIndex={active ? 0 : -1}
      draggable
      onDragStart={(e) => onDragStart(e, layer.id)}
      onDragOver={(e) => onDragOver(e, layer.id)}
      onDrop={(e) => onDrop(e, layer.id)}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onKeyDown={(e) => onKeyDown(e, layer.id)}
      onContextMenu={onContext}
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
    >
      {layer.groupId && (
        <span
          aria-hidden="true"
          title={t("editor.groupedLayer")}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: "var(--accent)",
            flex: "0 0 auto",
          }}
        />
      )}
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
          background: "var(--panel-solid)",
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
        ) : isTextLayer(layer) ? (
          <span style={{ fontSize: 12, fontWeight: 700, color: layer.textColor ?? "#ffffff" }}>T</span>
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
            onDoubleClick={(e) => e.stopPropagation()}
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
    </li>
  );
}
