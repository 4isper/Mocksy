"use client";

import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ContextMenu, type ContextMenuItem } from "@/components/editor/ContextMenu";
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
  onUndoReset,
  onToggleFullscreen
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
  onToggleFullscreen: () => void;
}) {
  const t = useTranslations();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

  // Secondary actions collapse behind a “…” menu on narrow screens (<=1180px
  // in CSS) so the single-row toolbar never clips; undo moves to the bottom
  // tab bar at <=980px. The menu is presentational here and only visible
  // via CSS (.toolbar-more).
  const [overflowMenu, setOverflowMenu] = useState<{ x: number; y: number } | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  const openOverflow = () => {
    if (overflowMenu) {
      setOverflowMenu(null);
      return;
    }
    const r = moreRef.current?.getBoundingClientRect();
    if (!r) return;
    // Anchor just below the trigger and right-align the menu with it; the
    // ContextMenu clamps into the viewport if the toolbar sits near an edge.
    setOverflowMenu({ x: r.right - 180, y: r.bottom + 6 });
  };

  const overflowItems = useMemo<ContextMenuItem[]>(() => {
    const themes: ContextMenuItem[] = (
      [
        ["light", themeMode === "light"],
        ["dark", themeMode === "dark"],
        ["system", themeMode === "system"]
      ] as const
    ).map(([mode, checked]) => ({
      id: `theme-${mode}`,
      label: t(`editor.${mode}Theme`),
      checked,
      onSelect: () => setThemeMode(mode)
    }));
    return [
      ...themes,
      { id: "share", label: t("editor.shareTitle"), separatorBefore: true, onSelect: onShare },
      { id: "commands", label: t("editor.commandPaletteTitle"), onSelect: onOpenCommandPalette },
      { id: "shortcuts", label: t("editor.shortcutsTitle"), onSelect: onOpenShortcuts },
      { id: "reset", label: t("editor.resetBtnTitle"), onSelect: onReset },
      { id: "fullscreen", label: t("editor.fullscreenTitle"), onSelect: onToggleFullscreen }
    ];
  }, [t, themeMode, setThemeMode, onShare, onOpenCommandPalette, onOpenShortcuts, onReset, onToggleFullscreen]);

  return (
    <div className="panel toolbar">
      <div className="toolbar-group toolbar-undo">
        <button type="button" className="btn-tb btn-tb-icon" onClick={onUndo} disabled={!canUndo} title={t("editor.undoTitle")} aria-label={t("editor.undoTitle")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3H2v2M2 5l2.5-2.5A4.5 4.5 0 1111.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {undoCount > 0 ? <span className="undo-count" aria-hidden="true">{undoCount}</span> : null}
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={onRedo} disabled={!canRedo} title={t("editor.redoTitle")} aria-label={t("editor.redoTitle")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 3h2v2M12 5l-2.5-2.5A4.5 4.5 0 102.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {redoCount > 0 ? <span className="undo-count" aria-hidden="true">{redoCount}</span> : null}
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
      {/* Middle status slot: always mounted (even when empty) so transient
          toasts/progress never shift the action groups on either side.
          Content is clipped with ellipsis instead of wrapping the toolbar. */}
      <div className="toolbar-status" aria-live="off">
      {videoExportStatus ? (
        <div className="export-status">
          <span className="label">{videoExportStatus}</span>
          <div className="progress" role="progressbar" aria-valuenow={Math.round(videoExportProgress)} aria-valuemin={0} aria-valuemax={100} aria-label={videoExportStatus}>
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
          <div className="progress" role="progressbar" aria-valuenow={Math.round(gifExportProgress)} aria-valuemin={0} aria-valuemax={100} aria-label={gifExportStatus}>
            <div style={{ width: `${gifExportProgress}%` }} />
          </div>
          <span className="pct">{Math.round(gifExportProgress)}%</span>
          <button type="button" className="btn-tb btn-tb-icon" onClick={onCancelExport} title={t("editor.cancel")} aria-label={t("editor.cancel")}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      ) : null}
      {saveToast ? (
        <span className="toast-status" role={saveStatusType === "error" ? "alert" : "status"} style={{ "--toast-color": saveStatusType === "error" ? "var(--danger)" : saveStatusType === "success" ? "var(--success)" : "var(--text-dim)" } as CSSProperties}>
          {saveToast}
        </span>
      ) : null}
      {resetNotice ? (
        <span className="toast-status" role="status">
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
      </div>
      <div className="toolbar-group toolbar-aux">
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
      <div className="toolbar-group toolbar-aux">
        <button type="button" className="btn-tb btn-tb-icon" onClick={onShare} title={t("editor.shareTitle")} aria-label={t("editor.shareTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5.5 8.5l3-3M8 5.5l-1-1A2.5 2.5 0 119.5 3l.5.5M6 8.5l1 1A2.5 2.5 0 114.5 11l-.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={onOpenCommandPalette} title={t("editor.commandPaletteTitle")} aria-label={t("editor.commandPaletteTitle")} aria-keyshortcuts="Meta+K Control+K">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="10.5" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5.5h6M4 8.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={onOpenShortcuts} title={t("editor.shortcutsTitle")} aria-label={t("editor.shortcutsTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="3" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5.75h.01M7 5.75h.01M10 5.75h.01M4.5 8.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={onReset} title={t("editor.resetBtnTitle")} aria-label={t("editor.resetBtnTitle")}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M.6 2.3v3.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.05 8.75A5.25 5.25 0 1 0 3.29 3.29L.58 5.83" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button type="button" className="btn-tb btn-tb-icon" onClick={onToggleFullscreen} title={t("editor.fullscreenTitle")} aria-label={t("editor.fullscreenTitle")} aria-keyshortcuts="f">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 1h4v4M5 13H1V9M13 9v4H9M1 5V1h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="toolbar-group">
        <LocaleSwitcher />
      </div>
      <div className="toolbar-group">
        <button
          type="button"
          ref={moreRef}
          className="btn-tb btn-tb-icon toolbar-more"
          aria-haspopup="menu"
          aria-expanded={overflowMenu !== null}
          onClick={openOverflow}
          title={t("editor.moreActions")}
          aria-label={t("editor.moreActions")}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="2.6" cy="7" r="1.1" fill="currentColor"/><circle cx="7" cy="7" r="1.1" fill="currentColor"/><circle cx="11.4" cy="7" r="1.1" fill="currentColor"/></svg>
        </button>
      </div>
      {overflowMenu ? (
        <ContextMenu x={overflowMenu.x} y={overflowMenu.y} items={overflowItems} triggerRef={moreRef} onClose={() => setOverflowMenu(null)} />
      ) : null}
    </div>
  );
}
