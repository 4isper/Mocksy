// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

/** Props shared by every render so the multi-select/guide additions stay
 *  out of each individual test. */
function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    all: [],
    onSelect: () => {},
    onSelectMany: vi.fn(),
    onGuides: vi.fn(),
    onUpdate: vi.fn(),
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
        onRemove={vi.fn()}
        all={[]}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
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
        onRemove={vi.fn()}
        all={[]}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
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

  it("edits text in place on double click", () => {
    const canvas = document.createElement("div");
    Object.defineProperty(canvas, "clientWidth", { value: 1000, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 1000, configurable: true });
    const canvasRef = { current: canvas } as React.RefObject<HTMLDivElement | null>;
    const onUpdate = vi.fn();
    const annotation = makeAnnotation({ type: "text", text: "Hello" });
    render(
      <AnnotationItem
        annotation={annotation}
        selected
        canvasRef={canvasRef}
        onSelect={() => {}}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        all={[]}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
      />
    );

    const label = screen.getByText("Hello");
    fireEvent.doubleClick(label);

    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement;
    expect(editable).toBeTruthy();
    editable.textContent = "Edited";
    fireEvent.input(editable);

    expect(onUpdate).toHaveBeenCalledWith("a1", { text: "Edited" });
  });

  it("resizes the annotation via the resize handle", () => {
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
        onRemove={vi.fn()}
        all={[]}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
      />
    );
    const handle = screen.getByLabelText("editor.resizeAnnotation");
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 160, clientY: 140, pointerId: 1 });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const call = onUpdate.mock.calls[0] as [string, { w: number; h: number }];
    expect(call[0]).toBe("a1");
    expect(call[1].w).toBeCloseTo(0.36, 6);
    expect(call[1].h).toBeCloseTo(0.24, 6);
  });

  it("does not render a resize handle when not selected", () => {
    render(
      <AnnotationItem
        annotation={makeAnnotation()}
        selected={false}
        canvasRef={{ current: null }}
        onSelect={() => {}}
        onUpdate={() => {}}
        onRemove={vi.fn()}
        all={[]}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("editor.resizeAnnotation")).not.toBeInTheDocument();
  });

  it("renders an arrow as an SVG overlay", () => {
    const canvas = document.createElement("div");
    Object.defineProperty(canvas, "clientWidth", { value: 1000, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 1000, configurable: true });
    const canvasRef = { current: canvas } as React.RefObject<HTMLDivElement | null>;
    render(
      <AnnotationItem
        annotation={makeAnnotation({ type: "arrow", x: 0.1, y: 0.2, w: 0.4, h: 0.3 })}
        selected
        canvasRef={canvasRef}
        onSelect={() => {}}
        onUpdate={() => {}}
        onRemove={vi.fn()}
        all={[]}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
      />
    );
    const svg = document.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.querySelector("line")).not.toBeNull();
    expect(svg!.querySelector("polygon")).not.toBeNull();
  });

  it("renders a circle overlay", () => {
    const canvas = document.createElement("div");
    Object.defineProperty(canvas, "clientWidth", { value: 1000, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 1000, configurable: true });
    const canvasRef = { current: canvas } as React.RefObject<HTMLDivElement | null>;
    render(
      <AnnotationItem
        annotation={makeAnnotation({ type: "circle" })}
        selected
        canvasRef={canvasRef}
        onSelect={() => {}}
        onUpdate={() => {}}
        onRemove={vi.fn()}
        all={[]}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
      />
    );
    expect(document.querySelector("div[style*='border-radius: 50%']")).not.toBeNull();
  });

  it("selects the annotation on pointer down", () => {
    const canvas = document.createElement("div");
    Object.defineProperty(canvas, "clientWidth", { value: 1000, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 1000, configurable: true });
    const canvasRef = { current: canvas } as React.RefObject<HTMLDivElement | null>;
    const onSelect = vi.fn();
    render(
      <AnnotationItem
        annotation={makeAnnotation()}
        selected={false}
        canvasRef={canvasRef}
        onSelect={onSelect}
        onUpdate={() => {}}
        onRemove={vi.fn()}
        all={[]}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
      />
    );
    const box = document.querySelector("div[style*='cursor: move']") as HTMLDivElement;
    fireEvent.pointerDown(box, { clientX: 10, clientY: 10, pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith("a1", false);
  });

  it("closes the in-place editor on Escape", () => {
    const canvas = document.createElement("div");
    Object.defineProperty(canvas, "clientWidth", { value: 1000, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 1000, configurable: true });
    const canvasRef = { current: canvas } as React.RefObject<HTMLDivElement | null>;
    render(
      <AnnotationItem
        annotation={makeAnnotation({ type: "text", text: "Hello" })}
        selected
        canvasRef={canvasRef}
        onSelect={() => {}}
        onUpdate={() => {}}
        onRemove={vi.fn()}
        all={[]}
        onSelectMany={vi.fn()}
        onGuides={vi.fn()}
      />
    );
    fireEvent.doubleClick(screen.getByText("Hello"));
    const editable = document.querySelector('[contenteditable="true"]') as HTMLDivElement;
    expect(editable).toBeTruthy();
    fireEvent.keyDown(editable, { key: "Escape" });
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  });
});