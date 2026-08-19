"use client";

import { useTranslations } from "next-intl";
import { exportProjectToFile } from "@/lib/state/projectFile";
import type { Project } from "@/lib/types/editor";

interface ProjectItemProps {
  project: Project;
  active: boolean;
  editing: boolean;
  draftName: string;
  relativeTime: (ts: number) => string;
  onSwitch: (id: string) => void;
  onStartRename: (id: string, name: string) => void;
  onCommitRename: () => void;
  onDraftChange: (v: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (project: Project) => void;
  onDelete: (id: string) => void;
  disableDelete: boolean;
}

/** One row in the active-projects list: name (editable inline), relative
 *  timestamp, and rename/duplicate/export/delete actions. */
export function ProjectItem({
  project,
  active,
  editing,
  draftName,
  relativeTime,
  onSwitch,
  onStartRename,
  onCommitRename,
  onDraftChange,
  onDuplicate,
  onExport,
  onDelete,
  disableDelete
}: ProjectItemProps) {
  const t = useTranslations();
  return (
    <li
      key={project.id}
      className={active ? "project-item is-active" : "project-item"}
      role="button"
      tabIndex={editing ? -1 : 0}
      aria-pressed={active}
      aria-label={project.name}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 8px",
        borderRadius: 8,
        border: active ? "2px solid var(--accent)" : "1px solid var(--panel-border)",
        background: active ? "rgba(0,217,255,0.08)" : "transparent",
        cursor: "pointer"
      }}
      onClick={() => !editing && onSwitch(project.id)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        if (!editing) onSwitch(project.id);
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", fontSize: 12 }}>
        {editing ? (
          <input
            className="project-rename"
            value={draftName}
            autoFocus
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onCommitRename();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", background: "transparent", border: "none", color: "inherit", fontSize: "inherit" }}
          />
        ) : (
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
        )}
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{relativeTime(project.updatedAt)}</span>
      </span>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={t("projects.renameLabel", { name: project.name })}
        data-tooltip={t("projects.rename")}
        disabled={editing}
        onClick={(e) => {
          e.stopPropagation();
          onStartRename(project.id, project.name);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={t("projects.duplicateLabel", { name: project.name })}
        data-tooltip={t("projects.duplicate")}
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate(project.id);
        }}
      >
        ⧉
      </button>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={t("projects.exportLabel", { name: project.name })}
        data-tooltip={t("projects.export")}
        onClick={(e) => {
          e.stopPropagation();
          onExport(project);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2v6M6 8l3-3M6 8l-3-3M2 9v1a1 1 0 001 1h6a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button
        type="button"
        className="btn-icon tooltip"
        aria-label={t("projects.deleteLabel", { name: project.name })}
        data-tooltip={t("projects.delete")}
        disabled={disableDelete}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(project.id);
        }}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </li>
  );
}
