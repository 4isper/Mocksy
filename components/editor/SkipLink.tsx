"use client";

import { useTranslations } from "next-intl";

export function SkipLink() {
  const t = useTranslations();
  return (
    <a href="#main-content" className="skip-link" onClick={(e) => {
      e.preventDefault();
      const target = document.getElementById("main-content");
      target?.focus();
    }}>
      {t("accessibility.skipToContent")}
    </a>
  );
}
