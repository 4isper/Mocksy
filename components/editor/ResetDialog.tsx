"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

interface ResetDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResetDialog({ open, onClose, onConfirm }: ResetDialogProps) {
  const t = useTranslations();
  const resetTrapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        ref={resetTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="reset-title">{t("editor.resetTitle")}</h3>
        <p id="reset-desc">{t("editor.resetMessage")}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} autoFocus>
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
