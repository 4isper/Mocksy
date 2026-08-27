"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
 * item selection, outside pointer-down, Escape or resize. Arrow keys navigate
 * between items, Enter selects. Position is clamped to the viewport after the
 * first paint so it never overflows.
 * Purely presentational — callers build the items for their context.
 */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: ContextMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Positioned>({ x, y });

  const enabledIndices = useMemo(() => items.reduce<number[]>((acc, item, i) => {
    if (!item.disabled) acc.push(i);
    return acc;
  }, []), [items]);

  const firstEnabled = enabledIndices[0];
  const [focusIndex, setFocusIndex] = useState(firstEnabled ?? 0);

  // Clamp into the viewport once the menu has been measured (flips up/left
  // when opened near the bottom/right edge). Also reset focus to the first
  // enabled item each time the menu opens (x/y change = new open).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8))
    });
    if (firstEnabled !== undefined) setFocusIndex(firstEnabled);
  }, [x, y, firstEnabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (enabledIndices.length === 0) return;
        const currentPos = enabledIndices.indexOf(focusIndex);
        const nextPos = (currentPos + 1) % enabledIndices.length;
        setFocusIndex(enabledIndices[nextPos]!);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (enabledIndices.length === 0) return;
        const currentPos = enabledIndices.indexOf(focusIndex);
        const nextPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
        setFocusIndex(enabledIndices[nextPos]!);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const item = items[focusIndex];
        if (item && !item.disabled) {
          onClose();
          item.onSelect();
        }
        return;
      }
    },
    [enabledIndices, focusIndex, items, onClose]
  );

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Close on outside pointer-down and resize only — scroll is intentionally
    // excluded so touch-initiated scrolls (momentum, virtual keyboard) do not
    // dismiss the menu mid-interaction.
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
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
    <div ref={ref} className="panel" role="menu" aria-orientation="vertical" onKeyDown={handleKeyDown} style={style}>
      {items.map((item, i) => (
        <div key={item.id}>
          {item.separatorBefore ? <div role="separator" style={{ height: 1, margin: "3px -4px", background: "var(--panel-border)" }} /> : null}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => {
              if (!item.disabled) {
                onClose();
                item.onSelect();
              }
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
              cursor: item.disabled ? "not-allowed" : "pointer",
              opacity: item.disabled ? 0.45 : 1
            }}
            onMouseEnter={() => {
              if (!item.disabled) setFocusIndex(i);
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
