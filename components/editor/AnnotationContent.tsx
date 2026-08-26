"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Annotation } from "@/lib/types/editor";
import { computeArrowGeometry } from "@/lib/render/annotationArrow";
import { annotationPreviewAnimation } from "@/lib/render/annotationAnimation";
import { hasAnnotationGradient, annotationGradientCSS } from "@/lib/render/annotationGradient";

interface AnnotationContentProps {
  annotation: Annotation;
  size: { w: number; h: number };
  /** Overlay chrome scale (artboard width / reference width): multiplies every
   *  px-authored value below so annotations keep their proportions relative
   *  to the mockup at any canvas size, matching the exports. */
  scale: number;
  bx: number;
  by: number;
  editing: boolean;
  editRef: React.RefObject<HTMLDivElement | null>;
  onTextInput: (text: string) => void;
  onStopEditing: () => void;
  onStartEditing: () => void;
}

/** Renders the inner body of an annotation by type: editable text, a rect or
 *  circle outline, or the measured SVG arrow. Purely presentational — all
 *  gesture/drag handling lives in the parent AnnotationItem. */
export function AnnotationContent({
  annotation,
  size,
  scale,
  bx,
  by,
  editing,
  editRef,
  onTextInput,
  onStopEditing,
  onStartEditing
}: AnnotationContentProps): ReactNode {
  if (annotation.type === "text") {
    const gradientCSS = annotationGradientCSS(annotation);
    const textStyle: CSSProperties = {
      fontSize: annotation.fontSize * scale,
      color: gradientCSS ? "transparent" : annotation.color,
      lineHeight: 1.2,
      fontWeight: annotation.fontWeight ?? "bold",
      fontStyle: annotation.fontStyle ?? "normal",
      textAlign: annotation.textAlign ?? "left",
      fontFamily: annotation.fontFamily ?? "Inter, system-ui, sans-serif",
      whiteSpace: "pre-wrap",
      textShadow: gradientCSS ? "none" : "0 1px 3px rgba(0,0,0,0.5)",
      background: gradientCSS
        ? `${gradientCSS}, ${annotation.bgColor ?? "transparent"}`
        : annotation.bgColor ?? undefined,
      backgroundClip: gradientCSS ? "text" : undefined,
      WebkitBackgroundClip: gradientCSS ? "text" : undefined,
      padding: annotation.bgColor ? (annotation.bgPadding ?? 0) * scale : 0,
      borderRadius: annotation.bgColor ? (annotation.bgRadius ?? 0) * scale : 0,
      display: "inline-block"
    };
    // Double-click edits the text in place: the label becomes contentEditable
    // until it loses focus, then the edited value is committed back to the
    // scene. Pointer-down must not start a drag while editing.
    return editing ? (
      <div
        ref={editRef as React.RefObject<HTMLDivElement>}
        contentEditable
        suppressContentEditableWarning
        style={{ ...textStyle, outline: "none", minWidth: 24, cursor: "text" }}
        onPointerDown={(e) => e.stopPropagation()}
        onInput={(e) => onTextInput(e.currentTarget.textContent ?? "")}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.currentTarget.blur();
          }
        }}
        onBlur={onStopEditing}
      >
        {annotation.text}
      </div>
    ) : (
      <div className={annotationPreviewAnimation(annotation)?.className} style={textStyle} onDoubleClick={onStartEditing}>
        {annotation.text}
      </div>
    );
  }

  if (annotation.type === "rect") {
    const gradientCSS = annotationGradientCSS(annotation);
    const sw = Math.max(1, annotation.strokeWidth * scale);
    const borderStyle: CSSProperties = gradientCSS
      ? {
          width: "100%",
          height: "100%",
          border: `${sw}px solid transparent`,
          borderRadius: 4,
          boxSizing: "border-box",
          background: `${gradientCSS} padding-box, ${gradientCSS} border-box`
        }
      : {
          width: "100%",
          height: "100%",
          border: `${sw}px solid ${annotation.color}`,
          borderRadius: 4,
          boxSizing: "border-box"
        };
    return (
      <div
        className={annotationPreviewAnimation(annotation)?.className}
        style={borderStyle}
      />
    );
  }

  if (annotation.type === "circle") {
    const gradientCSS = annotationGradientCSS(annotation);
    const sw = Math.max(1, annotation.strokeWidth * scale);
    const borderStyle: CSSProperties = gradientCSS
      ? {
          width: "100%",
          height: "100%",
          border: `${sw}px solid transparent`,
          borderRadius: "50%",
          boxSizing: "border-box",
          background: `${gradientCSS} padding-box, ${gradientCSS} border-box`
        }
      : {
          width: "100%",
          height: "100%",
          border: `${sw}px solid ${annotation.color}`,
          borderRadius: "50%",
          boxSizing: "border-box"
        };
    return (
      <div
        className={annotationPreviewAnimation(annotation)?.className}
        style={borderStyle}
      />
    );
  }

  if (annotation.type === "blur") {
    // Frosted-glass region: blurs whatever is painted beneath it. The canvas
    // export mirrors this by re-drawing a blurred snapshot of the composite.
    return (
      <div
        className={annotationPreviewAnimation(annotation)?.className}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 8,
          backdropFilter: `blur(${Math.max(1, annotation.strokeWidth * scale)}px)`,
          WebkitBackdropFilter: `blur(${Math.max(1, annotation.strokeWidth * scale)}px)`
        }}
      />
    );
  }

  // arrow
  const bw = Math.abs(annotation.w) || 1e-4;
  const bh = Math.abs(annotation.h) || 1e-4;
  const { startX, startY, endX, endY, points } = computeArrowGeometry(annotation, size.w, size.h, bx, by, scale);
  const gradId = `anno-grad-${annotation.id}`;
  const gradDef = (() => {
    if (!hasAnnotationGradient(annotation)) return null;
    const from = annotation.gradientFrom!;
    const to = annotation.gradientTo!;
    const via = annotation.gradientVia;
    if (annotation.gradientType === "radial") {
      return `<radialGradient id="${gradId}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${from}"/>${via ? `<stop offset="50%" stop-color="${via}"/>` : ""}<stop offset="100%" stop-color="${to}"/></radialGradient>`;
    }
    const angle = annotation.gradientAngle ?? 135;
    const rad = (angle * Math.PI) / 180;
    const x1 = (50 - Math.cos(rad) * 50).toFixed(1);
    const y1 = (50 - Math.sin(rad) * 50).toFixed(1);
    const x2 = (50 + Math.cos(rad) * 50).toFixed(1);
    const y2 = (50 + Math.sin(rad) * 50).toFixed(1);
    return `<linearGradient id="${gradId}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0%" stop-color="${from}"/>${via ? `<stop offset="50%" stop-color="${via}"/>` : ""}<stop offset="100%" stop-color="${to}"/></linearGradient>`;
  })();
  const strokeColor = hasAnnotationGradient(annotation) ? `url(#${gradId})` : annotation.color;
  return (
    <svg className={annotationPreviewAnimation(annotation)?.className} width={bw * (size.w || 1)} height={bh * (size.h || 1)} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {gradDef ? <defs dangerouslySetInnerHTML={{ __html: gradDef }} /> : null}
      <line pathLength={1} x1={startX} y1={startY} x2={endX} y2={endY} stroke={strokeColor} strokeWidth={Math.max(0.5, annotation.strokeWidth * scale)} strokeLinecap="round" />
      <polygon points={points} fill={strokeColor} />
    </svg>
  );
}
