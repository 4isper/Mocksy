"use client";

import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/editor/LocaleSwitcher";

interface ToolbarProps {
  undo: () => void;
  redo: () => void;
  pastLength: number;
  futureLength: number;
  isExporting: boolean;
  setExportOpen: (v: boolean) => void;
  videoExportStatus: string | null;
  videoExportProgress: number;
  gifExportStatus: string | null;
  gifExportProgress: number;
  copyStatus: string | null;
  exportError: string | null;
  saveError: string | null;
  saved: boolean;
  themeMode: string;
  setThemeMode: (m: string) => void;
  saveNow: () => void;
  copyShareUrl: () => void;
  setShortcutsOpen: (v: boolean) => void;
  handleReset: () => void;
}

export function Toolbar({
  undo,
  redo,
  pastLength,
  futureLength,
  isExporting,
  setExportOpen,
  videoExportStatus,
  videoExportProgress,
  gifExportStatus,
  gifExportProgress,
  copyStatus,
  exportError,
  saveError,
  saved,
  themeMode,
  setThemeMode,
  saveNow,
  copyShareUrl,
  setShortcutsOpen,
  handleReset,
}: ToolbarProps) {
  const t = useTranslations();
  return (
    <div className="panel toolbar">
      <div className="toolbar-group">
        <button type="button" className="btn-tb btn-tb-icon" onClick={undo} disabled={pastLength === 0} title={t("editor.undoTitle")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3H2v2M2 5l2.5-2.5A4.5 4.5 0 1111.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={redo} disabled={futureLength === 0} title={t("editor.redoTitle")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 3h2v2M12 5l-2.5-2.5A4.5 4.5 0 102.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="toolbar-group">
        <button
          type="button"
          className="btn-tb btn-tb-primary"
          disabled={isExporting}
          onClick={() => setExportOpen(true)}
          title={t("editor.exportTitle")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v6M6 8l3-3M6 8l-3-3M2 9v1a1 1 0 001 1h6a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {t("nav.export")}
        </button>
      </div>
      {videoExportStatus ? (
        <div className="export-status" aria-live="polite">
          <span className="label">{videoExportStatus}</span>
          <div className="progress">
            <div style={{ width: `${videoExportProgress}%` }} />
          </div>
          <span className="pct">{Math.round(videoExportProgress)}%</span>
        </div>
      ) : null}
      {gifExportStatus ? (
        <div className="export-status" aria-live="polite">
          <span className="label">{gifExportStatus}</span>
          <div className="progress">
            <div style={{ width: `${gifExportProgress}%` }} />
          </div>
          <span className="pct">{Math.round(gifExportProgress)}%</span>
        </div>
      ) : null}
      {copyStatus ? (
        <span className="status saved" aria-live="polite">{copyStatus}</span>
      ) : exportError ? (
        <span className="error" role="alert">
          {exportError}
        </span>
      ) : saveError ? (
        <span className="error" role="alert" title={saveError}>
          {saveError}
        </span>
      ) : (
        <span className={`status${saved ? " saved" : ""}`} aria-live="polite">{saved ? t("editor.saved") : t("editor.unsaved")}</span>
      )}
      <span className="spacer" />
      <div className="toolbar-group">
        <div className="segmented" style={{ gap: 0 }} role="group" aria-label={t("editor.themeLabel")}>
          <button
            type="button"
            className={`btn-tb btn-tb-icon${themeMode === "light" ? " is-active" : ""}`}
            aria-pressed={themeMode === "light"}
            onClick={() => setThemeMode("light")}
            title={t("editor.lightTheme")}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M7 1v1.5M7 11.5V13M13 7h-1.5M2.5 7H1M11.3 2.7l-1 1M3.7 10.3l-1 1M11.3 11.3l-1-1M3.7 3.7l-1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
          <button
            type="button"
            className={`btn-tb btn-tb-icon${themeMode === "dark" ? " is-active" : ""}`}
            aria-pressed={themeMode === "dark"}
            onClick={() => setThemeMode("dark")}
            title={t("editor.darkTheme")}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M11.5 8A5.5 5.5 0 016 2.5 5.5 5.5 0 1011.5 8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
          </button>
          <button
            type="button"
            className={`btn-tb btn-tb-icon${themeMode === "system" ? " is-active" : ""}`}
            aria-pressed={themeMode === "system"}
            onClick={() => setThemeMode("system")}
            title={t("editor.systemTheme")}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M5 12.5h4M7 10v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>
      <div className="toolbar-group">
        <button type="button" className="btn-tb btn-tb-icon" onClick={saveNow} title={t("editor.saveTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M11.5 5.5V12a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5V2A.5.5 0 013 1.5h4.5l4 4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M4.5 9.5h5M4.5 11.5h5M4.5 7.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={copyShareUrl} title={t("editor.shareTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5.5 8.5l3-3M8 5.5l-1-1A2.5 2.5 0 119.5 3l.5.5M6 8.5l1 1A2.5 2.5 0 114.5 11l-.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={() => setShortcutsOpen(true)} title={t("editor.shortcutsTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={handleReset} title={t("editor.resetBtnTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M4 3H2v2M2 5l2.5-2.5A4.5 4.5 0 1111.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="toolbar-group">
        <LocaleSwitcher />
      </div>
    </div>
  );
}
