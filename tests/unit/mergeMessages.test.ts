import { describe, expect, it } from "vitest";
import { deepMerge } from "@/i18n/mergeMessages";

describe("deepMerge", () => {
  it("keeps base values for keys the locale does not provide", () => {
    const base = { a: 1, nested: { x: 1, y: 2 } };
    const override = { a: 9, nested: { x: 1 } };
    expect(deepMerge(base, override)).toEqual({ a: 9, nested: { x: 1, y: 2 } });
  });

  it("lets the locale override English values", () => {
    const base = { editor: { undo: "Undo", grid: "Grid" } };
    const override = { editor: { grid: "Сетка" } };
    expect(deepMerge(base, override)).toEqual({
      editor: { undo: "Undo", grid: "Сетка" }
    });
  });

  it("merges deeply across multiple levels", () => {
    const base = { a: { b: { c: { d: 1, e: 2 }, f: 3 }, g: 4 }, h: 5 };
    const override = { a: { b: { c: { d: 10 } } } };
    expect(deepMerge(base, override)).toEqual({
      a: { b: { c: { d: 10, e: 2 }, f: 3 }, g: 4 },
      h: 5
    });
  });

  it("treats arrays as atomic (locale wins entirely)", () => {
    const base = { list: ["en", "ru"] };
    const override = { list: ["de"] };
    expect(deepMerge(base, override)).toEqual({ list: ["de"] });
  });

  it("returns the override when the base is not a record", () => {
    expect(deepMerge({ a: 1 }, 42 as never)).toBe(42);
    expect(deepMerge(null as never, "x" as never)).toBe("x");
  });

  it("an empty locale file keeps the full English tree", () => {
    const base = { a: { b: 1 }, c: 2 };
    expect(deepMerge(base, {})).toEqual(base);
  });
});
