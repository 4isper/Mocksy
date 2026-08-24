import { describe, expect, it } from "vitest";
import { buildPatternSwatchStyle } from "@/lib/render/patternSwatch";

describe("buildPatternSwatchStyle", () => {
  it("returns a dot radial-gradient", () => {
    expect(buildPatternSwatchStyle("dots")).toContain("radial-gradient(circle");
  });

  it("returns a grid repeating-linear-gradient", () => {
    const style = buildPatternSwatchStyle("grid");
    expect(style).toContain("repeating-linear-gradient(0deg");
    expect(style).toContain("repeating-linear-gradient(90deg");
  });

  it("returns a 45deg diagonal gradient", () => {
    expect(buildPatternSwatchStyle("diagonal")).toContain("repeating-linear-gradient(45deg");
  });

  it("embeds an svg data uri for image patterns", () => {
    for (const id of ["noise", "plus", "cross", "triangle"] as const) {
      const style = buildPatternSwatchStyle(id);
      expect(style).toContain("data:image/svg+xml");
      expect(style).toContain("url(");
    }
  });

  it("falls back to transparent for unknown patterns", () => {
    // @ts-expect-error exercising the default branch
    expect(buildPatternSwatchStyle("nope")).toBe("transparent");
  });
});
