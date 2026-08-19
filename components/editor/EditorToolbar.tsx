"use client";

import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/editor/LocaleSwitcher";
import { useThemeStore } from "@/lib/state/themeStore";

export function EditorToolbar({
  canUndo,
  canRedo,
  undoCount,
  redoCount,
  onUndo,
  onRedo,
  onExport,
  isExporting,
  videoExportStatus,
  videoExportProgress,
  gifExportStatus,
  gifExportProgress,
  onCancelExport,
  onShare,
  onOpenCommandPalette,
  onOpenShortcuts,
  onReset,
  saveToast,
  saveStatusType,
  resetNotice,
  onUndoReset
}: {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  isExporting: boolean;
  videoExportStatus: string | null;
  videoExportProgress: number;
  gifExportStatus: string | null;
  gifExportProgress: number;
  onCancelExport: () => void;
  onShare: () => void;
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
  onReset: () => void;
  saveToast: string | null;
  saveStatusType: "success" | "error" | "info";
  resetNotice: boolean;
  onUndoReset: () => void;
}) {
  const t = useTranslations();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

  return (
    <div className="panel toolbar">
      <div className="toolbar-group">
        <button type="button" className="btn-tb btn-tb-icon" onClick={onUndo} disabled={!canUndo} title={t("editor.undoTitle")} aria-label={t("editor.undoTitle")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3H2v2M2 5l2.5-2.5A4.5 4.5 0 1111.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {undoCount > 0 ? <span style={{ fontSize: 9, lineHeight: 1, marginLeft: 1, opacity: 0.7 }}>{undoCount}</span> : null}
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={onRedo} disabled={!canRedo} title={t("editor.redoTitle")} aria-label={t("editor.redoTitle")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 3h2v2M12 5l-2.5-2.5A4.5 4.5 0 102.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {redoCount > 0 ? <span style={{ fontSize: 9, lineHeight: 1, marginLeft: 1, opacity: 0.7 }}>{redoCount}</span> : null}
        </button>
      </div>
      <div className="toolbar-group">
        <button
          type="button"
          className="btn-tb btn-tb-primary"
          disabled={isExporting}
          onClick={onExport}
          title={t("editor.exportTitle")}
          aria-label={t("editor.exportTitle")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v6M6 8l3-3M6 8l-3-3M2 9v1a1 1 0 001 1h6a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {t("nav.export")}
        </button>
      </div>
      {videoExportStatus ? (
        <div className="export-status">
          <span className="label">{videoExportStatus}</span>
          <div className="progress">
            <div style={{ width: `${videoExportProgress}%` }} />
          </div>
          <span className="pct">{Math.round(videoExportProgress)}%</span>
          <button type="button" className="btn-tb btn-tb-icon" onClick={onCancelExport} title={t("editor.cancel")} aria-label={t("editor.cancel")}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      ) : null}
      {gifExportStatus ? (
        <div className="export-status">
          <span className="label">{gifExportStatus}</span>
          <div className="progress">
            <div style={{ width: `${gifExportProgress}%` }} />
          </div>
          <span className="pct">{Math.round(gifExportProgress)}%</span>
          <button type="button" className="btn-tb btn-tb-icon" onClick={onCancelExport} title={t("editor.cancel")} aria-label={t("editor.cancel")}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      ) : null}
      {saveToast ? (
        <span className="toast-status" role={saveStatusType === "error" ? "alert" : undefined} style={{ color: saveStatusType === "error" ? "var(--danger)" : saveStatusType === "success" ? "var(--success)" : "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap" }}>
          {saveToast}
        </span>
      ) : null}
      {resetNotice ? (
        <span className="toast-status" role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap" }}>
          {t("editor.resetDone")}
          <button
            type="button"
            className="btn-tb btn-tb-icon"
            onClick={onUndoReset}
            title={t("editor.undoTitle")}
            aria-label={t("editor.undoTitle")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3H2v2M2 5l2.5-2.5A4.5 4.5 0 1111.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </span>
      ) : null}
      <span className="spacer" />
      <div className="toolbar-group">
        <div className="segmented" style={{ gap: 0 }} role="group" aria-label={t("editor.themeLabel")}>
          <button
            type="button"
            className={`btn-tb btn-tb-icon${themeMode === "light" ? " is-active" : ""}`}
            aria-pressed={themeMode === "light"}
            onClick={() => setThemeMode("light")}
            title={t("editor.lightTheme")}
            aria-label={t("editor.lightTheme")}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M7 1v1.5M7 11.5V13M13 7h-1.5M2.5 7H1M11.3 2.7l-1 1M3.7 10.3l-1 1M11.3 11.3l-1-1M3.7 3.7l-1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
          <button
            type="button"
            className={`btn-tb btn-tb-icon${themeMode === "dark" ? " is-active" : ""}`}
            aria-pressed={themeMode === "dark"}
            onClick={() => setThemeMode("dark")}
            title={t("editor.darkTheme")}
            aria-label={t("editor.darkTheme")}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M11.5 8A5.5 5.5 0 016 2.5 5.5 5.5 0 1011.5 8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
          </button>
          <button
            type="button"
            className={`btn-tb btn-tb-icon${themeMode === "system" ? " is-active" : ""}`}
            aria-pressed={themeMode === "system"}
            onClick={() => setThemeMode("system")}
            title={t("editor.systemTheme")}
            aria-label={t("editor.systemTheme")}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M5 12.5h4M7 10v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>
      <div className="toolbar-group">
        <button type="button" className="btn-tb btn-tb-icon" onClick={onShare} title={t("editor.shareTitle")} aria-label={t("editor.shareTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5.5 8.5l3-3M8 5.5l-1-1A2.5 2.5 0 119.5 3l.5.5M6 8.5l1 1A2.5 2.5 0 114.5 11l-.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={onOpenCommandPalette} title={t("editor.commandPaletteTitle")} aria-label={t("editor.commandPaletteTitle")} aria-keyshortcuts="Meta+K Control+K">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="10.5" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5.5h6M4 8.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={onOpenShortcuts} title={t("editor.shortcutsTitle")} aria-label={t("editor.shortcutsTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={onReset} title={t("editor.resetBtnTitle")} aria-label={t("editor.resetBtnTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M4 3H2v2M2 5l2.5-2.5A4.5 4.5 0 1111.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="toolbar-group">
        <LocaleSwitcher />
      </div>
    </div>
  );
}
