"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";

interface DropTarget {
  id: string;
  pos: "above" | "below";
}

/**
 * Owns the layer-list drag-to-reorder state machine: which row is being
 * dragged, the live drop indicator, and the splice that produces the new order.
 * Reordering is coalesced so a continuous drag collapses into a single undo
 * step. The visible indicator is derived here so the row component stays
 * presentational.
 */
export function useLayerReorder(scene: EditorScene) {
  const reorderLayers = useEditorStore((s) => s.reorderLayers);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const reorderByDrag = (targetId: string, pos: "above" | "below") => {
    if (!dragId || dragId === targetId) return;
    const ids = scene.layers.map((l) => l.id);
    const from = ids.indexOf(dragId);
    let to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    if (pos === "below") to += 1;
    ids.splice(from, 1);
    if (to > from) to -= 1;
    ids.splice(to, 0, dragId);
    reorderLayers(ids, true);
  };

  const posFor = (e: DragEvent<HTMLLIElement>, id: string): "above" | "below" => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? "above" : "below";
  };

  const handleDragStart = (e: DragEvent<HTMLLIElement>, id: string) => {
    setDragId(id);
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLLIElement>, id: string) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const pos = posFor(e, id);
    setDropTarget((cur) => (cur && cur.id === id && cur.pos === pos ? cur : { id, pos }));
    reorderByDrag(id, pos);
  };

  const handleDrop = (e: DragEvent<HTMLLIElement>, id: string) => {
    e.preventDefault();
    if (!dragId) return;
    reorderByDrag(id, posFor(e, id));
    setDragId(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDropTarget(null);
  };

  return {
    dragId,
    dropTarget,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
  };
}
