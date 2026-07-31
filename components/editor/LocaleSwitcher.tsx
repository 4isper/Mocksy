"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

const LOCALES = ["en", "ru", "de", "es", "fr", "pt", "it", "ja", "ko", "zh", "tr", "pl", "nl", "uk", "ar", "hi", "id", "vi", "th", "sv", "no", "da", "fi", "cs", "bg", "el", "et", "he", "hr", "lt", "ro", "sl", "sr", "bn", "pa", "ms", "sw", "fa", "te", "mr", "ta", "ur", "gu", "kn", "am", "tl", "hu", "lv", "is", "ga", "cy", "sq", "hy", "ka", "az", "kk", "ne"] as const;

export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale = pathname.split("/")[1] || "en";

  const switchLocale = (next: string) => {
    const segments = pathname.split("/");
    segments[1] = next;
    router.push(segments.join("/"));
  };

  return (
    <div className="toolbar-group" style={{ gap: 2 }}>
      <select
        className="locale-select"
        value={currentLocale}
        onChange={(e) => switchLocale(e.target.value)}
        aria-label={t("language")}
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {t(locale)}
          </option>
        ))}
      </select>
    </div>
  );
}