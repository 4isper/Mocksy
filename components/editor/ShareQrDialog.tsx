"use client";

import { useEffect } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { useTranslations } from "next-intl";
import { renderSVG } from "uqr";

/**
 * Modal that surfaces the just-copied share/template link as a QR code, so
 * the scene can be flung to a phone by scanning instead of pasting. Rendered
 * with nothing when `url` is null.
 */
export function ShareQrDialog({ url, onClose }: { url: string | null; onClose: () => void }) {
  const t = useTranslations();
  const trapRef = useFocusTrap(!!url);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("editor.qrTitle")}
        onClick={(e) => e.stopPropagation()}
        style={{ display: "grid", gap: 12, justifyItems: "center" }}
      >
        <h3 style={{ margin: 0 }}>{t("editor.qrTitle")}</h3>
        <div
          aria-hidden="true"
          style={{ width: 220, height: 220, background: "#fff", borderRadius: "var(--radius-xs)", padding: 10 }}
          dangerouslySetInnerHTML={{ __html: renderSVG(url) }}
        />
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
          {t("editor.qrCopiedHint")}
        </p>
        <button type="button" className="btn" onClick={onClose} autoFocus>
          {t("editor.qrClose")}
        </button>
      </div>
    </div>
  );
}
