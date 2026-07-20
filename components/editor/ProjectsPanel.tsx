"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { exportProjectToFile, importProjectFromFile } from "@/lib/state/projectFile";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function ProjectsPanel() {
  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const createProject = useProjectsStore((s) => s.createProject);
  const switchProject = useProjectsStore((s) => s.switchProject);
  const renameProject = useProjectsStore((s) => s.renameProject);
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
      setError("Could not import that file.");
    }
  };

  return (
    <div className="panel projects-panel" style={{ padding: 16, display: "grid", gap: 10, alignContent: "start" }}>
      <h2 className="panel-title">Projects</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-sm" onClick={handleNew}>
          + New
        </button>
        <label className="btn btn-sm" style={{ cursor: "pointer" }}>
          Import
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
                aria-label={`Rename ${project.name}`}
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
                aria-label={`Export ${project.name}`}
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
                aria-label={`Delete ${project.name}`}
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
        Projects autosave to this browser. Export to back up or move a mockup between devices.
      </p>
    </div>
  );
}
