import { getRequestConfig } from "next-intl/server";
import { deepMerge } from "@/i18n/mergeMessages";
import { RTL_LOCALES, isRtlLocale } from "@/i18n/rtl";

export const locales = ["en", "ru", "de", "es", "fr", "pt", "it", "ja", "ko", "zh", "tr", "pl", "nl", "uk", "ar", "hi", "id", "vi", "th", "sv", "no", "da", "fi", "cs", "bg", "el", "et", "he", "hr", "lt", "ro", "sl", "sr", "bn", "pa", "ms", "sw", "fa", "te", "mr", "ta", "ur", "gu", "kn", "am", "tl", "hu", "lv", "is", "ga", "cy", "sq", "hy", "ka", "az", "kk", "ne"] as const;
export type Locale = (typeof locales)[number];

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
