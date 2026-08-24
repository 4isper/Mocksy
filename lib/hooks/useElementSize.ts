"use client";

import { useEffect, useState } from "react";

interface ElementSize {
  w: number;
  h: number;
}

/**
 * Tracks an element's rendered box via ResizeObserver so consumers can react
 * to layout changes (window resizes, panel drags, container queries). Falls
 * back to measuring on window resize where ResizeObserver is unavailable
 * (older jsdom/happy-dom test environments), and reports {0,0} before the
 * element mounts — callers must handle the zero case.
 */
export function useElementSize(ref: React.RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
