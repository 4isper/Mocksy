"use client";

import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import {
  ANNOTATION_FONT_OPTIONS,
  DEFAULT_ANNOTATION_FONT,
  ALIGN_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  FONT_STYLE_OPTIONS,
  annotationFontWeight,
  annotationFontStyle
} from "@/lib/presets/annotationFonts";
import type { Annotation } from "@/lib/types/editor";

interface AnnotationEditorProps {
  annotation: Annotation;
}

/** The editing form for the selected annotation: common color + (for text)
 *  typography controls, plus size/stroke. Writes straight back to the store. */
export function AnnotationEditor({ annotation }: AnnotationEditorProps) {
  const t = useTranslations();
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const isText = annotation.type === "text";
  const isBlur = annotation.type === "blur";

  return (
    <div className="field-group">
      {isText ? (
        <label className="field">
          <span>{t("annotation.text")}</span>
          <textarea value={annotation.text} rows={2} onChange={(e) => updateAnnotation(annotation.id, { text: e.target.value })} />
        </label>
      ) : null}
      {!isBlur ? (
        <label className="field">
          <span>{t("annotation.color")}</span>
          <input type="color" className="color-input" value={annotation.color} onChange={(e) => updateAnnotation(annotation.id, { color: e.target.value, gradientFrom: undefined, gradientTo: undefined, gradientVia: undefined, gradientType: undefined, gradientAngle: undefined })} />
        </label>
      ) : null}
      {!isBlur ? (
        <label className="field field-inline">
          <input
            type="checkbox"
            checked={!!annotation.gradientFrom && !!annotation.gradientTo}
            onChange={(e) => {
              if (e.target.checked) {
                updateAnnotation(annotation.id, { gradientFrom: annotation.gradientFrom ?? annotation.color, gradientTo: annotation.gradientTo ?? "#ffffff", gradientType: "linear", gradientAngle: 135 });
              } else {
                updateAnnotation(annotation.id, { gradientFrom: undefined, gradientTo: undefined, gradientVia: undefined, gradientType: undefined, gradientAngle: undefined });
              }
            }}
          />
          <span>{t("annotation.gradient")}</span>
        </label>
      ) : null}
      {!isBlur && annotation.gradientFrom && annotation.gradientTo ? (
        <>
          <label className="field">
            <span>{t("annotation.gradientFrom")}</span>
            <input type="color" className="color-input" value={annotation.gradientFrom} onChange={(e) => updateAnnotation(annotation.id, { gradientFrom: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("annotation.gradientTo")}</span>
            <input type="color" className="color-input" value={annotation.gradientTo} onChange={(e) => updateAnnotation(annotation.id, { gradientTo: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("annotation.gradientVia")}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                className="color-input"
                style={{ flex: 1 }}
                value={annotation.gradientVia || "#ffffff"}
                onChange={(e) => updateAnnotation(annotation.id, { gradientVia: e.target.value })}
              />
              {annotation.gradientVia ? (
                <button type="button" className="btn btn-sm" onClick={() => updateAnnotation(annotation.id, { gradientVia: undefined })}>
                  {t("annotation.bgClear")}
                </button>
              ) : null}
            </div>
          </label>
          <label className="field">
            <span>{t("annotation.gradientType")}</span>
            <div className="segmented" role="group" aria-label={t("annotation.gradientType")}>
              <button type="button" className={annotation.gradientType === "linear" ? "is-active" : ""} onClick={() => updateAnnotation(annotation.id, { gradientType: "linear" })}>
                {t("annotation.gradientLinear")}
              </button>
              <button type="button" className={annotation.gradientType === "radial" ? "is-active" : ""} onClick={() => updateAnnotation(annotation.id, { gradientType: "radial" })}>
                {t("annotation.gradientRadial")}
              </button>
            </div>
          </label>
          {annotation.gradientType === "linear" ? (
            <label className="field">
              <span>{t("annotation.gradientAngle", { val: annotation.gradientAngle ?? 135 })}</span>
              <input
                className="range"
                type="range"
                min={0}
                max={360}
                step={1}
                value={annotation.gradientAngle ?? 135}
                aria-label={t("annotation.gradientAngle", { val: annotation.gradientAngle ?? 135 })}
                aria-valuetext={`${annotation.gradientAngle ?? 135} degrees`}
                onChange={(e) => updateAnnotation(annotation.id, { gradientAngle: Number(e.target.value) })}
              />
            </label>
          ) : null}
        </>
      ) : null}
      {isBlur ? (
        <label className="field">
          <span>{t("annotation.blurStrength", { val: annotation.strokeWidth })}</span>
          <input
            className="range"
            type="range"
            min={2}
            max={40}
            step={1}
            value={annotation.strokeWidth}
            aria-label={t("annotation.blurStrength", { val: annotation.strokeWidth })}
            aria-valuetext={`${annotation.strokeWidth} pixels`}
            onChange={(e) => updateAnnotation(annotation.id, { strokeWidth: Number(e.target.value) })}
          />
        </label>
      ) : null}
      {isText ? (
        <label className="field">
          <span>{t("annotation.font")}</span>
          <select value={annotation.fontFamily ?? DEFAULT_ANNOTATION_FONT} onChange={(e) => updateAnnotation(annotation.id, { fontFamily: e.target.value })}>
            {ANNOTATION_FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {isText ? (
        <label className="field">
          <span>{t("annotation.align")}</span>
          <div className="segmented" role="group" aria-label={t("annotation.align")}>
            {ALIGN_OPTIONS.map((a) => (
              <button
                key={a.value}
                type="button"
                className={(annotation.textAlign ?? "left") === a.value ? "is-active" : ""}
                onClick={() => updateAnnotation(annotation.id, { textAlign: a.value })}
              >
                {t(a.labelKey)}
              </button>
            ))}
          </div>
        </label>
      ) : null}
      {isText ? (
        <label className="field">
          <span>{t("annotation.fontWeight")}</span>
          <div className="segmented" role="group" aria-label={t("annotation.fontWeight")}>
            {FONT_WEIGHT_OPTIONS.map((w) => (
              <button
                key={w.value}
                type="button"
                className={annotationFontWeight(annotation.fontWeight) === w.value ? "is-active" : ""}
                onClick={() => updateAnnotation(annotation.id, { fontWeight: w.value })}
              >
                {t(w.labelKey)}
              </button>
            ))}
          </div>
        </label>
      ) : null}
      {isText ? (
        <label className="field">
          <span>{t("annotation.fontStyle")}</span>
          <div className="segmented" role="group" aria-label={t("annotation.fontStyle")}>
            {FONT_STYLE_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={annotationFontStyle(annotation.fontStyle) === s.value ? "is-active" : ""}
                onClick={() => updateAnnotation(annotation.id, { fontStyle: s.value })}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        </label>
      ) : null}
      {isText ? (
        <label className="field">
          <span>{t("annotation.bgColor")}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="color"
              className="color-input"
              style={{ flex: 1 }}
              value={annotation.bgColor || "#09090b"}
              onChange={(e) => updateAnnotation(annotation.id, { bgColor: e.target.value })}
            />
            {annotation.bgColor ? (
              <button type="button" className="btn btn-sm" onClick={() => updateAnnotation(annotation.id, { bgColor: null })}>
                {t("annotation.bgClear")}
              </button>
            ) : null}
          </div>
        </label>
      ) : null}
      {isText && annotation.bgColor ? (
        <>
          <label className="field">
            <span>{t("annotation.bgPadding", { val: annotation.bgPadding ?? 0 })}</span>
            <input
              className="range"
              type="range"
              min={0}
              max={24}
              step={1}
              value={annotation.bgPadding ?? 0}
              aria-label={t("annotation.bgPadding", { val: annotation.bgPadding ?? 0 })}
              aria-valuetext={`${annotation.bgPadding ?? 0}px`}
              onChange={(e) => updateAnnotation(annotation.id, { bgPadding: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>{t("annotation.bgRadius", { val: annotation.bgRadius ?? 0 })}</span>
            <input
              className="range"
              type="range"
              min={0}
              max={20}
              step={1}
              value={annotation.bgRadius ?? 0}
              aria-label={t("annotation.bgRadius", { val: annotation.bgRadius ?? 0 })}
              aria-valuetext={`${annotation.bgRadius ?? 0}px`}
              onChange={(e) => updateAnnotation(annotation.id, { bgRadius: Number(e.target.value) })}
            />
          </label>
        </>
      ) : null}
      {isText ? (
        <label className="field">
          <span>{t("annotation.fontSize", { val: annotation.fontSize })}</span>
          <input
            className="range"
            type="range"
            min={12}
            max={160}
            step={1}
            value={annotation.fontSize}
            aria-label={t("annotation.fontSize", { val: annotation.fontSize })}
            aria-valuetext={`${annotation.fontSize} pixels`}
            onChange={(e) => updateAnnotation(annotation.id, { fontSize: Number(e.target.value) })}
          />
        </label>
      ) : (
        <label className="field">
          <span>{t("annotation.strokeWidth", { val: annotation.strokeWidth })}</span>
          <input
            className="range"
            type="range"
            min={1}
            max={24}
            step={1}
            value={annotation.strokeWidth}
            aria-label={t("annotation.strokeWidth", { val: annotation.strokeWidth })}
            aria-valuetext={`${annotation.strokeWidth} pixels`}
            onChange={(e) => updateAnnotation(annotation.id, { strokeWidth: Number(e.target.value) })}
          />
        </label>
      )}
      <label className="field field-inline">
        <input
          type="checkbox"
          checked={!!annotation.animated}
          onChange={(e) => updateAnnotation(annotation.id, { animated: e.target.checked })}
        />
        <span>{t("annotation.animate")}</span>
      </label>
      <button type="button" className="btn btn-sm" onClick={() => removeAnnotation(annotation.id)}>
        {t("annotation.delete")}
      </button>
      <p className="anno-hint">{t("annotation.editHint")}</p>
    </div>
  );
}
