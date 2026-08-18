import { describe, expect, it } from "vitest";
import { resolveFrameStyle } from "@/lib/render/canvasDrawing";

describe("resolveFrameStyle", () => {
  it("uses the dark fill for glassDark and light fill otherwise", () => {
    expect(resolveFrameStyle("glassDark").fill).toBe("rgba(6,6,6,0.25)");
    expect(resolveFrameStyle("glassLight").fill).toBe("rgba(255,255,255,0.06)");
    expect(resolveFrameStyle("outline").fill).toBe("rgba(255,255,255,0.06)");
    expect(resolveFrameStyle("default").fill).toBe("rgba(255,255,255,0.06)");
  });

  it("strokes glass and outline presets but not default", () => {
    expect(resolveFrameStyle("glassDark").stroke).toBe(true);
    expect(resolveFrameStyle("glassLight").stroke).toBe(true);
    expect(resolveFrameStyle("outline").stroke).toBe(true);
    expect(resolveFrameStyle("default").stroke).toBe(false);
  });

  it("uses the outline stroke width only for outline", () => {
    expect(resolveFrameStyle("outline").strokeWidth).toBe(2);
    expect(resolveFrameStyle("glassDark").strokeWidth).toBe(1);
  });

  it("uses the dark stroke color for glassDark", () => {
    expect(resolveFrameStyle("glassDark").strokeStyle).toBe("rgba(255,255,255,0.15)");
    expect(resolveFrameStyle("glassLight").strokeStyle).toBe("rgba(255,255,255,0.45)");
  });
});
