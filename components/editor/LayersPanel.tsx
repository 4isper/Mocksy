"use client";

import { useState, useRef, useCallback } from "react";
import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { Circle, Eye, EyeOff, Video } from "lucide-react";
import { useEditorStore } from "@/lib/state/editorStore";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { isVideoLayer } from "@/lib/render/mediaKind";

interface DragState {
  id: string;
  y: number;
}

export function LayersPanel() {
  const t = useTranslations();
  const scene = useEditorStore((s) => s.scene);
  const addLayer = useEditorStore((s) => s.addLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const reorderLayers = useEditorStore((s) => s.reorderLayers);
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const toggleLayerHidden = useEditorStore((s) => s.toggleLayerHidden);
  const setMedia = useEditorStore((s) => s.setMedia);
  const [error, setError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverDropTarget, setDragOverDropTarget] = useState<{
    targetId: string;
    pos: "above" | "below";
  } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setError(null);
      addLayer(url, mediaType, mediaName);
    } catch (err) {
      setError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
    } finally {
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
    reorderLayers(ids);
  };

  /** Which list item is closest to clientY, and above/below its midpoint. */
  const getDropTarget = useCallback(
    (clientY: number): { targetId: string; pos: "above" | "below" } | null => {
      const list = listRef.current;
      if (!list) return null;
      const items = Array.from(list.children) as HTMLElement[];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const rect = item.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          const id = item.getAttribute("data-layer-id");
          if (!id) continue;
          const pos = clientY < rect.top + rect.height / 2 ? "above" : "below";
          return { targetId: id, pos };
        }
      }
      return null;
    },
    []
  );

  /** Moves the dragged layer to sit just above/below the target. */
  const reorderByDrag = useCallback(
    (targetId: string, pos: "above" | "below") => {
      if (!dragState || dragState.id === targetId) return;
      const ids = scene.layers.map((l) => l.id);
      const from = ids.indexOf(dragState.id);
      let to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return;
      if (pos === "below") to += 1;
      ids.splice(from, 1);
      if (to > from) to -= 1;
      ids.splice(to, 0, dragState.id);
      reorderLayers(ids, true);
    },
    [dragState, scene.layers, reorderLayers]
  );

  const handleGripPointerDown = (e: React.PointerEvent<HTMLSpanElement>, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragState({ id, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleGripPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!dragState) return;
    const dt = getDropTarget(e.clientY);
    if (!dt) return;
    setDragOverDropTarget(dt);
    reorderByDrag(dt.targetId, dt.pos);
  };

  const handleGripPointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    setDragState(null);
    setDragOverDropTarget(null);
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
      <ul
        ref={listRef}
        className="layers-list"
        style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, minWidth: 0 }}
      >
        {scene.layers.map((layer, index) => {
          const active = layer.id === scene.activeLayerId;
          const label = layer.mediaName ?? (layer.mediaType === "video" ? t("editor.videoLabel") : t("editor.imageLabel"));
          const isDragging = dragState?.id === layer.id;
          const isTarget = dragOverDropTarget?.targetId === layer.id;
          const dropIndicator = isTarget && !isDragging
            ? {
                boxShadow:
                  dragOverDropTarget?.pos === "above"
                    ? "0 -2px 0 0 var(--accent) inset"
                    : "0 2px 0 0 var(--accent) inset",
              }
            : undefined;
          return (
            <li
              key={layer.id}
              data-layer-id={layer.id}
              className={active ? "layer-item is-active" : "layer-item"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 8px",
                borderRadius: 8,
                border: active ? "2px solid var(--accent)" : "1px solid var(--panel-border)",
                background: active ? "rgba(0,217,255,0.08)" : "transparent",
                cursor: isDragging ? "grabbing" : "grab",
                opacity: isDragging ? 0.45 : layer.hidden ? 0.5 : 1,
                minWidth: 0,
                ...dropIndicator
              }}
              onClick={() => selectLayer(layer.id)}
            >
              <span
                aria-hidden="true"
                className="layer-grip"
                onPointerDown={(e) => handleGripPointerDown(e, layer.id)}
                onPointerMove={handleGripPointerMove}
                onPointerUp={handleGripPointerUp}
                onPointerCancel={handleGripPointerUp}
                style={{
                  flex: "0 0 auto",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--text-dim)",
                  fontSize: 12,
                  lineHeight: 1,
                  letterSpacing: 1,
                  cursor: "grab",
                  padding: "0 2px",
                  userSelect: "none",
                  touchAction: "none",
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
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}><Circle size={10} /></span>
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
                    {label}
                    {isVideoLayer(layer) ? <Video size={10} style={{ marginLeft: 4 }} aria-label={t("editor.videoLabel")} /> : null}
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={layer.hidden ? t("editor.showLayer") : t("editor.hideLayer")}
                    title={layer.hidden ? t("editor.showLayer") : t("editor.hideLayer")}
                    onClick={(e) => { e.stopPropagation(); toggleLayerHidden(layer.id); }}
                  >
                    {layer.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={t("editor.duplicateLayer")}
                    title={t("editor.duplicateLayer")}
                    onClick={(e) => { e.stopPropagation(); duplicateLayer(layer.id); }}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={t("editor.moveUp")}
                    disabled={index === 0}
                    onClick={(e) => { e.stopPropagation(); move(layer.id, -1); }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={t("editor.moveDown")}
                    disabled={index === scene.layers.length - 1}
                    onClick={(e) => { e.stopPropagation(); move(layer.id, 1); }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M6 10l4-4M6 10l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={t("editor.removeLayer", { label })}
                    disabled={scene.layers.length <= 1}
                    onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
            </li>
          );
        })}
      </ul>
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
    </div>
  );
}
