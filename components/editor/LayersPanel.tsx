"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { isVideoLayer } from "@/lib/render/mediaKind";

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

  return (
    <div style={{ padding: 10, display: "grid", gap: 8, alignContent: "start", overflow: "auto", minHeight: 0 }}>
      <label className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, padding: "6px 10px", cursor: "pointer" }}>
        + {t("editor.addLayer")}
        <input type="file" accept="image/*,video/*" onChange={handleFile} style={{ display: "none" }} />
      </label>
      {error ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
          {error}
        </span>
      ) : null}
      <ul className="layers-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {scene.layers.map((layer, index) => {
          const active = layer.id === scene.activeLayerId;
          const label = layer.mediaName ?? (layer.mediaType === "video" ? t("editor.videoLabel") : t("editor.imageLabel"));
          return (
              <li
                  key={layer.id}
                  className={active ? "layer-item is-active" : "layer-item"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: active ? "2px solid var(--accent)" : "1px solid var(--panel-border)",
                    background: active ? "rgba(0,217,255,0.08)" : "transparent",
                    cursor: "pointer",
                    opacity: layer.hidden ? 0.5 : 1
                  }}
                  onClick={() => selectLayer(layer.id)}
                >
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
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>∅</span>
                    )}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
                    {label}
                    {isVideoLayer(layer) ? <span role="img" aria-label={t("editor.videoLabel")}> 🎬</span> : null}
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={layer.hidden ? t("editor.showLayer") : t("editor.hideLayer")}
                    title={layer.hidden ? t("editor.showLayer") : t("editor.hideLayer")}
                    onClick={(e) => { e.stopPropagation(); toggleLayerHidden(layer.id); }}
                  >
                    {layer.hidden ? "🚫" : "👁"}
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
