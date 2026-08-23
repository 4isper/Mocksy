"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  PANEL_WIDTH_DEFAULTS,
  PANEL_WIDTH_LIMITS,
  clampPanelWidth,
  loadPanelWidths,
  savePanelWidths,
  type PanelSide
} from "@/lib/state/panelWidths";

/** Inline widths would beat the slim-panel media query at 981–1180px, so
 *  custom widths are only applied above it and cleared when it stops matching
 *  (window resized / window dragged between monitors). */
const DESKTOP_MQ = "(min-width: 1181px)";
const KEYBOARD_STEP = 16;

function readPanelWidth(grid: HTMLElement, side: PanelSide): number {
  const raw = getComputedStyle(grid).getPropertyValue(`--panel-${side}-w`);
  return Number.parseFloat(raw) || PANEL_WIDTH_DEFAULTS[side];
}

function writePanelWidth(grid: HTMLElement, side: PanelSide, width: number | null): void {
  if (width === null) {
    grid.style.removeProperty(`--panel-${side}-w`);
  } else {
    grid.style.setProperty(`--panel-${side}-w`, `${Math.round(width)}px`);
  }
}

function gridGap(grid: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(grid).columnGap) || 14;
}

function persist(grid: HTMLElement): void {
  savePanelWidths(window.localStorage, {
    left: readPanelWidth(grid, "left"),
    right: readPanelWidth(grid, "right")
  });
}

interface DragState {
  side: PanelSide;
  startX: number;
  startWidth: number;
  otherWidth: number;
}

/**
 * Vertical drag handles flanking the preview column for mouse-resizable side
 * panels. Widths live as CSS custom properties on `.editor-grid` (updated
 * imperatively during the drag — no re-renders), persist to localStorage,
 * and reset to the layout defaults on double-click. Keyboard: arrow keys
 * resize, Shift multiplies the step.
 */
export function PanelResizeHandles() {
  const t = useTranslations();
  const [leftWidth, setLeftWidth] = useState(PANEL_WIDTH_DEFAULTS.left);
  const [rightWidth, setRightWidth] = useState(PANEL_WIDTH_DEFAULTS.right);
  const [draggingSide, setDraggingSide] = useState<PanelSide | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // Hydrate persisted widths once the editor is desktop-sized, and re-gate
  // whenever the viewport crosses the breakpoint.
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MQ);
    const apply = () => {
      const grid = document.querySelector(".editor-grid");
      if (!(grid instanceof HTMLElement)) return;
      const saved = loadPanelWidths(window.localStorage);
      for (const side of ["left", "right"] as const) {
        const value = mql.matches ? saved[side] ?? null : null;
        writePanelWidth(grid, side, value);
        const effective = value ?? PANEL_WIDTH_DEFAULTS[side];
        if (side === "left") setLeftWidth(effective);
        else setRightWidth(effective);
      }
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const commitWidth = useCallback((grid: HTMLElement, side: PanelSide, width: number) => {
    writePanelWidth(grid, side, width);
    if (side === "left") setLeftWidth(width);
    else setRightWidth(width);
    persist(grid);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, side: PanelSide) => {
      if (e.button !== 0 || !window.matchMedia(DESKTOP_MQ).matches) return;
      const grid = e.currentTarget.closest(".editor-grid");
      if (!(grid instanceof HTMLElement)) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const otherSide: PanelSide = side === "left" ? "right" : "left";
      dragRef.current = {
        side,
        startX: e.clientX,
        startWidth: readPanelWidth(grid, side),
        otherWidth: readPanelWidth(grid, otherSide)
      };
      setDraggingSide(side);
      document.body.classList.add("panel-resizing");

      const endDrag = () => {
        window.removeEventListener("keydown", onKeyDown);
        document.body.classList.remove("panel-resizing");
        setDraggingSide(null);
        dragRef.current = null;
      };
      const onKeyDown = (ke: KeyboardEvent) => {
        // Escape cancels the whole gesture and snaps back to where it started.
        if (ke.key === "Escape" && dragRef.current) {
          commitWidth(grid, side, dragRef.current.startWidth);
          endDrag();
        }
      };

      const onPointerMove = (me: PointerEvent) => {
        const state = dragRef.current;
        if (!state) return;
        const delta = me.clientX - state.startX;
        const directed = side === "left" ? delta : -delta;
        const next = clampPanelWidth(
          side,
          state.startWidth + directed,
          grid.clientWidth,
          state.otherWidth,
          gridGap(grid)
        );
        writePanelWidth(grid, side, next);
      };
      const onPointerUp = () => {
        const state = dragRef.current;
        if (state) {
          const finalWidth = clampPanelWidth(
            side,
            readPanelWidth(grid, side),
            grid.clientWidth,
            state.otherWidth,
            gridGap(grid)
          );
          commitWidth(grid, side, finalWidth);
        }
        endDrag();
      };

      window.addEventListener("keydown", onKeyDown);
      e.currentTarget.addEventListener("pointermove", onPointerMove);
      e.currentTarget.addEventListener("pointerup", onPointerUp, { once: true });
      e.currentTarget.addEventListener("pointercancel", onPointerUp, { once: true });
    },
    [commitWidth]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, side: PanelSide) => {
      const widenKey = side === "left" ? "ArrowLeft" : "ArrowRight";
      const narrowKey = side === "left" ? "ArrowRight" : "ArrowLeft";
      if (e.key !== widenKey && e.key !== narrowKey) return;
      const grid = e.currentTarget.closest(".editor-grid");
      if (!(grid instanceof HTMLElement)) return;
      e.preventDefault();
      const step = KEYBOARD_STEP * (e.shiftKey ? 3 : 1);
      const direction = e.key === widenKey ? 1 : -1;
      const next = clampPanelWidth(
        side,
        readPanelWidth(grid, side) + direction * step,
        grid.clientWidth,
        readPanelWidth(grid, side === "left" ? "right" : "left"),
        gridGap(grid)
      );
      commitWidth(grid, side, next);
    },
    [commitWidth]
  );

  /** Double-click snaps the panel back to the layout default. */
  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, side: PanelSide) => {
      const grid = e.currentTarget.closest(".editor-grid");
      if (!(grid instanceof HTMLElement)) return;
      commitWidth(grid, side, PANEL_WIDTH_DEFAULTS[side]);
    },
    [commitWidth]
  );

  const renderHandle = (side: PanelSide) => {
    const width = side === "left" ? leftWidth : rightWidth;
    const { min, max } = PANEL_WIDTH_LIMITS[side];
    return (
      <button
        key={side}
        type="button"
        className={`panel-resize-handle${draggingSide === side ? " is-dragging" : ""}`}
        data-side={side}
        role="separator"
        aria-orientation="vertical"
        aria-label={t("editor.resizePanel")}
        aria-valuenow={Math.round(width)}
        aria-valuemin={min}
        aria-valuemax={max}
        onPointerDown={(e) => onPointerDown(e, side)}
        onKeyDown={(e) => onKeyDown(e, side)}
        onDoubleClick={(e) => onDoubleClick(e, side)}
      />
    );
  };

  return (
    <>
      {renderHandle("left")}
      {renderHandle("right")}
    </>
  );
}
