"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Annotation } from "@/lib/types/editor";
import { computeArrowGeometry } from "@/lib/render/annotationArrow";
import { annotationPreviewAnimation } from "@/lib/render/annotationAnimation";

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
    const textStyle: CSSProperties = {
      fontSize: annotation.fontSize * scale,
      color: annotation.color,
      lineHeight: 1.2,
      fontWeight: annotation.fontWeight ?? "bold",
      fontStyle: annotation.fontStyle ?? "normal",
      textAlign: annotation.textAlign ?? "left",
      fontFamily: annotation.fontFamily ?? "Inter, system-ui, sans-serif",
      whiteSpace: "pre-wrap",
      textShadow: "0 1px 3px rgba(0,0,0,0.5)",
      background: annotation.bgColor ?? undefined,
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
    return (
      <div
        className={annotationPreviewAnimation(annotation)?.className}
        style={{
          width: "100%",
          height: "100%",
          border: `${Math.max(1, annotation.strokeWidth * scale)}px solid ${annotation.color}`,
          borderRadius: 4,
          boxSizing: "border-box"
        }}
      />
    );
  }

  if (annotation.type === "circle") {
    return (
      <div
        className={annotationPreviewAnimation(annotation)?.className}
        style={{
          width: "100%",
          height: "100%",
          border: `${Math.max(1, annotation.strokeWidth * scale)}px solid ${annotation.color}`,
          borderRadius: "50%",
          boxSizing: "border-box"
        }}
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
  return (
    <svg className={annotationPreviewAnimation(annotation)?.className} width={bw * (size.w || 1)} height={bh * (size.h || 1)} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <line pathLength={1} x1={startX} y1={startY} x2={endX} y2={endY} stroke={annotation.color} strokeWidth={Math.max(0.5, annotation.strokeWidth * scale)} strokeLinecap="round" />
      <polygon points={points} fill={annotation.color} />
    </svg>
  );
}
