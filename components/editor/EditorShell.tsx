"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { RightPanel } from "@/components/editor/RightPanel";
import { CommandPalette } from "@/components/editor/CommandPalette";
import { useCommands } from "@/lib/hooks/useCommands";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { exportImage, copyPngToClipboard } from "@/lib/export/exportImage";
import { sceneToShareUrl, ShareUrlTooLarge } from "@/lib/state/shareState";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { useThemeStore } from "@/lib/state/themeStore";
import { LocaleSwitcher } from "@/components/editor/LocaleSwitcher";
import { ErrorBoundary } from "@/components/editor/ErrorBoundary";

const AUTOSAVE_DELAY = 500;

export function EditorShell() {
  const t = useTranslations();
  const scene = useEditorStore((s) => s.scene);
  const setScene = useEditorStore((s) => s.setScene);
  const resetScene = useEditorStore((s) => s.resetScene);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const pastLength = useEditorStore((s) => s.past.length);
  const futureLength = useEditorStore((s) => s.future.length);
  const exportScale = useEditorStore((s) => s.exportScale);
  const setExportScale = useEditorStore((s) => s.setExportScale);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const [videoExportStatus, setVideoExportStatus] = useState<string | null>(null);
  const [videoExportProgress, setVideoExportProgress] = useState<number>(0);
  const [gifExportStatus, setGifExportStatus] = useState<string | null>(null);
  const [gifExportProgress, setGifExportProgress] = useState<number>(0);
  const isExporting = videoExportStatus !== null || gifExportStatus !== null;
  const saveError = useProjectsStore((s) => s.saveError);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const hasOpenModalRef = useRef(false);
  useEffect(() => {
    hasOpenModalRef.current = confirmResetOpen || exportOpen || shortcutsOpen || commandPaletteOpen;
  }, [confirmResetOpen, exportOpen, shortcutsOpen, commandPaletteOpen]);
  const resetTrapRef = useFocusTrap(confirmResetOpen);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Callbacks must be defined before useCommands
  const saveNow = useCallback(() => {
    useProjectsStore.getState().updateActiveProjectScene(scene);
    setSaved(true);
  }, [scene]);

  const copyShareUrl = useCallback(async () => {
    try {
      const url = sceneToShareUrl(scene);
      await navigator.clipboard.writeText(url);
    } catch (err) {
      if (err instanceof ShareUrlTooLarge) {
        setExportError(t("shareUrlTooLarge"));
      } else {
        setExportError(err instanceof Error ? err.message : "Could not create share link");
      }
    }
  }, [scene, t]);

  const handleExportPng = useCallback(() => {
    setExportError(null);
    exportImage(scene, "preview-canvas", "mocksy-export", setExportError, exportScale);
  }, [scene, exportScale]);

  const handleCopyPng = useCallback(async () => {
    setExportError(null);
    await copyPngToClipboard(scene, "preview-canvas", setExportError, setCopyStatus, exportScale);
  }, [scene, exportScale]);

  const handleExportMp4 = useCallback(async () => {
    setExportError(null);
    try {
      setVideoExportStatus("Exporting video…");
      setVideoExportProgress(0);
      const { exportVideo } = await import("@/lib/export/exportVideo");
      await exportVideo(scene, exportScale, setVideoExportStatus, setVideoExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setVideoExportStatus(null);
        setVideoExportProgress(0);
      }, 800);
    }
  }, [scene, exportScale]);

  const handleExportGif = useCallback(async () => {
    setExportError(null);
    try {
      setGifExportStatus("Exporting GIF…");
      setGifExportProgress(0);
      const { exportGif } = await import("@/lib/export/exportVideo");
      await exportGif(scene, exportScale, setGifExportStatus, setGifExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setGifExportStatus(null);
        setGifExportProgress(0);
      }, 800);
    }
  }, [scene, exportScale]);

  const handleExport = useCallback(
    (format: "png" | "mp4" | "gif") => {
      setExportOpen(false);
      if (format === "png") handleExportPng();
      else if (format === "mp4") handleExportMp4();
      else handleExportGif();
    },
    [handleExportPng, handleExportMp4, handleExportGif]
  );

  const handleCopyFromDialog = useCallback(() => {
    setExportOpen(false);
    handleCopyPng();
  }, [handleCopyPng]);

  const handleReset = useCallback(() => {
    setConfirmResetOpen(true);
  }, []);

  const confirmReset = useCallback(() => {
    resetScene();
    setSaved(false);
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

  // Clear the transient "Copied" status after a moment so it doesn't
  // linger in the toolbar like the persistent Saved indicator.
  useEffect(() => {
    if (!copyStatus) return;
    const t = setTimeout(() => setCopyStatus(null), 1500);
    return () => clearTimeout(t);
  }, [copyStatus]);

  const commands = useCommands(
    handleExportPng,
    handleExportMp4,
    handleExportGif,
    handleCopyPng,
    copyShareUrl,
    saveNow
  );

  useEffect(() => {
    // Bootstrap from projects (URL share, localStorage, or a fresh demo). The
    // restored scene is not a user edit, so don't push it onto the undo stack
    // (also keeps StrictMode's double-mount from recording a duplicate entry).
    const restored = useProjectsStore.getState().hydrate();
    setScene(restored, false);
  }, [setScene]);

  const prevSceneRef = useRef(scene);
  useEffect(() => {
    if (prevSceneRef.current !== scene) {
      setSaved(false);
    }
    prevSceneRef.current = scene;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      // Persist the current scene into the active project (which writes the
      // whole project list to localStorage). Dead blob: layers are handled by
      // the orphaned-blob subscription, so a refresh simply shows the demo.
      useProjectsStore.getState().updateActiveProjectScene(scene);
      setSaved(true);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [scene]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      // ? opens the keyboard-shortcuts cheat sheet. Skip while typing so it
      // doesn't interfere with "?" typed into a text field. Match on the
      // physical key (code "Slash" + Shift) so it's layout-independent
      // and robust to how the "?" character is delivered (event.key).
      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      // Skip shortcuts when a modal dialog is open.
      if (hasOpenModalRef.current) return;
      if ((event.key === "?" || (event.code === "Slash" && event.shiftKey)) && !typing) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      // ⌘K opens the command palette
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        const st = useEditorStore.getState();
        if (event.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        useEditorStore.getState().redo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveNow();
        return;
      }
      if (modifier && !event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        handleExportPng();
        return;
      }
      // ⌘⇧E exports MP4, ⌘⇧G exports GIF (the GIF module is
      // still loaded lazily, via the same dynamic import as MP4).
      if (modifier && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        handleExportMp4();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        handleExportGif();
        return;
      }
      // ⌘⇧C copies a PNG snapshot to the clipboard (⌘C alone stays
      // free for normal text copy while typing in a field).
      if (modifier && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        handleCopyPng();
        return;
      }
      // Layer shortcuts: ⌘D duplicates the active layer, ⌘↑/⌘↓ move it.
      // Skip while typing in a field so they don't hijack text editing.
      if (modifier && !typing && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const st = useEditorStore.getState();
        const id = st.scene.activeLayerId ?? st.scene.layers[0]?.id;
        if (id) st.duplicateLayer(id);
        return;
      }
      if (modifier && !typing && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const st = useEditorStore.getState();
        const ids = st.scene.layers.map((l) => l.id);
        const idx = ids.indexOf(st.scene.activeLayerId ?? st.scene.layers[0]?.id ?? "");
        const dir = event.key === "ArrowUp" ? -1 : 1;
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= ids.length) return;
        const a = ids[idx];
        const b = ids[next];
        if (a === undefined || b === undefined) return;
        ids[idx] = b;
        ids[next] = a;
        st.reorderLayers(ids);
        return;
      }
      if (modifier && !typing && (event.key === "[" || event.key === "]")) {
        event.preventDefault();
        const st = useEditorStore.getState();
        const ids = st.scene.layers.map((l) => l.id);
        const idx = ids.indexOf(st.scene.activeLayerId ?? st.scene.layers[0]?.id ?? "");
        if (idx < 0) return;
        const dir = event.key === "[" ? -1 : 1;
        const nextIdx = Math.max(0, Math.min(ids.length - 1, idx + dir));
        const id = ids[nextIdx];
        if (id) st.selectLayer(id);
        return;
      }
      // Arrow keys nudge the selected frame instance on the canvas.
      if (!modifier && !typing && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const st = useEditorStore.getState();
        let id = st.activeFrameInstanceId;
        if (!id && st.scene.frameInstances.length > 0) {
          id = st.scene.frameInstances[0]!.id;
          st.selectFrameInstance(id);
        }
        const inst = st.scene.frameInstances.find((fi) => fi.id === id);
        if (!inst) return;
        const step = event.shiftKey ? 0.05 : 0.01;
        const dirs: Record<string, [number, number]> = {
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0]
        };
        const [dx, dy] = dirs[event.key] ?? [0, 0];
        const x = Math.max(0, Math.min(1, inst.x + dx));
        const y = Math.max(0, Math.min(1, inst.y + dy));
        st.updateFrameInstance(id!, { x, y });
        return;
      }
      if (event.key.toLowerCase() === "r" && !modifier) {
        if (typing) return;
        event.preventDefault();
        handleReset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow, handleReset, handleExportPng, handleExportMp4, handleExportGif, handleCopyPng, setShortcutsOpen, setCommandPaletteOpen]);

  return (
    <main className="editor-shell">
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
              <div className="export-status">
                <span className="label">{videoExportStatus}</span>
                <div className="progress">
                  <div style={{ width: `${videoExportProgress}%` }} />
                </div>
                <span className="pct">{Math.round(videoExportProgress)}%</span>
              </div>
            ) : null}
            {gifExportStatus ? (
              <div className="export-status">
                <span className="label">{gifExportStatus}</span>
                <div className="progress">
                  <div style={{ width: `${gifExportProgress}%` }} />
                </div>
                <span className="pct">{Math.round(gifExportProgress)}%</span>
              </div>
            ) : null}
            {copyStatus ? (
              <span className="status saved">{copyStatus}</span>
            ) : exportError ? (
              <span className="error" role="alert">
                {exportError}
              </span>
            ) : saveError ? (
              <span className="error" role="alert" title={saveError}>
                {saveError}
              </span>
            ) : (
              <span className={`status${saved ? " saved" : ""}`}>{saved ? t("editor.saved") : t("editor.unsaved")}</span>
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
        onExport={handleExport}
        onCopy={handleCopyFromDialog}
        busy={isExporting}
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