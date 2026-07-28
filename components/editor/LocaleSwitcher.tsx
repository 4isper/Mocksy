"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

const LOCALES = ["en", "ru"] as const;

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
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          className={`btn-tb${locale === currentLocale ? " is-active" : ""}`}
          onClick={() => switchLocale(locale)}
          aria-label={t(locale)}
          aria-pressed={locale === currentLocale}
          style={{ fontSize: 11, fontWeight: 700, padding: "0 6px", letterSpacing: "0.04em" }}
        >
          {locale === "en" ? "EN" : "РУС"}
        </button>
      ))}
    </div>
  );
}
