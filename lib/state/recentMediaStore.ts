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
        entries: state.entries.map((e) => ({
          ...e,
          // Keep thumbnails short in localStorage — truncate data URLs > 4 KB
          // to avoid blowing the 5 MB quota. Full URLs are still available in
          // memory for the current session.
          dataUrl: e.dataUrl.length > 4096 ? e.dataUrl.slice(0, 4096) : e.dataUrl
        }))
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
