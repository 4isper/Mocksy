"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import type { Project } from "@/lib/types/editor";

interface TrashSectionProps {
  trashed: Project[];
  relativeTime: (ts: number) => string;
  onRestore: (id: string) => void;
  onEmptyTrash: () => void;
}

/** Collapsible list of soft-deleted projects with restore actions and an
 *  empty-trash confirm modal (focus-trapped). */
export function TrashSection({ trashed, relativeTime, onRestore, onEmptyTrash }: TrashSectionProps) {
  const t = useTranslations();
  const [showTrash, setShowTrash] = useState(false);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const emptyTrashTrapRef = useFocusTrap(confirmEmptyTrash);

  if (trashed.length === 0) return null;

  return (
    <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: 8 }}>
      <button
        type="button"
        className="btn"
        style={{ width: "100%", fontSize: 12, padding: "7px 10px" }}
        onClick={() => setShowTrash((v) => !v)}
      >
        {showTrash ? t("projects.hideTrash") : t("projects.showTrash", { n: trashed.length })}
      </button>
      {showTrash ? (
        <ul className="projects-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, marginTop: 8 }}>
          {trashed.map((project) => (
            <li
              key={project.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid var(--panel-border)",
                opacity: 0.6
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", fontSize: 12 }}>
                <span
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 12
                  }}
                  title={project.name}
                >
                  {project.name}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{relativeTime(project.updatedAt)}</span>
              </span>
              <button
                type="button"
                className="btn-icon tooltip"
                aria-label={t("projects.restoreLabel", { name: project.name })}
                data-tooltip={t("projects.restoreLabel", { name: project.name })}
                onClick={() => onRestore(project.id)}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M5 3l-3 3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        className="btn"
        style={{ width: "100%", fontSize: 12, padding: "7px 10px", marginTop: 8, color: "var(--danger)" }}
        onClick={() => setConfirmEmptyTrash(true)}
      >
        {t("projects.emptyTrash")}
      </button>
      {confirmEmptyTrash ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmEmptyTrash(false)}>
          <div
            className="modal"
            ref={emptyTrashTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="empty-trash-title"
            aria-describedby="empty-trash-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="empty-trash-title">{t("projects.emptyTrashConfirm_title")}</h3>
            <p id="empty-trash-desc">{t("projects.emptyTrashConfirm_message")}</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setConfirmEmptyTrash(false)} autoFocus>
                {t("projects.emptyTrashConfirm_cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onEmptyTrash();
                  setConfirmEmptyTrash(false);
                }}
              >
                {t("projects.emptyTrashConfirm_confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
