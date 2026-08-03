import { describe, expect, it } from "vitest";
import { leafPaths, syncLocale, syncMessagesDir } from "@/scripts/i18n-sync.mjs";

describe("syncLocale", () => {
  it("fills keys missing from the locale with the English value", () => {
    const en = { a: "A", nested: { x: "X", y: "Y" } };
    const locale = { a: "A-л", nested: { x: "X-л" } };
    expect(syncLocale(en, locale)).toEqual({ a: "A-л", nested: { x: "X-л", y: "Y" } });
  });

  it("keeps the locale's own key order and appends new keys in en order", () => {
    const en = { a: "A", b: "B", c: "C" };
    const locale = { c: "C-л", a: "A-л" };
    expect(Object.keys(syncLocale(en, locale))).toEqual(["c", "a", "b"]);
  });

  it("drops orphan keys that no longer exist in en.json", () => {
    const en = { a: "A" };
    const locale = { a: "A-л", ghost: "gone" };
    expect(syncLocale(en, locale)).toEqual({ a: "A-л" });
  });

  it("replaces empty and MISSING_MESSAGE locale values with English", () => {
    const en = { a: "A", b: "B" };
    const locale = { a: "", b: "MISSING_MESSAGE" };
    expect(syncLocale(en, locale)).toEqual({ a: "A", b: "B" });
  });

  it("falls back to English when a locale namespace is a leaf in en.json", () => {
    const en = { a: "A" };
    const locale = { a: { nested: "x" } };
    expect(syncLocale(en, locale)).toEqual({ a: "A" });
  });

  it("builds a new namespace from English when the locale lacks it", () => {
    const en = { a: "A", deep: { x: "X", y: "Y" } };
    const locale = { a: "A-л" };
    expect(syncLocale(en, locale)).toEqual({ a: "A-л", deep: { x: "X", y: "Y" } });
  });

  it("treats a non-object locale as empty", () => {
    const en = { a: "A", nested: { x: "X" } };
    expect(syncLocale(en, undefined)).toEqual(en);
    expect(syncLocale(en, null as never)).toEqual(en);
  });

  it("keeps translated placeholder values as-is", () => {
    const en = { hello: "Hello {name}" };
    const locale = { hello: "Привет {name}" };
    expect(syncLocale(en, locale)).toEqual({ hello: "Привет {name}" });
  });
});

describe("leafPaths", () => {
  it("flattens nested namespaces into dot-paths", () => {
    expect(leafPaths({ a: "A", b: { c: "C", d: { e: "E" } } })).toEqual(["a", "b.c", "b.d.e"]);
  });
});

describe("syncMessagesDir integration", () => {
  it("reports every committed locale as already in sync with en.json", () => {
    const { changed, fileCount } = syncMessagesDir();
    expect(fileCount).toBeGreaterThan(0);
    expect(changed).toEqual([]);
  });
});
