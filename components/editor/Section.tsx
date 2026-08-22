"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "mocksy.controlPanel.sections";

function readPrefs(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

interface SectionProps {
  id: string;
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Section({ id, title, icon, defaultOpen = true, children }: SectionProps) {
  // Persisted open/closed prefs load after mount: reading localStorage during
  // the first render makes the client tree disagree with the SSR HTML.
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setPrefs(readPrefs());
  }, []);
  const open = prefs[id] ?? defaultOpen;

  const toggle = useCallback(() => {
    setPrefs((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? defaultOpen) };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
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
