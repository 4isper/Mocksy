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
    <div className="panel projects-panel" style={{ padding: 16, display: "grid", gap: 10, alignContent: "start" }}>
      <h2 className="panel-title">{t("projects.title")}</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-sm" onClick={handleNew}>
          {t("projects.newProjectBtn")}
        </button>
        <label className="btn btn-sm" style={{ cursor: "pointer" }}>
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
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: active ? "2px solid var(--accent)" : "1px solid var(--panel-border)",
                background: active ? "rgba(0,217,255,0.08)" : "transparent",
                cursor: "pointer"
              }}
              onClick={() => !editing && switchProject(project.id)}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
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
                      whiteSpace: "nowrap"
                    }}
                    title={project.name}
                  >
                    {project.name}
                  </span>
                )}
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{relativeTime(project.updatedAt)}</span>
              </span>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={t("projects.renameLabel", { name: project.name })}
                disabled={editing}
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(project.id, project.name);
                }}
              >
                ✎
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={t("projects.duplicateLabel", { name: project.name })}
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateProject(project.id);
                }}
              >
                ⧉
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={t("projects.exportLabel", { name: project.name })}
                onClick={(e) => {
                  e.stopPropagation();
                  exportProjectToFile(project);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label={t("projects.deleteLabel", { name: project.name })}
                disabled={projects.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProject(project.id);
                }}
              >
                ✕
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
