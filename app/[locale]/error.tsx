"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = useTranslations("errors");

  return (
    <main className="editor-shell">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>Mocksy</h1>
      </div>
      <div className="panel" role="alert" style={{ padding: 24, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("title")}</h2>
        <p style={{ margin: 0, opacity: 0.7 }}>{t("message")}</p>
        <button type="button" className="btn btn-primary" onClick={reset} style={{ justifySelf: "start" }}>
          {t("tryAgain")}
        </button>
        <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.6 }}>{t("lastSceneSafe")}</p>
      </div>
    </main>
  );
}
