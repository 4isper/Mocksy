import { getRequestConfig } from "next-intl/server";
import { deepMerge } from "@/i18n/mergeMessages";
import { RTL_LOCALES, isRtlLocale } from "@/i18n/rtl";
import { locales } from "@/i18n/locales";

export type { Locale } from "@/i18n/locales";

export { locales };
export { RTL_LOCALES, isRtlLocale } from "@/i18n/rtl";

export default getRequestConfig(async function ({ locale, requestLocale }) {
  const resolvedLocale = locale ?? (await requestLocale);

  if (!resolvedLocale) {
    throw new Error("No locale resolved");
  }

  const [messages, enMessages] = await Promise.all([
    import(`../messages/${resolvedLocale}.json`),
    import("../messages/en.json")
  ]);

  return {
    locale: resolvedLocale,
    messages: deepMerge(enMessages.default, messages.default) as Record<string, unknown>
  };
});
