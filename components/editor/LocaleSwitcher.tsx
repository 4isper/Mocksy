"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { locales } from "@/i18n/locales";
import { localeCoverage } from "@/i18n/generated";

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
        {locales.map((locale) => {
          const coverage = localeCoverage[locale];
          const isPartial = coverage !== undefined && coverage < 100;
          return (
            <option key={locale} value={locale}>
              {t(locale)}
              {isPartial ? ` (${t("partial")})` : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}