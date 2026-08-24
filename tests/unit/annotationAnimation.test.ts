import { describe, expect, it } from "vitest";
import { annotationPreviewAnimation } from "@/lib/render/annotationAnimation";
import type { Annotation } from "@/lib/types/editor";

const base: Annotation = {
  id: "a1",
  type: "rect",
  x: 0,
  y: 0,
  w: 0.2,
  h: 0.2,
  text: "",
  color: "#fff",
  strokeWidth: 4,
  fontSize: 16
};

describe("annotationPreviewAnimation", () => {
  it("returns null when the annotation is not animated", () => {
    expect(annotationPreviewAnimation(base)).toBeNull();
  });

  it("returns the draw-on class for arrows", () => {
    expect(annotationPreviewAnimation({ ...base, type: "arrow", animated: true })?.className).toBe("ann-draw");
  });

  it("returns the typewriter class for text", () => {
    expect(annotationPreviewAnimation({ ...base, type: "text", animated: true })?.className).toBe("ann-typewriter");
  });

  it("returns the fade class for shapes and blur", () => {
    expect(annotationPreviewAnimation({ ...base, type: "rect", animated: true })?.className).toBe("ann-fade");
    expect(annotationPreviewAnimation({ ...base, type: "circle", animated: true })?.className).toBe("ann-fade");
    expect(annotationPreviewAnimation({ ...base, type: "blur", animated: true })?.className).toBe("ann-fade");
  });
});
