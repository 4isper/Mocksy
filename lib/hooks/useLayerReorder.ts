"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";
import { spliceMove, useTouchReorder, type TouchReorderDropTarget } from "@/lib/hooks/useTouchReorder";

/**
 * Owns the layer-list drag-to-reorder state machine: which row is being
 * dragged, the live drop indicator, and the splice that produces the new order.
 * Reordering is coalesced so a continuous drag collapses into a single undo
 * step. The visible indicator is derived here so the row component stays
 * presentational. Two input paths share the state: HTML5 drag-and-drop for
 * mouse, and the grip-handle pointer path (useTouchReorder) for touch, where
 * dragstart never fires.
 */
export function useLayerReorder(scene: EditorScene) {
  const reorderLayers = useEditorStore((s) => s.reorderLayers);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TouchReorderDropTarget | null>(null);
  const lastReorderRef = useRef<string | null>(null);

  const touch = useTouchReorder({
    getIds: () => scene.layers.map((l) => l.id),
    commit: (ids) => reorderLayers(ids, true)
  });

  const reorderByDrag = (targetId: string, pos: "above" | "below") => {
    if (!dragId || dragId === targetId) return;
    const ids = scene.layers.map((l) => l.id);
    const next = spliceMove(ids, dragId, targetId, pos);
    if (next !== ids) reorderLayers(next, true);
  };

  const posFor = (e: DragEvent<HTMLLIElement>, id: string): "above" | "below" => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? "above" : "below";
  };

  const handleDragStart = (e: DragEvent<HTMLLIElement>, id: string) => {
    setDragId(id);
    lastReorderRef.current = null;
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>, id: string) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const pos = posFor(e, id);
    const key = `${id}:${pos}`;
    setDropTarget((cur) => (cur && cur.id === id && cur.pos === pos ? cur : { id, pos }));
    if (lastReorderRef.current !== key) {
      lastReorderRef.current = key;
      reorderByDrag(id, pos);
    }
  };

  const handleDrop = (e: DragEvent<HTMLLIElement>, id: string) => {
    e.preventDefault();
    if (!dragId) return;
    reorderByDrag(id, posFor(e, id));
    setDragId(null);
    setDropTarget(null);
    lastReorderRef.current = null;
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDropTarget(null);
    lastReorderRef.current = null;
  };

  return {
    dragId: dragId ?? touch.dragId,
    dropTarget: dropTarget ?? touch.dropTarget,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleGripPointerDown: touch.handleGripPointerDown,
    handleGripPointerMove: touch.handleGripPointerMove,
    handleGripPointerUp: touch.handleGripPointerUp
  };
}
