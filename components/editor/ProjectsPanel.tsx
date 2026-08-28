"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Project } from "@/lib/types/editor";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { exportProjectToFile, importProjectFromFile } from "@/lib/state/projectFile";
import { exportProjectBundle, importProjectBundle, isBundleFile } from "@/lib/state/projectBundle";
import { exportTemplateToFile, importTemplateFromFile } from "@/lib/state/templateFile";
import { relativeTime } from "@/lib/state/relativeTime";
import { ProjectItem } from "@/components/editor/ProjectItem";
import { TrashSection } from "@/components/editor/TrashSection";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export function ProjectsPanel() {
  const t = useTranslations();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const hydrated = useProjectsStore((s) => s.hydrated);
  const createProject = useProjectsStore((s) => s.createProject);
  const switchProject = useProjectsStore((s) => s.switchProject);
  const renameProject = useProjectsStore((s) => s.renameProject);
  const duplicateProject = useProjectsStore((s) => s.duplicateProject);
  const deleteProject = useProjectsStore((s) => s.deleteProject);
  const restoreProject = useProjectsStore((s) => s.restoreProject);
  const emptyTrash = useProjectsStore((s) => s.emptyTrash);
  const importProject = useProjectsStore((s) => s.importProject);
  const currentScene = useEditorStore((s) => s.scene);
  const setScene = useEditorStore((s) => s.setScene);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [busyExportId, setBusyExportId] = useState<string | null>(null);
  const trapRef = useFocusTrap(!!pendingSwitchId);

  useEffect(() => {
    if (!pendingSwitchId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingSwitchId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pendingSwitchId]);

  const activeProjects = projects.filter((p) => p.deletedAt == null);
  const trashedProjects = projects.filter((p) => p.deletedAt != null);

  const relTime = (ts: number) => relativeTime(ts, now, (key, vars) => t(key, vars as Record<string, string | number | Date>));

  const handleNew = () => {
    createProject(undefined, currentScene);
    setError(null);
  };

  const handleSwitch = useCallback((id: string) => {
    if (id === activeProjectId) return;
    const hasUndo = useEditorStore.getState().past.length > 0;
    if (hasUndo) {
      setPendingSwitchId(id);
    } else {
      switchProject(id);
    }
  }, [activeProjectId, switchProject]);

  const confirmSwitch = useCallback(() => {
    if (pendingSwitchId) switchProject(pendingSwitchId);
    setPendingSwitchId(null);
  }, [pendingSwitchId, switchProject]);

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraftName(name);
  };

  const commitRename = () => {
    if (editingId) renameProject(editingId, draftName);
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      // .mocksy.zip bundles carry their media; plain JSON imports the
      // appearance-only project format.
      const project = isBundleFile(file) ? await importProjectBundle(file) : await importProjectFromFile(file);
      importProject(project);
      setError(null);
    } catch {
      setError(t("projects.importError"));
    }
  };

  const handleExportBundle = async (project: Project) => {
    try {
      setBusyExportId(project.id);
      await exportProjectBundle(project);
      setError(null);
    } catch {
      setError(t("projects.bundleError"));
    } finally {
      setBusyExportId(null);
    }
  };

  const handleTemplateImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const scene = await importTemplateFromFile(file);
      setScene(scene);
      setError(null);
    } catch {
      setError(t("projects.templateError"));
    }
  };

  const handleTemplateExport = () => {
    const active = projects.find((p) => p.id === activeProjectId);
    exportTemplateToFile(currentScene, active?.name ?? "mocksy-template");
  };

  return (
    <div style={{ padding: 10, display: "grid", gap: 8, alignContent: "start", overflow: "auto", minHeight: 0 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className="btn" style={{ flex: 1, fontSize: 12, padding: "7px 10px" }} onClick={handleNew}>
          {t("projects.newProjectBtn")}
        </button>
        <label className="btn" style={{ flex: 1, fontSize: 12, padding: "7px 10px", cursor: "pointer", textAlign: "center" }}>
          {t("projects.import")}
          <input
            type="file"
            accept="application/json,.json,.zip,application/zip,.mocksy.zip"
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="btn"
          style={{ flex: 1, fontSize: 12, padding: "7px 10px" }}
          title={t("projects.templateExportHint")}
          onClick={handleTemplateExport}
        >
          {t("projects.templateExportBtn")}
        </button>
        <label className="btn" style={{ flex: 1, fontSize: 12, padding: "7px 10px", cursor: "pointer", textAlign: "center" }} title={t("projects.templateImportHint")}>
          {t("projects.templateImportBtn")}
          <input
            type="file"
            accept="application/json,.json,.mocksy.json"
            onChange={handleTemplateImport}
            style={{ display: "none" }}
          />
        </label>
      </div>
      {error ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
          {error}
        </span>
      ) : null}
      {!hydrated ? (
        <div aria-busy="true" aria-label={t("editor.loadingMedia")} style={{ display: "grid", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton-row" style={{ height: 36, borderRadius: 8 }} />
          ))}
        </div>
      ) : activeProjects.length === 0 && trashedProjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M3 9h18M9 3v18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </div>
          <p className="empty-state-text">{t("projects.noProjects")}</p>
        </div>
      ) : (
        <ul className="projects-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {activeProjects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              active={project.id === activeProjectId}
              editing={editingId === project.id}
              draftName={draftName}
              relativeTime={relTime}
              onSwitch={handleSwitch}
              onStartRename={startRename}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onDraftChange={setDraftName}
              onDuplicate={duplicateProject}
              onExport={exportProjectToFile}
              onExportBundle={handleExportBundle}
              bundleBusy={busyExportId === project.id}
              onDelete={deleteProject}
              disableDelete={activeProjects.length <= 1}
            />
          ))}
        </ul>
      )}
      <TrashSection trashed={trashedProjects} relativeTime={relTime} onRestore={restoreProject} onEmptyTrash={emptyTrash} />
      <p style={{ color: "var(--text-dim)", fontSize: 12, margin: 0 }}>
        {t("projects.autosaveNote")}
      </p>
      {pendingSwitchId && (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingSwitchId(null)}>
          <div className="modal" ref={trapRef} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{t("projects.switchConfirmTitle")}</h3>
            <p>{t("projects.switchConfirmMessage")}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setPendingSwitchId(null)} autoFocus>{t("projects.switchConfirmCancel")}</button>
              <button type="button" className="btn btn-danger" onClick={confirmSwitch}>{t("projects.switchConfirmDiscard")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
