"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import type { AnnotationType } from "@/lib/types/editor";
import { AnnotationEditor } from "@/components/editor/AnnotationEditor";
import { ClearAnnotationsDialog } from "@/components/editor/ClearAnnotationsDialog";

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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 3l7 7M10 10l7 7M17 17l-7-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.3" /></svg>
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

      {selected ? <AnnotationEditor annotation={selected} /> : null}

      {scene.annotations.length > 0 ? (
        <button type="button" className="btn btn-sm" onClick={() => setConfirmClear(true)}>
          {t("annotation.clearAll")}
        </button>
      ) : null}
      {confirmClear ? (
        <ClearAnnotationsDialog
          trapRef={clearTrapRef}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            clearAnnotations();
            setConfirmClear(false);
          }}
        />
      ) : null}
    </div>
  );
}
