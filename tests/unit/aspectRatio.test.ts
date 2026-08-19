import { describe, expect, it } from "vitest";
import { parseAspectRatio, parseAspectRatioOr } from "@/lib/render/aspectRatio";

describe("parseAspectRatio", () => {
  it("parses a well-formed ratio", () => {
    expect(parseAspectRatio("16 / 9")).toEqual({ w: 16, h: 9 });
    expect(parseAspectRatio("4/5")).toEqual({ w: 4, h: 5 });
    expect(parseAspectRatio("1 / 1")).toEqual({ w: 1, h: 1 });
  });

  it("returns null for malformed input", () => {
    expect(parseAspectRatio("garbage")).toBeNull();
    expect(parseAspectRatio("1 / 0")).toBeNull();
    expect(parseAspectRatio("1")).toBeNull();
    expect(parseAspectRatio("")).toBeNull();
  });
});

describe("parseAspectRatioOr", () => {
  it("returns the parsed ratio when valid", () => {
    expect(parseAspectRatioOr("16 / 9")).toEqual({ w: 16, h: 9 });
  });

  it("falls back to the default when malformed", () => {
    expect(parseAspectRatioOr("garbage")).toEqual({ w: 1, h: 1 });
    expect(parseAspectRatioOr("1 / 0", { w: 16, h: 9 })).toEqual({ w: 16, h: 9 });
  });
});
