"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a separator line above this item. */
  separatorBefore?: boolean;
}

interface Positioned {
  x: number;
  y: number;
}

/**
 * Minimal right-click menu: fixed-position list of actions that closes on
 * item selection, outside pointer-down, Escape, scroll or resize. Position is
 * clamped to the viewport after the first paint so it never overflows.
 * Purely presentational — callers build the items for their context.
 */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: ContextMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Positioned>({ x, y });

  // Clamp into the viewport once the menu has been measured (flips up/left
  // when opened near the bottom/right edge).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8))
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Capture phase: any scroll (including inner panels) invalidates the anchor.
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const style: CSSProperties = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    zIndex: 1000,
    minWidth: 160,
    padding: 4,
    display: "grid",
    gap: 2
  };

  return (
    <div ref={ref} className="panel" role="menu" aria-orientation="vertical" style={style}>
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore ? <div role="separator" style={{ height: 1, margin: "3px -4px", background: "var(--panel-border)" }} /> : null}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "5px 10px",
              fontSize: 12,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: item.danger ? "var(--danger)" : "var(--text-primary)",
              cursor: item.disabled ? "default" : "pointer",
              opacity: item.disabled ? 0.45 : 1
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) e.currentTarget.style.background = "var(--hover, rgba(128,128,128,0.15))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
