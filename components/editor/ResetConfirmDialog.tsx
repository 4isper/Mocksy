"use client";

import { useEffect } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { useTranslations } from "next-intl";

export function ResetConfirmDialog({
  open,
  onConfirm,
  onCancel
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="reset-title">{t("editor.resetTitle")}</h3>
        <p id="reset-desc">{t("editor.resetMessage")}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} autoFocus>
            {t("editor.resetCancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {t("editor.resetConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
