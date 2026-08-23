"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";

const STORAGE_KEY = "mocksy.controlPanel.sections";

// Section open/closed prefs live in localStorage, which has no change events.
// A tiny module-level store (cached snapshot + listener set) lets every
// Section instance subscribe via useSyncExternalStore: the server render and
// the first client render both see the empty default (no hydration mismatch),
// the cached client snapshot flips in without a setState-in-effect cascade,
// and toggling one section keeps every mounted instance with the same id in
// sync instead of only updating after a reload.
const EMPTY_PREFS: Record<string, boolean> = {};
let cachedPrefs: Record<string, boolean> | null = null;
const listeners = new Set<() => void>();

function readPrefs(): Record<string, boolean> {
  if (cachedPrefs) return cachedPrefs;
  if (typeof window === "undefined") return EMPTY_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cachedPrefs = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    cachedPrefs = {};
  }
  return cachedPrefs;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

interface SectionProps {
  id: string;
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Section({ id, title, icon, defaultOpen = true, children }: SectionProps) {
  const prefs = useSyncExternalStore(subscribe, readPrefs, () => EMPTY_PREFS);
  const open = prefs[id] ?? defaultOpen;

  const toggle = useCallback(() => {
    const next = { ...readPrefs(), [id]: !(readPrefs()[id] ?? defaultOpen) };
    cachedPrefs = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
    listeners.forEach((l) => l());
  }, [id, defaultOpen]);

  return (
    <section className="section" aria-label={title}>
      <button
        type="button"
        className="section-header"
        aria-expanded={open}
        aria-controls={`section-${id}-body`}
        onClick={toggle}
      >
        {icon ? <span className="section-icon" aria-hidden="true">{icon}</span> : null}
        <span className="section-title">{title}</span>
        <svg
          className="section-chevron"
          aria-hidden="true"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={`section-${id}-body`} className="section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
