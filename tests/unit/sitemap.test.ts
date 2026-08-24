import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { defaultLocale, locales } from "@/i18n/locales";

describe("sitemap", () => {
  it("emits the default-locale entry with hreflang alternates for every locale", () => {
    const [entry] = sitemap();
    expect(entry?.url).toBe("http://localhost:3000/en");
    const languages = (entry as { alternates?: { languages?: Record<string, string> } }).alternates?.languages ?? {};
    for (const locale of locales) {
      expect(languages[locale]).toBe(`http://localhost:3000/${locale}`);
    }
    expect(Object.keys(languages)).toHaveLength(locales.length);
  });

  it("honours NEXT_PUBLIC_SITE_URL and tolerates a trailing slash", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://mocksy.example/";
    try {
      const [entry] = sitemap();
      expect(entry?.url).toBe("https://mocksy.example/en");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});
