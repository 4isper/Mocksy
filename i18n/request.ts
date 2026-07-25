import { getRequestConfig } from "next-intl/server";

export const locales = ["en", "ru"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async function ({ locale, requestLocale }) {
  const resolvedLocale = locale ?? (await requestLocale);

  if (!resolvedLocale) {
    throw new Error("No locale resolved");
  }

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default
  };
});
