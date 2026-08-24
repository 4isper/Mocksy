import type { EditorScene } from "@/lib/types/editor";

const HISTORY_LIMIT = 100;
/** Edits of the same field within this window collapse into one undo step,
 *  so dragging a slider doesn't flood history with a record per pixel. */
const COALESCE_MS = 400;

export type HistoryMutator = {
  past: EditorScene[];
  future: EditorScene[];
  scene: EditorScene;
  lastHistoryKey: string | null;
  lastHistoryAt: number;
};

/** Returns an object suitable for passing to Zustand's set(state => ...).
 *  Coalesces rapid repeats of the same field (e.g. slider drags) so undo
 *  returns to the pre-drag value rather than one pixel at a time. */
export function pushHistory(
  s: HistoryMutator,
  scene: EditorScene,
  coalesceKey?: string
): HistoryMutator {
  const now = Date.now();
  if (coalesceKey && coalesceKey === s.lastHistoryKey && now - s.lastHistoryAt < COALESCE_MS) {
    // The scene changed, so any redo entries (left by an undo immediately
    // before this edit) are stale and must go — even though no new past
    // entry is pushed.
    return { ...s, scene, lastHistoryAt: now, future: [] };
  }
  const past = [...s.past, s.scene].slice(-HISTORY_LIMIT);
  return { past, future: [], scene, lastHistoryKey: coalesceKey ?? null, lastHistoryAt: now };
}
