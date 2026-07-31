// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AnnotationItem } from "@/components/editor/AnnotationItem";
import type { Annotation } from "@/lib/types/editor";

// happy-dom lacks pointer capture plumbing; stub it so the drag handlers run.
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "a1",
    type: "rect",
    x: 0.2,
    y: 0.4,
    w: 0.3,
    h: 0.2,
    text: "",
    color: "#fff",
    strokeWidth: 2,
    fontSize: 24,
    ...overrides
  };
}

afterEach(cleanup);

describe("AnnotationItem", () => {
  it("snaps the position to the grid while dragging when snap is enabled", () => {
    const canvas = document.createElement("div");
    Object.defineProperty(canvas, "clientWidth", { value: 1000, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 1000, configurable: true });
    const canvasRef = { current: canvas } as React.RefObject<HTMLDivElement | null>;
    const onUpdate = vi.fn();
    render(
      <AnnotationItem
        annotation={makeAnnotation()}
        selected
        canvasRef={canvasRef}
        snapDivisions={10}
        onSelect={() => {}}
        onUpdate={onUpdate}
      />
    );
    const body = document.body;
    const box = document.querySelector("div[style*='cursor: move']") as HTMLDivElement;

    fireEvent.pointerDown(box, { clientX: 100, clientY: 100, pointerId: 1 });
    // 30px right / 20px down -> raw (0.23, 0.42); grid snaps to (0.2, 0.4).
    fireEvent.pointerMove(box, { clientX: 130, clientY: 120, pointerId: 1 });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const call = onUpdate.mock.calls[0] as [string, { x: number; y: number }];
    expect(call[0]).toBe("a1");
    expect(call[1].x).toBeCloseTo(0.2, 6);
    expect(call[1].y).toBeCloseTo(0.4, 6);
  });

  it("keeps raw (un-snapped) positions when snapping is disabled", () => {
    const canvas = document.createElement("div");
    Object.defineProperty(canvas, "clientWidth", { value: 1000, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 1000, configurable: true });
    const canvasRef = { current: canvas } as React.RefObject<HTMLDivElement | null>;
    const onUpdate = vi.fn();
    render(
      <AnnotationItem
        annotation={makeAnnotation()}
        selected
        canvasRef={canvasRef}
        snapDivisions={null}
        onSelect={() => {}}
        onUpdate={onUpdate}
      />
    );
    const box = document.querySelector("div[style*='cursor: move']") as HTMLDivElement;

    fireEvent.pointerDown(box, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 130, clientY: 120, pointerId: 1 });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const call = onUpdate.mock.calls[0] as [string, { x: number; y: number }];
    expect(call[0]).toBe("a1");
    expect(call[1].x).toBeCloseTo(0.23, 6);
    expect(call[1].y).toBeCloseTo(0.42, 6);
  });
});