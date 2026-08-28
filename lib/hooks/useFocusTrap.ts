"use client";

import { useEffect, useRef } from "react";

// Lock background scroll while a trap is active so a modal actually behaves
// modally (the page behind it can't scroll). Multiple traps can be open at
// once (a confirm inherits a surrounding panel), so the lock is balanced with
// a module-level counter.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLockCount = 0;
let scrollLockBodyOverflow = "";

function lockScroll() {
  if (scrollLockCount === 0) {
    scrollLockBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLockCount += 1;
}

function unlockScroll() {
  scrollLockCount -= 1;
  if (scrollLockCount <= 0) {
    scrollLockCount = 0;
    document.body.style.overflow = scrollLockBodyOverflow;
  }
}

export function useFocusTrap(isActive: boolean, trapTab = true) {
  const ref = useRef<HTMLDivElement | null>(null);
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    previous.current = document.activeElement as HTMLElement;
    lockScroll();

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
      unlockScroll();
      previous.current?.focus();
    };
  }, [isActive, trapTab]);

  return ref;
}
