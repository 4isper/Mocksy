import { describe, expect, it } from "vitest";
import { batchEntryName, padIndex } from "@/lib/export/exportBatch";

describe("padIndex", () => {
  it("pads to the width of the total count", () => {
    expect(padIndex(1, 9)).toBe("1");
    expect(padIndex(3, 10)).toBe("03");
    expect(padIndex(12, 100)).toBe("012");
    expect(padIndex(7, 7)).toBe("7");
  });

  it("never returns an empty string", () => {
    expect(padIndex(1, 0)).toBe("1");
  });
});

describe("batchEntryName", () => {
  it("combines the prefix, padded index and frame id", () => {
    expect(batchEntryName("iphone15", 2, 12)).toBe("mocksy-export-02-iphone15.png");
    expect(batchEntryName("macbook", 1, 4)).toBe("mocksy-export-1-macbook.png");
  });

  it("strips non ascii-safe characters from the frame id", () => {
    // @ts-expect-error exercising the sanitizer with a hostile value
    expect(batchEntryName("we!rd@frame", 1, 2)).toBe("mocksy-export-1-werdframe.png");
  });
});
