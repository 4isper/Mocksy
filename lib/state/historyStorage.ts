"use client";

import { useEditorStore } from "@/lib/state/editorStore";
import { normalizeScene } from "@/lib/state/normalizeScene";
import type { EditorScene } from "@/lib/types/editor";

const STORAGE_KEY = "mocksy-history";
/** Debounce before writing the undo stack to localStorage, matching the scene
 *  autosave so slider drags don't hit storage on every pixel. */
const PERSIST_DELAY = 500;
/** Serialized size cap for the persisted undo stack. Scenes carry data: URLs
 *  (media), so the full 100-entry in-memory history would blow the localStorage
 *  quota on most uploads. Instead we persist the most recent snapshots that fit
 *  and degrade gracefully when media is too large. */
const SIZE_BUDGET = 1_500_000;

export type PersistedHistory = {
  past: EditorScene[];
  future: EditorScene[];
};

function payloadSize(past: EditorScene[], future: EditorScene[]): number {
  return JSON.stringify({ past, future }).length;
}

/** Trims the undo/redo stacks to fit `budget` serialized bytes. The redo stack
 *  is dropped before any undo entries (it's cheap to rebuild and after a reload
 *  the user most often wants to walk backwards); then the oldest undo entries
 *  are dropped in halving passes so the trim stays cheap even for large media.
 *  Returns null when even a single snapshot cannot fit, in which case nothing
 *  is persisted and the in-memory history keeps working for the session. */
export function trimHistoryForStorage(
  past: EditorScene[],
  future: EditorScene[],
  budget = SIZE_BUDGET
): PersistedHistory | null {
  if (payloadSize(past, future) <= budget) return { past, future };
  let p = past;
  let f = future;
  // Redo is dropped before any undo entries: after a reload the user most often
  // wants to walk backwards, and the redo stack is cheap to rebuild.
  while (f.length > 0 && payloadSize(p, f) > budget) f = f.slice(0, -1);
  // Drop the oldest half of undo entries each pass so the trim stays O(log n)
  // even for very large payloads. Stop at a single snapshot — dropping it too
  // would lose the undo stack entirely.
  while (p.length > 1 && payloadSize(p, f) > budget) p = p.slice(Math.floor(p.length / 2));
  if (payloadSize(p, f) > budget) return null;
  return { past: p, future: f };
}

/** Reads and validates the persisted undo stack. Every snapshot goes through
 *  normalizeScene so a corrupted or tampered payload can never crash the
 *  editor, mirroring how projects/share URLs are treated. */
export function readHistory(): PersistedHistory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { past?: unknown; future?: unknown };
    if (!Array.isArray(parsed.past) || !Array.isArray(parsed.future)) return null;
    return {
      past: parsed.past.map((scene) => normalizeScene(scene)),
      future: parsed.future.map((scene) => normalizeScene(scene))
    };
  } catch {
    return null;
  }
}

/** Writes a size-trimmed copy of the undo stack to localStorage. Best-effort:
 *  a full quota silently skips the write — unlike the project autosave there is
 *  no "Saved" indicator to warn about, and editing must never break over it. */
export function persistHistory(past: EditorScene[], future: EditorScene[]): void {
  if (typeof window === "undefined") return;
  const trimmed = trimHistoryForStorage(past, future);
  if (!trimmed) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Best-effort persistence: quota errors are non-actionable here.
  }
}

/** Restores the persisted undo stack into the store. Called once during
 *  bootstrap, right after the scene itself is hydrated, so Ctrl+Z works again
 *  immediately after a reload. */
export function restoreHistory(): void {
  const stored = readHistory();
  if (!stored) return;
  useEditorStore.setState({
    past: stored.past,
    future: stored.future,
    lastHistoryKey: null,
    lastHistoryAt: 0
  });
}

/** Watches the editor store for undo/redo-stack changes and writes a trimmed,
 *  debounced copy to localStorage. Flushes synchronously on pagehide so a quick
 *  tab close doesn't lose the most recent undo steps. Returns an unsubscribe. */
export function initHistoryPersistence(): () => void {
  if (typeof window === "undefined") return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const { past, future } = useEditorStore.getState();
    persistHistory(past, future);
  };

  const unsubscribe = useEditorStore.subscribe((state, prev) => {
    if (state.past === prev.past && state.future === prev.future) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, PERSIST_DELAY);
  });

  window.addEventListener("pagehide", flush);

  return () => {
    unsubscribe();
    window.removeEventListener("pagehide", flush);
    if (timer) clearTimeout(timer);
  };
}
