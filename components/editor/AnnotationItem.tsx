"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Annotation } from "@/lib/types/editor";
import { useTranslations } from "next-intl";
import { snapToGrid } from "@/lib/render/grid";
import { computeSmartGuide, type GuideLine } from "@/lib/render/annotationAlign";
import { resolveZoomScale } from "@/lib/render/previewViewport";
import { useEditorStore } from "@/lib/state/editorStore";
import { AnnotationContent } from "@/components/editor/AnnotationContent";

interface AnnotationItemProps {
  annotation: Annotation;
  selected: boolean;
  /** Other annotations on the canvas, used for smart-guide snapping. */
  others: Annotation[];
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Grid divisions per axis to snap to, or null to move freely. */
  snapDivisions?: number | null;
  onSelect: (id: string, additive?: boolean) => void;
  onSelectMany: (ids: string[]) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onGuides: (guides: GuideLine[]) => void;
}

/**
 * One annotation overlay in the live preview. Coordinates are fractions of the
 * canvas, so the element is positioned with percentages. Dragging/resizing are
 * pointer gestures that map deltas onto the canvas fractions (snapping when a
 * grid is active; smart-guide snapping to other annotations otherwise); the
 * rendered body (text/rect/circle/arrow) is delegated to AnnotationContent.
 */
export function AnnotationItem({ annotation, selected, others, canvasRef, snapDivisions = null, onSelect, onSelectMany, onUpdate, onGuides }: AnnotationItemProps) {
  const t = useTranslations();
  // View zoom is captured when a gesture starts: pointer deltas are screen
  // pixels while the canvas fractions below assume unscaled canvas pixels,
  // so the deltas are divided back down by this factor in the move handlers.
  const moveRef = useRef<{ x: number; y: number; ax: number; ay: number; viewScale: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; aw: number; ah: number; viewScale: number } | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  // Measured canvas size, captured after layout so the arrow renders at the
  // correct pixel scale on first paint (the ref is null during the initial
  // render, before the canvas has been laid out).
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) setSize({ w: canvas.clientWidth, h: canvas.clientHeight });
  }, [canvasRef, annotation.x, annotation.y, annotation.w, annotation.h, annotation.type]);

  // Focus the in-place editor when it mounts and place the caret at the end so
  // typing appends instead of inserting at the start.
  useLayoutEffect(() => {
    if (!editing) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    range.collapse(false);
  }, [editing]);

  const onBodyDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    // Shift-click extends the selection (toggle) for align/distribute; a plain
    // click selects just this annotation.
    onSelect(annotation.id, e.shiftKey);
    const canvas = canvasRef.current;
    if (!canvas) return;
    moveRef.current = { x: e.clientX, y: e.clientY, ax: annotation.x, ay: annotation.y, viewScale: resolveZoomScale(useEditorStore.getState().previewZoom) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBodyMove = (e: React.PointerEvent) => {
    const m = moveRef.current;
    const canvas = canvasRef.current;
    if (!m || !canvas) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    let nx = Math.max(-1, Math.min(2, m.ax + (e.clientX - m.x) / w / m.viewScale));
    let ny = Math.max(-1, Math.min(2, m.ay + (e.clientY - m.y) / h / m.viewScale));
    if (snapDivisions) {
      nx = snapToGrid(nx, snapDivisions);
      ny = snapToGrid(ny, snapDivisions);
    } else {
      // Smart guides: snap the dragged box to the canvas centerlines and to the
      // edges/centers of other annotations when within a small threshold. The
      // grid takes precedence when it is active.
      const guided = computeSmartGuide({ ...annotation, x: nx, y: ny }, others);
      nx = guided.x;
      ny = guided.y;
      onGuides(guided.guides);
    }
    onUpdate(annotation.id, { x: nx, y: ny });
  };
  const onBodyUp = (e: React.PointerEvent) => {
    moveRef.current = null;
    onGuides([]);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeRef.current = { x: e.clientX, y: e.clientY, aw: annotation.w, ah: annotation.h, viewScale: resolveZoomScale(useEditorStore.getState().previewZoom) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    const canvas = canvasRef.current;
    if (!r || !canvas) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    let nw = Math.max(-2, Math.min(2, r.aw + ((e.clientX - r.x) / w) / r.viewScale));
    let nh = Math.max(-2, Math.min(2, r.ah + ((e.clientY - r.y) / h) / r.viewScale));
    if (snapDivisions) {
      nw = snapToGrid(nw, snapDivisions);
      nh = snapToGrid(nh, snapDivisions);
    }
    onUpdate(annotation.id, { w: nw, h: nh });
  };
  const onResizeUp = (e: React.PointerEvent) => {
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const bx = Math.min(annotation.x, annotation.x + annotation.w);
  const by = Math.min(annotation.y, annotation.y + annotation.h);
  const bw = Math.abs(annotation.w) || 1e-4;
  const bh = Math.abs(annotation.h) || 1e-4;

  const boxStyle: CSSProperties = {
    position: "absolute",
    left: `${bx * 100}%`,
    top: `${by * 100}%`,
    width: `${bw * 100}%`,
    height: annotation.type === "text" ? "auto" : `${bh * 100}%`,
    cursor: "move",
    touchAction: "none",
    outline: selected ? "1px solid var(--accent)" : "1px dashed transparent",
    outlineOffset: 2,
    zIndex: 2,
    pointerEvents: "auto",
    // Position the inline-block text child (center/right) within the box to
    // match the exported canvas, which centers/rights text inside the box.
    textAlign: annotation.textAlign ?? "left"
  };

  const onBoxKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    if (!e.key.startsWith("Arrow")) return;
    e.preventDefault();
    onSelect(annotation.id);
    const step = e.shiftKey ? 0.02 : 0.01;
    if (e.altKey) {
      // Alt+arrows grow/shrink the annotation box.
      let nw = annotation.w;
      let nh = annotation.h;
      if (e.key === "ArrowRight") nw += step;
      if (e.key === "ArrowLeft") nw -= step;
      if (e.key === "ArrowDown") nh += step;
      if (e.key === "ArrowUp") nh -= step;
      onUpdate(annotation.id, { w: nw, h: nh });
      return;
    }
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0]
    };
    const [dx, dy] = dirs[e.key] ?? [0, 0];
    onUpdate(annotation.id, { x: annotation.x + dx, y: annotation.y + dy });
  };

  return (
    <div
      data-annotation
      data-annotation-id={annotation.id}
      tabIndex={0}
      role="group"
      aria-label={t("editor.annotationAria")}
      style={boxStyle}
      onKeyDown={onBoxKeyDown}
      onPointerDown={onBodyDown}
      onPointerMove={onBodyMove}
      onPointerUp={onBodyUp}
      onPointerCancel={onBodyUp}
    >
      <AnnotationContent
        annotation={annotation}
        size={size}
        bx={bx}
        by={by}
        editing={editing}
        editRef={editRef}
        onTextInput={(text) => onUpdate(annotation.id, { text })}
        onStopEditing={() => setEditing(false)}
        onStartEditing={() => setEditing(true)}
      />
      {selected ? (
        <span
          aria-label={t("editor.resizeAnnotation")}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
          style={{
            position: "absolute",
            right: -6,
            bottom: -6,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "2px solid #07070a",
            cursor: "nwse-resize",
            touchAction: "none"
          }}
        />
      ) : null}
    </div>
  );
}
