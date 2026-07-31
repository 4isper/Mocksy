/** Locales rendered right-to-left (Arabic script, Hebrew, Urdu, Persian). */
export const RTL_LOCALES = ["ar", "he", "ur", "fa"] as const;

export function isRtlLocale(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}
