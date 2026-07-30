"use client";

import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import type { AnnotationType } from "@/lib/types/editor";

export function AnnotationsPanel() {
  const t = useTranslations();
  const TYPE_LABELS: Record<AnnotationType, string> = {
    text: t("annotation.text"),
    arrow: t("annotation.arrow"),
    rect: t("annotation.rect")
  };
  const scene = useEditorStore((s) => s.scene);
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const addAnnotation = useEditorStore((s) => s.addAnnotation);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const clearAnnotations = useEditorStore((s) => s.clearAnnotations);

  const selected = scene.annotations.find((a) => a.id === selectedAnnotationId) ?? null;

  return (
    <div style={{ padding: 10, display: "grid", gap: 10, overflow: "auto", minHeight: 0, minWidth: 0 }}>
      <div className="segmented" role="group" aria-label={t("annotation.addAnnotation")}>
        <button type="button" onClick={() => addAnnotation("text")}>
          {t("editor.addText")}
        </button>
        <button type="button" onClick={() => addAnnotation("arrow")}>
          {t("editor.addArrow")}
        </button>
        <button type="button" onClick={() => addAnnotation("rect")}>
          {t("editor.addBox")}
        </button>
      </div>

      {scene.annotations.length === 0 ? (
        <p style={{ color: "var(--text-faint)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          {t("annotation.addCallouts")}
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
              <span>{t("annotation.text")}</span>
              <textarea
                value={selected.text}
                rows={2}
                onChange={(e) => updateAnnotation(selected.id, { text: e.target.value })}
              />
            </label>
          ) : null}
          <label className="field">
            <span>{t("annotation.color")}</span>
            <input
              type="color"
              value={selected.color}
              onChange={(e) => updateAnnotation(selected.id, { color: e.target.value })}
            />
          </label>
          {selected.type === "text" ? (
            <label className="field">
              <span>{t("annotation.font")}</span>
              <select
                value={selected.fontFamily ?? "Inter, system-ui, sans-serif"}
                onChange={(e) => updateAnnotation(selected.id, { fontFamily: e.target.value })}
              >
                <option value="Inter, system-ui, sans-serif">Inter</option>
                <option value="system-ui">System UI</option>
                <option value="Arial, Helvetica, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
              </select>
            </label>
          ) : null}
          {selected.type === "text" ? (
            <label className="field">
              <span>{t("annotation.fontSize", { val: selected.fontSize })}</span>
              <input
                className="range"
                type="range"
                min={12}
                max={160}
                step={1}
                value={selected.fontSize}
                aria-label={t("annotation.fontSize", { val: selected.fontSize })}
                aria-valuetext={`${selected.fontSize} pixels`}
                onChange={(e) => updateAnnotation(selected.id, { fontSize: Number(e.target.value) })}
              />
            </label>
          ) : (
            <label className="field">
              <span>{t("annotation.strokeWidth", { val: selected.strokeWidth })}</span>
              <input
                className="range"
                type="range"
                min={1}
                max={24}
                step={1}
                value={selected.strokeWidth}
                aria-label={t("annotation.strokeWidth", { val: selected.strokeWidth })}
                aria-valuetext={`${selected.strokeWidth} pixels`}
                onChange={(e) => updateAnnotation(selected.id, { strokeWidth: Number(e.target.value) })}
              />
            </label>
          )}
          <button type="button" className="btn btn-sm" onClick={() => removeAnnotation(selected.id)}>
            {t("annotation.delete")}
          </button>
        </div>
      ) : null}

      {scene.annotations.length > 0 ? (
        <button type="button" className="btn btn-sm" onClick={clearAnnotations}>
          {t("annotation.clearAll")}
        </button>
      ) : null}
    </div>
  );
}
