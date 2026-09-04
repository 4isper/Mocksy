"use client";

import { useCallback, useEffect, useRef } from "react";

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;
// Controls that own their pointer gestures or need the native long-press
// (text selection/callout): the gesture must not start on them.
const INTERACTIVE_SELECTOR = "button, input, select, textarea, [contenteditable='true']";

/**
 * Long-press-to-open-context-menu for touch devices. iOS Safari never fires
 * `contextmenu` from a long-press (unlike Android Chrome), so the canvas
 * right-click menu is unreachable on iPhone/iPad. This hook synthesizes the
 * same open call from a still single-finger press: it fires after
 * LONG_PRESS_MS and cancels when the finger moves beyond MOVE_TOLERANCE_PX
 * (pan/scroll gestures win), lifts early, or when a second finger lands
 * (pinch-zoom wins). A pointercancel (browser gesture takeover, edge swipe)
 * also aborts the pending timer.
 */
export function useLongPress(onLongPress: (x: number, y: number, target: HTMLElement) => void) {
  // Keep the latest callback without re-creating handlers (they're wired to
  // DOM props on every render anyway, but refs keep the timer closure honest).
  const cbRef = useRef(onLongPress);
  useEffect(() => {
    cbRef.current = onLongPress;
  });
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pointersRef = useRef<Set<number>>(new Set());

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  // Unmount mid-press must not fire the callback or leak the timer.
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const target = e.target as HTMLElement;
      if (target.closest?.(INTERACTIVE_SELECTOR)) return;
      pointersRef.current.add(e.pointerId);
      // Second finger: this is a pinch/pan, not a long-press.
      if (pointersRef.current.size > 1) {
        cancel();
        return;
      }
      cancel();
      const x = e.clientX;
      const y = e.clientY;
      startRef.current = { x, y };
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        startRef.current = null;
        cbRef.current(x, y, target);
        // Haptic confirmation (Android; a no-op where unsupported).
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
    },
    [cancel]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = startRef.current;
      if (!start || e.pointerType !== "touch") return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) cancel();
    },
    [cancel]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      cancel();
    },
    [cancel]
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}
