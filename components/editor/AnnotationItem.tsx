"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Annotation } from "@/lib/types/editor";
import { useTranslations } from "next-intl";
import { snapToGrid } from "@/lib/render/grid";

interface AnnotationItemProps {
  annotation: Annotation;
  selected: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Grid divisions per axis to snap to, or null to move freely. */
  snapDivisions?: number | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
}

/**
 * One annotation overlay in the live preview. Coordinates are fractions of the
 * canvas, so the element is positioned with percentages and the SVG arrow is
 * drawn at measured pixel size (read from the canvas after layout) so its
 * stroke width and arrowhead match the exported PNG exactly.
 */
export function AnnotationItem({ annotation, selected, canvasRef, snapDivisions = null, onSelect, onUpdate }: AnnotationItemProps) {
  const t = useTranslations();
  const moveRef = useRef<{ x: number; y: number; ax: number; ay: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; aw: number; ah: number } | null>(null);
  // Measured canvas size, captured after layout so the arrow renders at the
  // correct pixel scale on first paint (the ref is null during the initial
  // render, before the canvas has been laid out).
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) setSize({ w: canvas.clientWidth, h: canvas.clientHeight });
  }, [canvasRef, annotation.x, annotation.y, annotation.w, annotation.h, annotation.type]);

  const onBodyDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(annotation.id);
    const canvas = canvasRef.current;
    if (!canvas) return;
    moveRef.current = { x: e.clientX, y: e.clientY, ax: annotation.x, ay: annotation.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBodyMove = (e: React.PointerEvent) => {
    const m = moveRef.current;
    const canvas = canvasRef.current;
    if (!m || !canvas) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    let nx = Math.max(-1, Math.min(2, m.ax + (e.clientX - m.x) / w));
    let ny = Math.max(-1, Math.min(2, m.ay + (e.clientY - m.y) / h));
    if (snapDivisions) {
      nx = snapToGrid(nx, snapDivisions);
      ny = snapToGrid(ny, snapDivisions);
    }
    onUpdate(annotation.id, { x: nx, y: ny });
  };
  const onBodyUp = (e: React.PointerEvent) => {
    moveRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeRef.current = { x: e.clientX, y: e.clientY, aw: annotation.w, ah: annotation.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    const canvas = canvasRef.current;
    if (!r || !canvas) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    let nw = Math.max(-2, Math.min(2, r.aw + (e.clientX - r.x) / w));
    let nh = Math.max(-2, Math.min(2, r.ah + (e.clientY - r.y) / h));
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
    zIndex: 2
  };

  let content: ReactNode = null;
  if (annotation.type === "text") {
    content = (
      <div
        style={{
          fontSize: annotation.fontSize,
          color: annotation.color,
          lineHeight: 1.2,
          fontWeight: 600,
          fontFamily: annotation.fontFamily ?? "Inter, system-ui, sans-serif",
          whiteSpace: "pre-wrap",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)"
        }}
      >
        {annotation.text}
      </div>
    );
  } else if (annotation.type === "rect") {
    content = (
      <div
        style={{
          width: "100%",
          height: "100%",
          border: `${annotation.strokeWidth}px solid ${annotation.color}`,
          borderRadius: 4,
          boxSizing: "border-box"
        }}
      />
    );
  } else {
    const cw = size.w || 1;
    const ch = size.h || 1;
    const startX = (annotation.x - bx) * cw;
    const startY = (annotation.y - by) * ch;
    const endX = startX + annotation.w * cw;
    const endY = startY + annotation.h * ch;
    const angle = Math.atan2(endY - startY, endX - startX);
    const head = 14;
    const a1 = angle + Math.PI - 0.45;
    const a2 = angle + Math.PI + 0.45;
    content = (
      <svg width={bw * cw} height={bh * ch} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={annotation.color} strokeWidth={annotation.strokeWidth} strokeLinecap="round" />
        <polygon points={`${endX},${endY} ${endX + head * Math.cos(a1)},${endY + head * Math.sin(a1)} ${endX + head * Math.cos(a2)},${endY + head * Math.sin(a2)}`} fill={annotation.color} />
      </svg>
    );
  }

  return (
    <div style={boxStyle} onPointerDown={onBodyDown} onPointerMove={onBodyMove} onPointerUp={onBodyUp} onPointerCancel={onBodyUp}>
      {content}
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
