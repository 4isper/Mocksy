"use client";

import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

function subscribe(callback: () => void): () => void {
  const mql = getMediaQueryList();
  if (!mql) return () => {};
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Tracks whether the user prefers reduced motion. Reacts to live changes
 * (e.g. toggling the OS setting) and falls back to "no preference" during
 * SSR and in environments without matchMedia.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
