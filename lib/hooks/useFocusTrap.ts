"use client";

import { useEffect, useId, useRef } from "react";
import { openModalSurface } from "@/lib/state/modalRegistry";

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
  // Register the open trap in the modal registry while active: the global
  // keyboard-shortcut gate parks shortcuts whenever ANY focus-trapped dialog
  // is open, including the inline confirmations that live inside panels and
  // whose open state never reaches EditorShell props.
  const surfaceId = useId();

  useEffect(() => {
    if (!isActive) return;

    previous.current = document.activeElement as HTMLElement;
    lockScroll();
    const unregister = openModalSurface(surfaceId);

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
      unregister();
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();
      previous.current?.focus();
    };
  }, [isActive, trapTab, surfaceId]);

  return ref;
}
