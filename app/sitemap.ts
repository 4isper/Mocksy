import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/i18n/locales";

/** Absolute site origin. NEXT_PUBLIC_SITE_URL must be set in production so
 *  sitemap/OG URLs point at the real domain; the localhost fallback keeps
 *  local builds and tests deterministic. */
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** One entry per locale root with hreflang alternates covering every other
 *  locale — the editor is a single route, localized through [locale]. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const languages = Object.fromEntries(locales.map((locale) => [locale, `${base}/${locale}`]));
  return [
    {
      url: `${base}/${defaultLocale}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages }
    }
  ];
}
