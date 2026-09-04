"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SHORTCUT_DEFS, parseCombo } from "@/lib/shortcuts/shortcutConfig";

/**
 * User-rebound editor shortcuts: maps a shortcut def id to an overriding
 * combo string. Lives in localStorage outside the scene — key bindings are a
 * device-level preference, not part of the mockup.
 */

export const MAX_SHORTCUT_OVERRIDES = 64;

export interface ConflictInfo {
  /** The id whose default/effective combo collides. */
  otherId: string;
}

interface ShortcutsState {
  overrides: Record<string, string>;
  setOverride: (id: string, combo: string) => void;
  clearOverride: (id: string) => void;
  resetAll: () => void;
}

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (id, combo) =>
        set((s) => ({ overrides: { ...s.overrides, [id]: combo } })),
      clearOverride: (id) =>
        set((s) => {
          if (!(id in s.overrides)) return {};
          const next = { ...s.overrides };
          delete next[id];
          return { overrides: next };
        }),
      resetAll: () => set({ overrides: {} })
    }),
    {
      name: "mocksy-shortcuts",
      partialize: (state) => ({ overrides: state.overrides })
    }
  )
);

/** Effective combo for a def id: the override when valid, else the default. */
export function effectiveCombo(def: { id: string; combo: string }, overrides: Record<string, string>): string {
  const override = overrides[def.id];
  return override && parseCombo(override) ? override : def.combo;
}

/** Finds another shortcut already bound to `combo`, comparing effective
 *  bindings (defaults + current overrides). Self never conflicts.
 *  Fixed (non-remappable) defs DO conflict: their combos own fixed behaviors
 *  (paste, command palette, R/F…), so letting a rebind silently take
 *  `mod+v` would suppress native paste with no way to see the collision. */
export function findConflict(combo: string, excludeId: string, overrides: Record<string, string>): ConflictInfo | null {
  for (const def of SHORTCUT_DEFS) {
    if (def.id === excludeId) continue;
    if (effectiveCombo(def, overrides) === combo) return { otherId: def.id };
  }
  return null;
}
