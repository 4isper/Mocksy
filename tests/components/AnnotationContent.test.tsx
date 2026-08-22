// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { AnnotationContent } from "@/components/editor/AnnotationContent";
import type { Annotation } from "@/lib/types/editor";

afterEach(cleanup);

function make(overrides: Partial<Annotation> = {}): Annotation {
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

const props = (annotation: Annotation) => ({
  annotation,
  size: { w: 800, h: 600 },
  bx: annotation.x,
  by: annotation.y,
  editing: false,
  editRef: { current: null },
  onTextInput: () => {},
  onStopEditing: () => {},
  onStartEditing: () => {}
});

describe("AnnotationContent animation classes", () => {
  it("applies the draw-on class to an animated arrow", () => {
    const { container } = render(<AnnotationContent {...props(make({ type: "arrow", animated: true }))} />);
    expect(container.querySelector(".ann-draw")).not.toBeNull();
  });

  it("applies the typewriter class to animated text", () => {
    const { container } = render(<AnnotationContent {...props(make({ type: "text", text: "Hi", animated: true }))} />);
    expect(container.querySelector(".ann-typewriter")).not.toBeNull();
  });

  it("does not apply an animation class when not animated", () => {
    const { container } = render(<AnnotationContent {...props(make({ type: "rect" }))} />);
    expect(container.querySelector(".ann-fade")).toBeNull();
    expect(container.querySelector(".ann-draw")).toBeNull();
    expect(container.querySelector(".ann-typewriter")).toBeNull();
  });
});
