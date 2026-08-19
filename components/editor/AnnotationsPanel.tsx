"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import type { AnnotationType } from "@/lib/types/editor";

export function AnnotationsPanel() {
  const t = useTranslations();
  const TYPE_LABELS: Record<AnnotationType, string> = {
    text: t("annotation.text"),
    arrow: t("annotation.arrow"),
    rect: t("annotation.rect"),
    circle: t("annotation.circle")
  };
  const scene = useEditorStore((s) => s.scene);
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const addAnnotation = useEditorStore((s) => s.addAnnotation);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const clearAnnotations = useEditorStore((s) => s.clearAnnotations);
  const [confirmClear, setConfirmClear] = useState(false);
  const clearTrapRef = useFocusTrap(confirmClear);

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
        <button type="button" onClick={() => addAnnotation("circle")}>
          {t("editor.addCircle")}
        </button>
      </div>

      {scene.annotations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 3l7 7M10 10l7 7M17 17l-7-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.3"/></svg>
          </div>
          <p className="empty-state-text">{t("editor.noAnnotations")}</p>
          <p className="empty-state-text" style={{ fontSize: 11, color: "var(--text-dim)" }}>{t("annotation.addCallouts")}</p>
        </div>
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
                <option value="Montserrat, sans-serif">Montserrat</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="Lora, Georgia, serif">Lora</option>
                <option value="Caveat, cursive">Caveat</option>
                <option value="system-ui">System UI</option>
                <option value="Arial, Helvetica, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
              </select>
            </label>
          ) : null}
          {selected.type === "text" ? (
            <label className="field">
              <span>{t("annotation.align")}</span>
              <div className="segmented" role="group" aria-label={t("annotation.align")}>
                {(["left", "center", "right"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={(selected.textAlign ?? "left") === a ? "is-active" : ""}
                    onClick={() => updateAnnotation(selected.id, { textAlign: a })}
                  >
                    {t(`annotation.align${a.charAt(0).toUpperCase()}${a.slice(1)}`)}
                  </button>
                ))}
              </div>
            </label>
          ) : null}
          {selected.type === "text" ? (
            <label className="field">
              <span>{t("annotation.fontWeight")}</span>
              <div className="segmented" role="group" aria-label={t("annotation.fontWeight")}>
                <button
                  type="button"
                  className={(selected.fontWeight ?? "bold") === "bold" ? "is-active" : ""}
                  onClick={() => updateAnnotation(selected.id, { fontWeight: "bold" })}
                >
                  {t("annotation.bold")}
                </button>
                <button
                  type="button"
                  className={(selected.fontWeight ?? "bold") === "normal" ? "is-active" : ""}
                  onClick={() => updateAnnotation(selected.id, { fontWeight: "normal" })}
                >
                  {t("annotation.regular")}
                </button>
              </div>
            </label>
          ) : null}
          {selected.type === "text" ? (
            <label className="field">
              <span>{t("annotation.fontStyle")}</span>
              <div className="segmented" role="group" aria-label={t("annotation.fontStyle")}>
                <button
                  type="button"
                  className={(selected.fontStyle ?? "normal") === "normal" ? "is-active" : ""}
                  onClick={() => updateAnnotation(selected.id, { fontStyle: "normal" })}
                >
                  {t("annotation.normal")}
                </button>
                <button
                  type="button"
                  className={(selected.fontStyle ?? "normal") === "italic" ? "is-active" : ""}
                  onClick={() => updateAnnotation(selected.id, { fontStyle: "italic" })}
                >
                  {t("annotation.italic")}
                </button>
              </div>
            </label>
          ) : null}
          {selected.type === "text" ? (
            <label className="field">
              <span>{t("annotation.bgColor")}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={selected.bgColor || "#09090b"}
                  onChange={(e) => updateAnnotation(selected.id, { bgColor: e.target.value })}
                  style={{ flex: 1 }}
                />
                {selected.bgColor ? (
                  <button type="button" className="btn btn-sm" onClick={() => updateAnnotation(selected.id, { bgColor: null })}>
                    {t("annotation.bgClear")}
                  </button>
                ) : null}
              </div>
            </label>
          ) : null}
          {selected.type === "text" && selected.bgColor ? (
            <>
              <label className="field">
                <span>{t("annotation.bgPadding", { val: selected.bgPadding ?? 0 })}</span>
                <input
                  className="range"
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={selected.bgPadding ?? 0}
                  aria-label={t("annotation.bgPadding", { val: selected.bgPadding ?? 0 })}
                  aria-valuetext={`${selected.bgPadding ?? 0}px`}
                  onChange={(e) => updateAnnotation(selected.id, { bgPadding: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>{t("annotation.bgRadius", { val: selected.bgRadius ?? 0 })}</span>
                <input
                  className="range"
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={selected.bgRadius ?? 0}
                  aria-label={t("annotation.bgRadius", { val: selected.bgRadius ?? 0 })}
                  aria-valuetext={`${selected.bgRadius ?? 0}px`}
                  onChange={(e) => updateAnnotation(selected.id, { bgRadius: Number(e.target.value) })}
                />
              </label>
            </>
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
          <p className="anno-hint">{t("annotation.editHint")}</p>
        </div>
      ) : null}

      {scene.annotations.length > 0 ? (
        <button type="button" className="btn btn-sm" onClick={() => setConfirmClear(true)}>
          {t("annotation.clearAll")}
        </button>
      ) : null}
      {confirmClear ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmClear(false)}>
          <div
            className="modal"
            ref={clearTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-anno-title"
            aria-describedby="clear-anno-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="clear-anno-title">{t("annotation.clearAllConfirm_title")}</h3>
            <p id="clear-anno-desc">{t("annotation.clearAllConfirm_message")}</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setConfirmClear(false)} autoFocus>
                {t("annotation.clearAllConfirm_cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  clearAnnotations();
                  setConfirmClear(false);
                }}
              >
                {t("annotation.clearAllConfirm_confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
