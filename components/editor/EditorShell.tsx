"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { useEditorExport } from "@/lib/hooks/useEditorExport";
import { warmUpFfmpeg } from "@/lib/export/exportVideo";
import { useEditorShortcuts } from "@/lib/hooks/useEditorShortcuts";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { RightPanel } from "@/components/editor/RightPanel";
import { CommandPalette } from "@/components/editor/CommandPalette";
import { ErrorBoundary } from "@/components/editor/ErrorBoundary";
import { LocaleSwitcher } from "@/components/editor/LocaleSwitcher";
import { useCommands } from "@/lib/hooks/useCommands";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { initHistoryPersistence, restoreHistory } from "@/lib/state/historyStorage";
import { useThemeStore } from "@/lib/state/themeStore";
import type { EditorScene } from "@/lib/types/editor";

const AUTOSAVE_DELAY = 500;

export function EditorShell() {
    const t = useTranslations();
    const scene = useEditorStore((s) => s.scene);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setScene = useEditorStore((s) => s.setScene);
  const resetScene = useEditorStore((s) => s.resetScene);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undoCount = useEditorStore((s) => s.past.length);
  const redoCount = useEditorStore((s) => s.future.length);
  const exportScale = useEditorStore((s) => s.exportScale);
  const setExportScale = useEditorStore((s) => s.setExportScale);
  const customExportSize = useEditorStore((s) => s.customExportSize);
  const setCustomExportSize = useEditorStore((s) => s.setCustomExportSize);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const saveError = useProjectsStore((s) => s.saveError);
  const [saved, setSaved] = useState(true);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const resetNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasOpenModalRef = useRef(false);
  const savedSceneRef = useRef<EditorScene | null>(null);
  const bootstrapped = useRef(false);
  useEffect(() => {
    hasOpenModalRef.current = confirmResetOpen || exportOpen || shortcutsOpen || commandPaletteOpen;
  }, [confirmResetOpen, exportOpen, shortcutsOpen, commandPaletteOpen]);
  const resetTrapRef = useFocusTrap(confirmResetOpen);

  // Save ref is updated below in a separate effect so it stays stable.
  const saveNowRef = useRef(() => {});
  const saveNow = useCallback(() => {
    saveNowRef.current();
  }, []);

  useEffect(() => {
    saveNowRef.current = () => {
      useProjectsStore.getState().updateActiveProjectScene({ ...scene, activeLayerId });
      setSaved(true);
    };
  }, [scene, activeLayerId]);

  const closeExportDialog = useCallback(() => setExportOpen(false), []);
  const exportApi = useEditorExport(scene, exportScale, customExportSize, closeExportDialog, activeLayerId);

  const commands = useCommands(
    exportApi.handleExportPng,
    exportApi.handleExportWebp,
    exportApi.handleExportSvg,
    exportApi.handleExportHtml,
    exportApi.handleExportPdf,
    exportApi.handleExportMp4,
    exportApi.handleExportWebm,
    exportApi.handleExportGif,
    exportApi.handleExportWebpAnim,
    exportApi.handleCopyPng,
    exportApi.copyShareUrl,
    saveNow
  );

  const handleReset = useCallback(() => setConfirmResetOpen(true), []);
  const handleNewProject = useCallback(() => {
    const id = useProjectsStore.getState().createProject("Untitled");
    useProjectsStore.getState().switchProject(id);
  }, []);
  useEditorShortcuts({
    saveNow,
    onReset: handleReset,
    onNewProject: handleNewProject,
    onExportPng: exportApi.handleExportPng,
    onExportMp4: exportApi.handleExportMp4,
    onExportGif: exportApi.handleExportGif,
    onExportWebm: exportApi.handleExportWebm,
    onExportWebp: exportApi.handleExportWebp,
    onExportWebpAnim: exportApi.handleExportWebpAnim,
    onExportSvg: exportApi.handleExportSvg,
    onExportHtml: exportApi.handleExportHtml,
    onExportPdf: exportApi.handleExportPdf,
    onCopyPng: exportApi.handleCopyPng,
    onOpenShortcuts: () => setShortcutsOpen(true),
    onOpenCommandPalette: () => setCommandPaletteOpen(true),
    isModalOpen: () => hasOpenModalRef.current
  });

  useEffect(() => {
    // Preload the FFmpeg encoder in the background so the first video/GIF
    // export doesn't block on the 32MB WASM download + worker boot. Gated on
    // the first user interaction: keeps the initial page load light (and the
    // Lighthouse byte-weight audit clean) for visitors who never export video.
    const arm = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => warmUpFfmpeg(), { timeout: 5000 });
      } else {
        setTimeout(warmUpFfmpeg, 1000);
      }
    };
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Only a genuine user edit (a `scene` different from the last persisted
    // baseline) should flip the indicator to "unsaved". The bootstrap restore
    // swaps `scene` from the initial demo to the hydrated one; ignore that
    // transient so we don't flicker a false "unsaved" on every load.
    if (bootstrapped.current && savedSceneRef.current && savedSceneRef.current !== scene) {
      setSaved(false);
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      // Persist the current scene into the active project (which writes the
      // whole project list to localStorage). Dead blob: layers are handled by
      // the orphaned-blob subscription, so a refresh simply shows the demo.
      useProjectsStore.getState().updateActiveProjectScene({ ...scene, activeLayerId });
      savedSceneRef.current = scene;
      setSaved(true);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [scene, activeLayerId]);

  useEffect(() => {
    // Bootstrap from projects (URL share, localStorage, or a fresh demo). The
    // restored scene is not a user edit, so don't push it onto the undo stack
    // (also keeps StrictMode's double-mount from recording a duplicate entry).
    const restored = useProjectsStore.getState().hydrate();
    // The restored scene already matches what's persisted, so treat it as the
    // saved baseline. `setScene` merges into a fresh object, so sync the ref
    // to the live scene afterwards — the autosave watcher won't flag it
    // "unsaved" on load.
    setScene(restored, false);
    savedSceneRef.current = useEditorStore.getState().scene;
    bootstrapped.current = true;
    // Bring back the undo/redo stacks saved by the last session (also not an
    // edit — it only fills `past`/`future`), then start watching for changes
    // so every subsequent edit persists across reloads.
    restoreHistory();
    return initHistoryPersistence();
  }, [setScene]);

  const toastStatus = exportApi.copyStatus
    ? { msg: exportApi.copyStatus, type: "success" as const }
    : exportApi.exportError
      ? { msg: exportApi.exportError, type: "error" as const }
      : saveError
        ? { msg: saveError, type: "error" as const }
        : { msg: saved ? t("editor.saved") : t("editor.unsaved"), type: "info" as const };

  useEffect(() => {
    if (toastStatus.msg) {
      const timer = setTimeout(() => {
        // auto-dismiss handled by toastStatus reactivity
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastStatus.msg]);

  useEffect(() => () => {
    if (resetNoticeTimer.current) clearTimeout(resetNoticeTimer.current);
  }, []);

  const confirmReset = useCallback(() => {
    resetScene();
    setSaved(true);
    setResetNotice(true);
    if (resetNoticeTimer.current) clearTimeout(resetNoticeTimer.current);
    resetNoticeTimer.current = setTimeout(() => setResetNotice(false), 6000);
    setConfirmResetOpen(false);
  }, [resetScene]);

  const cancelReset = useCallback(() => setConfirmResetOpen(false), []);

  useEffect(() => {
    if (!confirmResetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelReset();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmResetOpen, cancelReset]);

  return (
    <main className="editor-shell" id="main-content" tabIndex={-1}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>Mocksy</h1>
        <span className="tag">{t("editor.tagline")}</span>
      </div>
      <div className="editor-grid">
        <ErrorBoundary message={t("errors.message")}><ControlPanel /></ErrorBoundary>
        <section style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 12, minHeight: 0, overflow: "hidden" }}>
          <ErrorBoundary message={t("errors.message")}><PreviewCanvas scene={scene} /></ErrorBoundary>
          <div className="panel toolbar">
            <div className="toolbar-group">
              <button type="button" className="btn-tb btn-tb-icon" onClick={undo} disabled={!canUndo} title={t("editor.undoTitle")} aria-label={t("editor.undoTitle")}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3H2v2M2 5l2.5-2.5A4.5 4.5 0 1111.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {undoCount > 0 ? <span style={{ fontSize: 9, lineHeight: 1, marginLeft: 1, opacity: 0.7 }}>{undoCount}</span> : null}
              </button>
              <button type="button" className="btn-tb btn-tb-icon" onClick={redo} disabled={!canRedo} title={t("editor.redoTitle")} aria-label={t("editor.redoTitle")}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 3h2v2M12 5l-2.5-2.5A4.5 4.5 0 102.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {redoCount > 0 ? <span style={{ fontSize: 9, lineHeight: 1, marginLeft: 1, opacity: 0.7 }}>{redoCount}</span> : null}
              </button>
            </div>
            <div className="toolbar-group">
              <button
                type="button"
                className="btn-tb btn-tb-primary"
                disabled={exportApi.isExporting}
                onClick={() => setExportOpen(true)}
                title={t("editor.exportTitle")}
                aria-label={t("editor.exportTitle")}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v6M6 8l3-3M6 8l-3-3M2 9v1a1 1 0 001 1h6a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {t("nav.export")}
              </button>
            </div>
            {exportApi.videoExportStatus ? (
              <div className="export-status">
                <span className="label">{exportApi.videoExportStatus}</span>
                <div className="progress">
                  <div style={{ width: `${exportApi.videoExportProgress}%` }} />
                </div>
                <span className="pct">{Math.round(exportApi.videoExportProgress)}%</span>
                <button type="button" className="btn-tb btn-tb-icon" onClick={exportApi.cancelExport} title={t("editor.cancel")} aria-label={t("editor.cancel")}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            ) : null}
            {exportApi.gifExportStatus ? (
              <div className="export-status">
                <span className="label">{exportApi.gifExportStatus}</span>
                <div className="progress">
                  <div style={{ width: `${exportApi.gifExportProgress}%` }} />
                </div>
                <span className="pct">{Math.round(exportApi.gifExportProgress)}%</span>
                <button type="button" className="btn-tb btn-tb-icon" onClick={exportApi.cancelExport} title={t("editor.cancel")} aria-label={t("editor.cancel")}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            ) : null}
{toastStatus.msg ? (
                <span className="toast-status" role={toastStatus.type === "error" ? "alert" : undefined} style={{ color: toastStatus.type === "error" ? "var(--danger)" : toastStatus.type === "success" ? "var(--success)" : "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap" }}>
                  {toastStatus.msg}
                </span>
               ) : null}
            {resetNotice ? (
              <span className="toast-status" role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 12, whiteSpace: "nowrap" }}>
                {t("editor.resetDone")}
                <button
                  type="button"
                  className="btn-tb btn-tb-icon"
                  onClick={() => {
                    undo();
                    setResetNotice(false);
                  }}
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
              <button type="button" className="btn-tb btn-tb-icon" onClick={exportApi.copyShareUrl} title={t("editor.shareTitle")} aria-label={t("editor.shareTitle")}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5.5 8.5l3-3M8 5.5l-1-1A2.5 2.5 0 119.5 3l.5.5M6 8.5l1 1A2.5 2.5 0 114.5 11l-.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button type="button" className="btn-tb btn-tb-icon" onClick={() => setShortcutsOpen(true)} title={t("editor.shortcutsTitle")} aria-label={t("editor.shortcutsTitle")}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </button>
              <button type="button" className="btn-tb btn-tb-icon" onClick={handleReset} title={t("editor.resetBtnTitle")} aria-label={t("editor.resetBtnTitle")}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M4 3H2v2M2 5l2.5-2.5A4.5 4.5 0 1111.5 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            <div className="toolbar-group">
              <LocaleSwitcher />
            </div>
          </div>
        </section>
        <ErrorBoundary message={t("errors.message")}><RightPanel /></ErrorBoundary>
      </div>
      {confirmResetOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={cancelReset}>
          <div
            className="modal"
            ref={resetTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-title">{t("editor.resetTitle")}</h3>
            <p id="reset-desc">{t("editor.resetMessage")}</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={cancelReset} autoFocus>
                {t("editor.resetCancel")}
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmReset}>
                {t("editor.resetConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        scale={exportScale}
        onScaleChange={setExportScale}
        customSize={customExportSize}
        onCustomSizeChange={setCustomExportSize}
        onExport={exportApi.handleExport}
        onCopy={exportApi.handleCopyFromDialog}
        busy={exportApi.isExporting}
        onCancel={exportApi.cancelExport}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette
        commands={commands}
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </main>
  );
}
