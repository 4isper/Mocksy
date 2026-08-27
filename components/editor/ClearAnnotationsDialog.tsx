"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

interface ClearAnnotationsDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  trapRef: React.RefObject<HTMLDivElement | null>;
}

/** Confirmation modal for clearing all annotations. Focus-trapped while open. */
export function ClearAnnotationsDialog({ onConfirm, onCancel, trapRef }: ClearAnnotationsDialogProps) {
  const t = useTranslations();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-anno-title"
        aria-describedby="clear-anno-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="clear-anno-title">{t("annotation.clearAllConfirm_title")}</h3>
        <p id="clear-anno-desc">{t("annotation.clearAllConfirm_message")}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onCancel} autoFocus>
            {t("annotation.clearAllConfirm_cancel")}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            {t("annotation.clearAllConfirm_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
