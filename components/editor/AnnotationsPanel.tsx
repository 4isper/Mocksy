"use client";

import { useEditorStore } from "@/lib/state/editorStore";
import type { AnnotationType } from "@/lib/types/editor";

const TYPE_LABELS: Record<AnnotationType, string> = {
  text: "Text",
  arrow: "Arrow",
  rect: "Box"
};

export function AnnotationsPanel() {
  const scene = useEditorStore((s) => s.scene);
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const addAnnotation = useEditorStore((s) => s.addAnnotation);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const clearAnnotations = useEditorStore((s) => s.clearAnnotations);

  const selected = scene.annotations.find((a) => a.id === selectedAnnotationId) ?? null;

  return (
    <div
      className="panel annotations-panel"
      style={{ padding: 16, display: "grid", gap: 14, minHeight: 0 }}
    >
      <h2 className="panel-title">Annotations</h2>
      <div className="segmented" role="group" aria-label="Add annotation">
        <button type="button" onClick={() => addAnnotation("text")}>
          + Text
        </button>
        <button type="button" onClick={() => addAnnotation("arrow")}>
          + Arrow
        </button>
        <button type="button" onClick={() => addAnnotation("rect")}>
          + Box
        </button>
      </div>

      {scene.annotations.length === 0 ? (
        <p style={{ color: "var(--text-faint)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          Add callouts, arrows or boxes to annotate the mockup. Drag them on the canvas to reposition.
        </p>
      ) : (
        <div className="field-group">
          {scene.annotations.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={a.id === selectedAnnotationId ? "anno-row is-active" : "anno-row"}
              onClick={() => selectAnnotation(a.id === selectedAnnotationId ? null : a.id)}
            >
              <span className="anno-swatch" style={{ background: a.color }} aria-hidden="true" />
              {TYPE_LABELS[a.type]} {i + 1}
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="field-group">
          {selected.type === "text" ? (
            <label className="field">
              <span>Text</span>
              <textarea
                value={selected.text}
                rows={2}
                onChange={(e) => updateAnnotation(selected.id, { text: e.target.value })}
              />
            </label>
          ) : null}
          <label className="field">
            <span>Color</span>
            <input
              type="color"
              value={selected.color}
              onChange={(e) => updateAnnotation(selected.id, { color: e.target.value })}
            />
          </label>
          {selected.type === "text" ? (
            <label className="field">
              <span>Font size ({selected.fontSize}px)</span>
              <input
                className="range"
                type="range"
                min={12}
                max={160}
                step={1}
                value={selected.fontSize}
                aria-label="Font size"
                aria-valuetext={`${selected.fontSize} pixels`}
                onChange={(e) => updateAnnotation(selected.id, { fontSize: Number(e.target.value) })}
              />
            </label>
          ) : (
            <label className="field">
              <span>Stroke ({selected.strokeWidth}px)</span>
              <input
                className="range"
                type="range"
                min={1}
                max={24}
                step={1}
                value={selected.strokeWidth}
                aria-label="Stroke width"
                aria-valuetext={`${selected.strokeWidth} pixels`}
                onChange={(e) => updateAnnotation(selected.id, { strokeWidth: Number(e.target.value) })}
              />
            </label>
          )}
          <button type="button" className="btn btn-sm" onClick={() => removeAnnotation(selected.id)}>
            Delete
          </button>
        </div>
      ) : null}

      {scene.annotations.length > 0 ? (
        <button type="button" className="btn btn-sm" onClick={clearAnnotations}>
          Clear all
        </button>
      ) : null}
    </div>
  );
}
