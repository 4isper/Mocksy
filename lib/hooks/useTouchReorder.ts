"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TouchReorderDropTarget {
  id: string;
  pos: "above" | "below";
}

/** Moves `fromId` to the slot above/below `toId`, returning a new array (or
 *  the input unchanged when either id is missing or the order wouldn't move). */
export function spliceMove(ids: string[], fromId: string, toId: string, pos: "above" | "below"): string[] {
  const from = ids.indexOf(fromId);
  let to = ids.indexOf(toId);
  if (from < 0 || to < 0 || fromId === toId) return ids;
  if (pos === "below") to += 1;
  const next = [...ids];
  next.splice(from, 1);
  if (to > from) to -= 1;
  next.splice(to, 0, fromId);
  return next;
}

/**
 * Pointer-based list reordering for touch devices. HTML5 drag-and-drop never
 * fires on touch, so lists that rely on it (layers, frame instances) are
 * mouse-only. This hook adds a grip-handle path: press the grip, drag over a
 * row marked with `data-reorder-id`, release to commit. Rows reorder live
 * (mirroring the HTML5 dragover behavior), so callers should coalesce the
 * commits into a single undo step. Mouse/pen pointers are ignored — they keep
 * the native DnD path.
 */
export function useTouchReorder({
  getIds,
  commit
}: {
  getIds: () => string[];
  commit: (orderedIds: string[]) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TouchReorderDropTarget | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  // Latest-callback refs so the memoized handlers never read a stale scene.
  const getIdsRef = useRef(getIds);
  const commitRef = useRef(commit);
  useEffect(() => {
    getIdsRef.current = getIds;
    commitRef.current = commit;
  });

  const endDrag = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
    lastKeyRef.current = null;
  }, []);

  const handleGripPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (e.pointerType !== "touch") return;
    e.preventDefault();
    setDragId(id);
    lastKeyRef.current = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleGripPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragId || e.pointerType !== "touch") return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-reorder-id]");
      const targetId = el?.dataset.reorderId;
      if (!el || !targetId || targetId === dragId) {
        setDropTarget((cur) => (cur ? null : cur));
        return;
      }
      const rect = el.getBoundingClientRect();
      const pos: "above" | "below" = e.clientY < rect.top + rect.height / 2 ? "above" : "below";
      const key = `${targetId}:${pos}`;
      setDropTarget((cur) => (cur && cur.id === targetId && cur.pos === pos ? cur : { id: targetId, pos }));
      if (lastKeyRef.current !== key) {
        lastKeyRef.current = key;
        const ids = getIdsRef.current();
        const next = spliceMove(ids, dragId, targetId, pos);
        if (next !== ids) commitRef.current(next);
      }
    },
    [dragId]
  );

  const handleGripPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const el = e.currentTarget as HTMLElement;
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      endDrag();
    },
    [endDrag]
  );

  return { dragId, dropTarget, handleGripPointerDown, handleGripPointerMove, handleGripPointerUp };
}
