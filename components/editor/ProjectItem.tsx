"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { exportProjectToFile } from "@/lib/state/projectFile";
import { ContextMenu, type ContextMenuItem } from "@/components/editor/ContextMenu";
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
  onCancelRename: () => void;
  onDraftChange: (v: string) => void;
  onDuplicate: (id: string) => void;
  onExport: (project: Project) => void;
  onExportBundle: (project: Project) => void | Promise<void>;
  bundleBusy: boolean;
  onDelete: (id: string) => void;
  disableDelete: boolean;
}

/** One row in the active-projects list: name (editable inline), relative
 *  timestamp, an inline rename button and a "more actions" menu (duplicate /
 *  export / bundle / delete). Secondary actions live behind the menu so the
 *  name keeps room: five icon buttons left it an unreadable stub. */
export function ProjectItem({
  project,
  active,
  editing,
  draftName,
  relativeTime,
  onSwitch,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDraftChange,
  onDuplicate,
  onExport,
  onExportBundle,
  bundleBusy,
  onDelete,
  disableDelete
}: ProjectItemProps) {
  const t = useTranslations();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = () => {
    if (menu) {
      setMenu(null);
      return;
    }
    const r = moreRef.current?.getBoundingClientRect();
    if (!r) return;
    // Anchor below the trigger, right-aligned; the menu clamps into the
    // viewport near panel edges (same pattern as the toolbar overflow).
    setMenu({ x: r.right - 180, y: r.bottom + 6 });
  };

  const menuItems = useMemo<ContextMenuItem[]>(
    () => [
      { id: "duplicate", label: t("projects.duplicateLabel", { name: project.name }), onSelect: () => onDuplicate(project.id) },
      { id: "export", label: t("projects.exportLabel", { name: project.name }), onSelect: () => onExport(project) },
      { id: "bundle", label: t("projects.bundleExportLabel", { name: project.name }), disabled: bundleBusy, onSelect: () => void onExportBundle(project) },
      { id: "delete", label: t("projects.deleteLabel", { name: project.name }), danger: true, separatorBefore: true, disabled: disableDelete, onSelect: () => onDelete(project.id) }
    ],
    [t, project, onDuplicate, onExport, onExportBundle, onDelete, bundleBusy, disableDelete]
  );

  return (
    <li
      key={project.id}
      className={active ? "project-item is-active" : "project-item"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 8px",
        borderRadius: "var(--radius-xs)",
        border: active ? "2px solid var(--accent)" : "1px solid var(--panel-border)",
        background: active ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent"
      }}
    >
      <div
        role={editing ? undefined : "button"}
        tabIndex={editing ? -1 : 0}
        aria-pressed={editing ? undefined : active}
        aria-label={editing ? undefined : project.name}
        style={{ flex: 1, minWidth: 0, overflow: "hidden", fontSize: 12, cursor: editing ? "default" : "pointer" }}
        onClick={editing ? undefined : () => onSwitch(project.id)}
        onKeyDown={
          editing
            ? undefined
            : (e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                if (e.target !== e.currentTarget) return;
                e.preventDefault();
                onSwitch(project.id);
              }
        }
      >
        {editing ? (
          <input
            className="project-rename"
            value={draftName}
            autoFocus
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitRename();
              if (e.key === "Escape") onCancelRename();
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
      </div>
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
        ref={moreRef}
        className="btn-icon tooltip"
        aria-label={t("editor.moreActions")}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        data-tooltip={t("editor.moreActions")}
        onClick={toggleMenu}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="2.6" cy="7" r="1.1" fill="currentColor"/><circle cx="7" cy="7" r="1.1" fill="currentColor"/><circle cx="11.4" cy="7" r="1.1" fill="currentColor"/></svg>
      </button>
      {menu ? (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} triggerRef={moreRef} onClose={() => setMenu(null)} />
      ) : null}
    </li>
  );
}
