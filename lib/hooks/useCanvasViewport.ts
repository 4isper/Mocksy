"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import {
  clampPan,
  nextZoom,
  panForZoom,
  resolveZoomScale,
  zoomFactorFromDelta,
  type Point
} from "@/lib/render/previewViewport";

/** Selectors that must never claim a view gesture: interactive controls keep
 *  their native behavior, and content targets own their own drag/pinch. */
const INTERACTIVE_SELECTOR = "button, input, select, textarea, label, a";
/** Content that handles its own gestures: the single-frame mockup, multi-frame
 *  instances and annotations. Pinching there scales media, not the view. */
const CONTENT_SELECTOR = "[data-mockup-frame], [data-frame-instance-id], [data-annotation]";

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable === true
  );
}

interface UseCanvasViewportOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * View-navigation interactions for the preview canvas, kept out of the
 * component so it stays focused on layout:
 *
 * - wheel / trackpad scroll → smooth zoom anchored at the cursor
 * - space + drag or middle-button drag → viewport pan
 * - two-finger pinch starting on empty canvas → zoom at the pinch midpoint
 *   (pinches starting on a frame stay owned by `useCanvasGestures`, which
 *   scales the layer media instead)
 * - double-click on empty canvas → reset view to fit
 *
 * All listeners read state imperatively via `useEditorStore.getState()`, so
 * they are bound once and never go stale. Pan/zoom writes are plain store sets
 * — pure view state, no undo entries.
 */
export function useCanvasViewport({ canvasRef }: UseCanvasViewportOptions) {
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const spaceHeldRef = useRef(false);
  const panDrag = useRef<{ startX: number; startY: number; base: Point } | null>(null);
  const viewPinch = useRef<{ startDist: number; baseScale: number; basePan: Point; anchor: Point } | null>(null);

  // Space is the pan modifier (like Figma/tldraw). Tracked globally so the
  // user can press it before the pointer goes down anywhere on the canvas.
  // Interactive elements keep their native Space behavior (activation).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const release = () => {
      if (!spaceHeldRef.current) return;
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (isEditableTarget(el) || (el && typeof el.closest === "function" && el.closest(INTERACTIVE_SELECTOR))) return;
      e.preventDefault();
      if (spaceHeldRef.current) return;
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") release();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // A keyup that happens outside the window would leave the flag stuck.
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, []);

  // Wheel → zoom-to-cursor. Registered natively with passive:false because
  // React's synthetic wheel handler can't preventDefault reliably.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof window === "undefined") return;
    const onWheel = (e: WheelEvent) => {
      const st = useEditorStore.getState();
      const prev = resolveZoomScale(st.previewZoom);
      const factor = zoomFactorFromDelta(e.deltaY, e.deltaMode);
      const next = nextZoom(prev, factor);
      if (next === prev) return;
      const rect = el.getBoundingClientRect();
      const anchor: Point = {
        x: e.clientX - rect.left - rect.width / 2,
        y: e.clientY - rect.top - rect.height / 2
      };
      const basePan = st.previewZoom === "fit" ? { x: 0, y: 0 } : st.previewPan;
      const pan = clampPan(panForZoom(basePan, anchor, prev, next), next, rect.width, rect.height);
      e.preventDefault();
      st.setPreviewPan(pan);
      st.setPreviewZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [canvasRef]);

  // Two-finger pinch on empty canvas → view zoom at the pinch midpoint.
  // Started via touchstart (target tells us whether the gesture began on
  // content); driven by a non-passive touchmove so the page never scrolls
  // mid-pinch. Gestures that start on frames/annotations are ignored here —
  // useCanvasGestures owns those and scales the layer media instead.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof window === "undefined") return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        viewPinch.current = null;
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && typeof target.closest === "function" && target.closest(`${INTERACTIVE_SELECTOR}, ${CONTENT_SELECTOR}`)) return;
      const a = e.touches[0];
      const b = e.touches[1];
      if (!a || !b) return;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (dist === 0) return;
      const rect = el.getBoundingClientRect();
      const anchor: Point = {
        x: (a.clientX + b.clientX) / 2 - rect.left - rect.width / 2,
        y: (a.clientY + b.clientY) / 2 - rect.top - rect.height / 2
      };
      const st = useEditorStore.getState();
      viewPinch.current = {
        startDist: dist,
        baseScale: resolveZoomScale(st.previewZoom),
        basePan: st.previewZoom === "fit" ? { x: 0, y: 0 } : st.previewPan,
        anchor
      };
    };
    const onTouchMove = (e: TouchEvent) => {
      const start = viewPinch.current;
      if (!start || e.touches.length !== 2) return;
      const a = e.touches[0];
      const b = e.touches[1];
      if (!a || !b) return;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (dist === 0) return;
      e.preventDefault();
      const st = useEditorStore.getState();
      const next = nextZoom(start.baseScale, dist / start.startDist, false);
      const pan = clampPan(panForZoom(start.basePan, start.anchor, start.baseScale, next), next, el.offsetWidth, el.offsetHeight);
      st.setPreviewPan(pan);
      st.setPreviewZoom(next);
    };
    const onTouchEnd = () => {
      viewPinch.current = null;
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [canvasRef]);

  // Middle-button side effects: browsers start autoscroll (Chrome/Windows) or
  // clipboard-paste on release (Linux) — both would fight the view drag.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof window === "undefined") return;
    const swallow = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    el.addEventListener("mousedown", swallow);
    el.addEventListener("auxclick", swallow);
    return () => {
      el.removeEventListener("mousedown", swallow);
      el.removeEventListener("auxclick", swallow);
    };
  }, [canvasRef]);

  /** Capture-phase pointerdown on the canvas: when panning is requested
   *  (space held or middle button) it claims the gesture before frame /
   *  annotation drags can start. */
  const onPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!(spaceHeldRef.current || e.button === 1)) return;
    const target = e.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    const st = useEditorStore.getState();
    e.preventDefault();
    // Stop the event from reaching frame/annotation drag handlers underneath.
    e.stopPropagation();
    panDrag.current = {
      startX: e.clientX,
      startY: e.clientY,
      base: st.previewZoom === "fit" ? { x: 0, y: 0 } : st.previewPan
    };
    setIsPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDrag.current;
    const el = canvasRef.current;
    if (!drag || !el) return;
    const st = useEditorStore.getState();
    const scale = resolveZoomScale(st.previewZoom);
    const pan = clampPan(
      { x: drag.base.x + (e.clientX - drag.startX), y: drag.base.y + (e.clientY - drag.startY) },
      scale,
      el.offsetWidth || 1,
      el.offsetHeight || 1
    );
    st.setPreviewPan(pan);
  };

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panDrag.current) return;
    panDrag.current = null;
    setIsPanning(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  /** Double-click on empty canvas resets the view; clicks landing on controls,
   *  frames or annotations keep their own behavior. */
  const onDoubleClickReset = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(`${INTERACTIVE_SELECTOR}, ${CONTENT_SELECTOR}`)) return;
    const st = useEditorStore.getState();
    if (st.previewZoom === "fit" && st.previewPan.x === 0 && st.previewPan.y === 0) return;
    st.resetPreviewView();
  };

  return {
    spaceHeld,
    isPanning,
    /** Cursor for the canvas surface while view navigation is armed/active. */
    viewCursor: isPanning ? "grabbing" : spaceHeld ? "grab" : undefined,
    onPointerDownCapture,
    onPointerMove,
    onPointerUp: endPan,
    onPointerCancel: endPan,
    onDoubleClickReset
  };
}
