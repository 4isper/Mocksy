"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import type { AnnotationType } from "@/lib/types/editor";
import { alignAnnotations, distributeAnnotations, type AlignOp, type DistributeOp } from "@/lib/render/annotationAlign";
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
  const selectedAnnotationIds = useEditorStore((s) => s.selectedAnnotationIds);
  const addAnnotation = useEditorStore((s) => s.addAnnotation);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const applyAnnotationPatches = useEditorStore((s) => s.applyAnnotationPatches);
  const clearAnnotations = useEditorStore((s) => s.clearAnnotations);
  const [confirmClear, setConfirmClear] = useState(false);
  const clearTrapRef = useFocusTrap(confirmClear);

  const selected = scene.annotations.find((a) => a.id === selectedAnnotationId) ?? null;
  const multiSelected = scene.annotations.filter((a) => selectedAnnotationIds.includes(a.id));

  const runAlign = (op: AlignOp) => {
    if (multiSelected.length < 1) return;
    applyAnnotationPatches(alignAnnotations(multiSelected, op));
  };
  const runDistribute = (op: DistributeOp) => {
    if (multiSelected.length < 3) return;
    applyAnnotationPatches(distributeAnnotations(multiSelected, op));
  };

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

      {selectedAnnotationIds.length > 1 ? (
        <div className="align-toolbar" role="group" aria-label={t("annotation.align")}>
          <button type="button" aria-label={t("annotation.alignLeft")} onClick={() => runAlign("left")}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 2v10M5 4h6M5 7h4M5 10h6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg></button>
          <button type="button" aria-label={t("annotation.alignCenterH")} onClick={() => runAlign("centerH")}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v10M5 4h4M6 7h2M5 10h4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg></button>
          <button type="button" aria-label={t("annotation.alignRight")} onClick={() => runAlign("right")}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M12 2v10M3 4h6M5 7h4M3 10h6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg></button>
          <button type="button" aria-label={t("annotation.alignTop")} onClick={() => runAlign("top")}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 2h10M4 5v6M7 5v4M10 5v6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg></button>
          <button type="button" aria-label={t("annotation.alignCenterV")} onClick={() => runAlign("centerV")}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7h10M4 5v4M7 6v2M10 5v4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg></button>
          <button type="button" aria-label={t("annotation.alignBottom")} onClick={() => runAlign("bottom")}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 12h10M4 2v6M7 2v4M10 2v6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg></button>
          <button type="button" aria-label={t("annotation.distributeH")} disabled={selectedAnnotationIds.length < 3} onClick={() => runDistribute("horizontal")}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3v8M7 3v8M11 3v8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg></button>
          <button type="button" aria-label={t("annotation.distributeV")} disabled={selectedAnnotationIds.length < 3} onClick={() => runDistribute("vertical")}><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3h8M3 7h8M3 11h8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg></button>
        </div>
      ) : null}

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
          {scene.annotations.map((a, i) => {
            const isSelected = selectedAnnotationIds.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={isSelected}
                className={isSelected ? "anno-row is-active" : "anno-row"}
                onClick={(e) => {
                  if (e.shiftKey) {
                    selectAnnotation(a.id, true);
                  } else {
                    selectAnnotation(a.id === selectedAnnotationId ? null : a.id);
                  }
                }}
              >
                <span className="anno-swatch" style={{ background: a.color }} aria-hidden="true" />
                {TYPE_LABELS[a.type]} {i + 1}
              </button>
            );
          })}
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
