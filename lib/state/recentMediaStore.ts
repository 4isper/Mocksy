"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentMediaEntry {
  id: string;
  dataUrl: string;
  mediaName: string | null;
  mediaType: "image" | "video";
  usedAt: number;
}

const MAX_RECENT = 20;
const STORAGE_KEY = "mocksy-recent-media";

let nextId = Date.now();
function uid(): string {
  return `rm-${nextId++}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useRecentMediaStore = create<RecentMediaState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (dataUrl, mediaType, mediaName = null) => {
        if (!dataUrl) return;
        const entries = get().entries.filter((e) => e.dataUrl !== dataUrl);
        entries.unshift({
          id: uid(),
          dataUrl,
          mediaName,
          mediaType,
          usedAt: Date.now()
        });
        set({ entries: entries.slice(0, MAX_RECENT) });
      },

      removeEntry: (id) =>
        set({ entries: get().entries.filter((e) => e.id !== id) }),

      clearAll: () => set({ entries: [] })
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        entries: state.entries.filter(
          // Keep localStorage small — drop oversized data URLs instead of
          // truncating them (a truncated base64 URL is invalid and would be
          // rehydrated as corrupt state, then applied to layers). Full URLs
          // stay in memory for the current session.
          (e) => e.dataUrl.length <= 4096
        )
      })
    }
  )
);

interface RecentMediaState {
  entries: RecentMediaEntry[];
  addEntry: (dataUrl: string, mediaType: "image" | "video", mediaName?: string | null) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}
