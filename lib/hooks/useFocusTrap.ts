"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(isActive: boolean, trapTab = true) {
  const ref = useRef<HTMLDivElement | null>(null);
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    previous.current = document.activeElement as HTMLElement;

    const el = ref.current;
    if (el) {
      const first = el.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !trapTab) return;
      const container = ref.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous.current?.focus();
    };
  }, [isActive, trapTab]);

  return ref;
}
