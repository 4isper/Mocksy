"use client";

import { useEffect, useRef } from "react";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";
import { resolveZoomScale } from "@/lib/render/previewViewport";

interface UseCanvasGestures {
  frameRef: React.RefObject<HTMLDivElement | null>;
  activeLayer: MediaLayer | undefined;
}

/**
 * Extracts the preview canvas' touch/mouse gesture logic (two-finger pinch-zoom
 * on the panel and drag-to-pan on the frame) out of PreviewCanvas so the
 * component focuses on layout. Both gestures write straight to the store.
 */
export function useCanvasGestures({ frameRef, activeLayer }: UseCanvasGestures) {
  // Pinch-to-zoom on touch devices: track the two-finger distance and map it
  // to the active layer zoom so mobile users can scale the mockup without a slider.
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const activeLayerRef = useRef(activeLayer);
  useEffect(() => {
    activeLayerRef.current = activeLayer;
  });
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && activeLayer) {
      // Only claim the pinch when it starts on the mockup frame itself —
      // gestures on the empty canvas belong to useCanvasViewport's view zoom.
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function" || !target.closest("[data-mockup-frame], [data-frame-instance-id]")) return;
      const a = e.touches[0];
      const b = e.touches[1];
      if (!a || !b) return;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      const dist = Math.hypot(dx, dy);
      // Fingers starting on the same point have no measurable baseline — a
      // move would divide by zero below.
      if (dist === 0) return;
      pinchStart.current = { dist, zoom: activeLayer.zoom };
    }
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) pinchStart.current = null;
  };
  // A cancelled touch sequence (incoming call, browser gesture takeover,
  // edge-swipe nav) fires touchcancel and never touchend. Without clearing
  // here the stale pinch baseline hijacks the next unrelated two-finger touch
  // anywhere on the page (the move listener is window-level) and preventDefaults
  // its scrolling. Mirrors useCanvasViewport's touchcancel handling.
  const onTouchCancel = () => {
    pinchStart.current = null;
  };

  // The move half of the pinch is a native non-passive listener: React
  // registers synthetic touchmove handlers as passive, so preventDefault()
  // inside them is a no-op and the page would scroll mid-pinch. Registered
  // once on the window and cheap to skip when no pinch is in progress.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onTouchMove = (e: TouchEvent) => {
      const start = pinchStart.current;
      if (!start || e.touches.length !== 2 || !activeLayerRef.current) return;
      const a = e.touches[0];
      const b = e.touches[1];
      if (!a || !b) return;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (dist === 0) return;
      e.preventDefault();
      const next = Math.min(1.5, Math.max(0.8, start.zoom * (dist / start.dist)));
      useEditorStore.getState().setZoom(next);
    };
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => window.removeEventListener("touchmove", onTouchMove);
  }, []);

  // Drag-to-pan the active media inside the frame, mirroring the Position
  // X/Y sliders. Pointer events cover mouse and single-finger touch; a
  // two-finger touch is claimed by the pinch-zoom handler instead. The
  // frame's offsetWidth is its untransformed layout size, so the delta
  // maps cleanly onto the CSS object-position basis the sliders drive.
  // The preview view zoom (if any) scales what the user sees, so it's
  // captured at gesture start and divided out to keep drag-under-cursor.
  const panState = useRef<{ x: number; y: number; offX: number; offY: number; viewScale: number } | null>(null);
  const canPan = !!activeLayer?.mediaUrl;
  const onPanDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Let the Clear button, watermark and native <video controls> keep their
    // own behavior: pointer events on video controls are retargeted to the
    // <video>, so `closest("button")` doesn't see them and the pan gesture
    // would otherwise capture the pointer away from play/seek UI (mirrors
    // FrameInstanceGrid's video guard).
    if (target.closest("button") || target.closest(".preview-watermark") || target.closest("video")) return;
    if (!activeLayer?.mediaUrl) return;
    panState.current = {
      x: e.clientX,
      y: e.clientY,
      offX: activeLayer.mediaOffsetX,
      offY: activeLayer.mediaOffsetY,
      viewScale: resolveZoomScale(useEditorStore.getState().previewZoom)
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPanMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = panState.current;
    const el = frameRef.current;
    if (!s || !el) return;
    const w = el.offsetWidth || 1;
    const h = el.offsetHeight || 1;
    const nx = Math.max(-1, Math.min(1, s.offX + ((e.clientX - s.x) / w / s.viewScale) * 2));
    const ny = Math.max(-1, Math.min(1, s.offY + ((e.clientY - s.y) / h / s.viewScale) * 2));
    const st = useEditorStore.getState();
    st.setMediaOffsetX(nx);
    st.setMediaOffsetY(ny);
  };
  const onPanUp = (e: React.PointerEvent<HTMLDivElement>) => {
    panState.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return {
    canPan,
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    onPanDown,
    onPanMove,
    onPanUp
  };
}
