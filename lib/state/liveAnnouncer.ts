"use client";

import { create } from "zustand";

interface LiveAnnouncerState {
  message: string;
  announce: (msg: string) => void;
}

/**
 * Global live announcer for screen-reader-friendly status updates. Components
 * call `announce(text)` to push a message into an `aria-live="polite"` region
 * that assistive technology picks up. The message is cleared after a short
 * delay so repeated identical announcements still fire.
 */
export const useLiveAnnouncer = create<LiveAnnouncerState>((set) => ({
  message: "",
  announce: (msg: string) => {
    set({ message: "" });
    // Small delay so the DOM update triggers a new announcement even when the
    // same text is published twice in a row.
    requestAnimationFrame(() => set({ message: msg }));
  }
}));
