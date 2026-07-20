"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { isVideoLayer } from "@/lib/render/mediaKind";

export function LayersPanel() {
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
      setError(err instanceof UnsupportedMediaError ? err.message : "Could not load that file.");
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
    <div className="panel layers-panel" style={{ padding: 16, display: "grid", gap: 10, alignContent: "start" }}>
      <h2 className="panel-title">Layers</h2>
      <label className="file-trigger">
        Add layer
        <input type="file" accept="image/*,video/*" onChange={handleFile} />
      </label>
      {error ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
          {error}
        </span>
      ) : null}
      <ul className="layers-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {scene.layers.map((layer, index) => {
          const active = layer.id === scene.activeLayerId;
          const label = layer.mediaName ?? (layer.mediaType === "video" ? "Video" : "Image");
          return (
            <li
              key={layer.id}
              className={active ? "layer-item is-active" : "layer-item"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
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
                  width: 32,
                  height: 32,
                  flex: "0 0 auto",
                  borderRadius: 6,
                  overflow: "hidden",
                  background: "#0a0a0a",
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid var(--panel-border)"
                }}
              >
                {layer.mediaUrl ? (
                  isVideoLayer(layer) ? (
                    <video
                      src={layer.mediaUrl}
                      muted
                      playsInline
                      preload="metadata"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    // Local blob/object URLs can't be optimized by next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={layer.mediaUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )
                ) : (
                  <span style={{ fontSize: 14, color: "var(--text-dim)" }}>∅</span>
                )}
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
                {isVideoLayer(layer) ? " 🎬" : ""}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={layer.hidden ? `Show ${label}` : `Hide ${label}`}
                title={layer.hidden ? "Show layer" : "Hide layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayerHidden(layer.id);
                }}
              >
                {layer.hidden ? "🚫" : "👁"}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label="Duplicate layer"
                title="Duplicate layer"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateLayer(layer.id);
                }}
              >
                ⧉
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label="Move layer up"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  move(layer.id, -1);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label="Move layer down"
                disabled={index === scene.layers.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  move(layer.id, 1);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={`Remove ${label}`}
                disabled={scene.layers.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  removeLayer(layer.id);
                }}
              >
                ✕
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
          title="Remove media from the selected layer"
        >
          Clear media
        </button>
      ) : null}
      <p style={{ color: "var(--text-dim)", fontSize: 12, margin: 0 }}>
        Layers stack top to bottom. Select a layer to edit its zoom, position and video options. Shortcuts for the active layer: ⌘D duplicate, ⌘↑ / ⌘↓ reorder, ⌘[ / ⌘] switch.
      </p>
    </div>
  );
}
