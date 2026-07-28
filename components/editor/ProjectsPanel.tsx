"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { exportProjectToFile, importProjectFromFile } from "@/lib/state/projectFile";

export function ProjectsPanel() {
  const t = useTranslations();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const relativeTime = (ts: number): string => {
    const diff = now - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return t("projects.justNow");
    if (min < 60) return t("projects.minAgo", { n: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return t("projects.hourAgo", { n: hr });
    const day = Math.floor(hr / 24);
    return t("projects.dayAgo", { n: day });
  };
  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const createProject = useProjectsStore((s) => s.createProject);
  const switchProject = useProjectsStore((s) => s.switchProject);
  const renameProject = useProjectsStore((s) => s.renameProject);
  const duplicateProject = useProjectsStore((s) => s.duplicateProject);
  const deleteProject = useProjectsStore((s) => s.deleteProject);
  const importProject = useProjectsStore((s) => s.importProject);
  const currentScene = useEditorStore((s) => s.scene);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleNew = () => {
    createProject(undefined, currentScene);
    setError(null);
  };

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraftName(name);
  };

  const commitRename = () => {
    if (editingId) renameProject(editingId, draftName);
    setEditingId(null);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const project = await importProjectFromFile(file);
      importProject(project);
      setError(null);
    } catch {
      setError(t("projects.importError"));
    }
  };

  return (
    <div style={{ padding: 10, display: "grid", gap: 8, alignContent: "start", overflow: "auto", minHeight: 0 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className="btn" style={{ flex: 1, fontSize: 12, padding: "7px 10px" }} onClick={handleNew}>
          {t("projects.newProjectBtn")}
        </button>
        <label className="btn" style={{ flex: 1, fontSize: 12, padding: "7px 10px", cursor: "pointer", textAlign: "center" }}>
          {t("projects.import")}
          <input type="file" accept="application/json,.json" onChange={handleImport} style={{ display: "none" }} />
        </label>
      </div>
      {error ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
          {error}
        </span>
      ) : null}
      <ul className="projects-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {projects.map((project) => {
          const active = project.id === activeProjectId;
          const editing = editingId === project.id;
          return (
            <li
              key={project.id}
              className={active ? "project-item is-active" : "project-item"}
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
              onClick={() => !editing && switchProject(project.id)}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", fontSize: 12 }}>
                {editing ? (
                  <input
                    className="project-rename"
                    value={draftName}
                    autoFocus
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingId(null);
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
                className="btn-icon"
                aria-label={t("projects.renameLabel", { name: project.name })}
                disabled={editing}
                onClick={(e) => { e.stopPropagation(); startRename(project.id, project.name); }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label={t("projects.duplicateLabel", { name: project.name })}
                onClick={(e) => { e.stopPropagation(); duplicateProject(project.id); }}
              >
                ⧉
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label={t("projects.exportLabel", { name: project.name })}
                onClick={(e) => { e.stopPropagation(); exportProjectToFile(project); }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2v6M6 8l3-3M6 8l-3-3M2 9v1a1 1 0 001 1h6a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label={t("projects.deleteLabel", { name: project.name })}
                disabled={projects.length <= 1}
                onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </li>
          );
        })}
      </ul>
      <p style={{ color: "var(--text-dim)", fontSize: 12, margin: 0 }}>
        {t("projects.autosaveNote")}
      </p>
    </div>
  );
}
