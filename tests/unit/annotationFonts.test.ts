import { describe, expect, it } from "vitest";
import {
  ANNOTATION_FONT_OPTIONS,
  DEFAULT_ANNOTATION_FONT,
  ALIGN_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  FONT_STYLE_OPTIONS,
  annotationFontWeight,
  annotationFontStyle
} from "@/lib/presets/annotationFonts";

describe("annotationFonts", () => {
  it("exposes the default font and a non-empty option list", () => {
    expect(DEFAULT_ANNOTATION_FONT).toBe("Inter, system-ui, sans-serif");
    expect(ANNOTATION_FONT_OPTIONS.length).toBeGreaterThan(5);
    expect(ANNOTATION_FONT_OPTIONS[0]!.value).toBe(DEFAULT_ANNOTATION_FONT);
  });

  it("lists the three alignment options in order", () => {
    expect(ALIGN_OPTIONS.map((o) => o.value)).toEqual(["left", "center", "right"]);
  });

  it("lists weight and style toggles", () => {
    expect(FONT_WEIGHT_OPTIONS.map((o) => o.value)).toEqual(["bold", "normal"]);
    expect(FONT_STYLE_OPTIONS.map((o) => o.value)).toEqual(["normal", "italic"]);
  });

  it("defaults weight to bold and style to normal when unset", () => {
    expect(annotationFontWeight(undefined)).toBe("bold");
    expect(annotationFontStyle(undefined)).toBe("normal");
  });

  it("passes through explicit weight and style", () => {
    expect(annotationFontWeight("normal")).toBe("normal");
    expect(annotationFontStyle("italic")).toBe("italic");
  });
});
