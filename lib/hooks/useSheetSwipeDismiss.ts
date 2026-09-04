"use client";

import { useCallback, useRef } from "react";

const DISMISS_DISTANCE_PX = 80;
const DISMISS_VELOCITY_PX_MS = 0.6;

/**
 * Swipe-down-to-dismiss for a bottom sheet. The returned handlers go on a
 * small grabber element at the sheet's top edge; the sheet itself is the
 * grabber's parent (`.sheet-host`). Dragging follows the finger 1:1 (the
 * `.is-dragging` class suppresses the slide transition), and releasing past
 * a distance or velocity threshold calls `onDismiss` — otherwise the sheet
 * snaps back. Upward drags are clamped to zero so the sheet never detaches
 * from its open position.
 */
export function useSheetSwipeDismiss({ onDismiss }: { onDismiss: () => void }) {
  const dragRef = useRef<{ startY: number; startTime: number; dy: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const host = e.currentTarget.parentElement;
    if (!host) return;
    dragRef.current = { startY: e.clientY, startTime: performance.now(), dy: 0 };
    host.classList.add("is-dragging");
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const host = e.currentTarget.parentElement;
    if (!drag || !host) return;
    drag.dy = Math.max(0, e.clientY - drag.startY);
    host.style.transform = drag.dy > 0 ? `translateY(${drag.dy}px)` : "";
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const host = e.currentTarget.parentElement;
      dragRef.current = null;
      if (!drag || !host) return;
      host.classList.remove("is-dragging");
      host.style.transform = "";
      const dt = Math.max(1, performance.now() - drag.startTime);
      if (drag.dy > DISMISS_DISTANCE_PX || drag.dy / dt > DISMISS_VELOCITY_PX_MS) {
        onDismiss();
      }
    },
    [onDismiss]
  );

  // A cancelled sequence (browser gesture takeover) snaps back — the user
  // never completed the swipe, so it must not dismiss.
  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLElement>) => {
    dragRef.current = null;
    const host = e.currentTarget.parentElement;
    if (!host) return;
    host.classList.remove("is-dragging");
    host.style.transform = "";
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
