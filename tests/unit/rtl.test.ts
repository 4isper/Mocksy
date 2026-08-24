import { describe, expect, it } from "vitest";
import { isRtlLocale, RTL_LOCALES } from "@/i18n/rtl";

describe("isRtlLocale", () => {
  it("marks Arabic-script and Hebrew locales as RTL", () => {
    for (const locale of RTL_LOCALES) {
      expect(isRtlLocale(locale), locale).toBe(true);
    }
  });

  it("treats LTR locales as LTR", () => {
    expect(isRtlLocale("en")).toBe(false);
    expect(isRtlLocale("ru")).toBe(false);
    expect(isRtlLocale("ja")).toBe(false);
    expect(isRtlLocale("zh")).toBe(false);
  });

  it("handles unknown or empty locale safely", () => {
    expect(isRtlLocale("")).toBe(false);
    expect(isRtlLocale("xx")).toBe(false);
    expect(isRtlLocale("AR")).toBe(false);
  });
});
