"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { AnnotationsPanel } from "@/components/editor/AnnotationsPanel";
import { CommandPalette, useCommands } from "@/components/editor/CommandPalette";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { exportImage, copyPngToClipboard } from "@/lib/export/exportImage";
import { sceneToShareUrl } from "@/lib/state/shareState";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { ProjectsPanel } from "@/components/editor/ProjectsPanel";
import { useThemeStore } from "@/lib/state/themeStore";
import { LocaleSwitcher } from "@/components/editor/LocaleSwitcher";

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
      setExportError(err instanceof Error ? err.message : "Could not create share link");
    }
  }, [scene]);

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
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
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
      if (event.key.toLowerCase() === "r" && !modifier) {
        if (typing) return;
        event.preventDefault();
        handleReset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, saveNow, handleReset, handleExportPng, handleExportMp4, handleExportGif, handleCopyPng, setShortcutsOpen, setCommandPaletteOpen]);

  return (
    <main className="editor-shell">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>Mocksy</h1>
        <span className="tag">{t("editor.tagline")}</span>
      </div>
      <div className="editor-grid">
        <ControlPanel />
        <section style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 12, minHeight: 0, overflow: "hidden" }}>
          <PreviewCanvas scene={scene} />
          <div className="panel toolbar">
            <button type="button" className="btn" onClick={undo} disabled={pastLength === 0} title={t("editor.undoTitle")}>
              {t("shortcuts.undo")}
            </button>
            <button type="button" className="btn" onClick={redo} disabled={futureLength === 0} title={t("editor.redoTitle")}>
              {t("shortcuts.redo")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isExporting}
              onClick={() => setExportOpen(true)}
              title={t("editor.exportTitle")}
            >
              {t("nav.export")}
            </button>
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
            <div className="segmented" style={{ marginRight: 8 }} role="group" aria-label={t("editor.themeLabel")}>
              <button
                type="button"
                className={themeMode === "light" ? "is-active" : ""}
                aria-pressed={themeMode === "light"}
                onClick={() => setThemeMode("light")}
                title={t("editor.lightTheme")}
              >
                ☀️
              </button>
              <button
                type="button"
                className={themeMode === "dark" ? "is-active" : ""}
                aria-pressed={themeMode === "dark"}
                onClick={() => setThemeMode("dark")}
                title={t("editor.darkTheme")}
              >
                🌙
              </button>
              <button
                type="button"
                className={themeMode === "system" ? "is-active" : ""}
                aria-pressed={themeMode === "system"}
                onClick={() => setThemeMode("system")}
                title={t("editor.systemTheme")}
              >
                💻
              </button>
            </div>
            <button type="button" className="btn" onClick={saveNow} title={t("editor.saveTitle")}>
              {t("shortcuts.save")}
            </button>
            <button type="button" className="btn" onClick={copyShareUrl} title={t("editor.shareTitle")}>
              {t("nav.share")}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setShortcutsOpen(true)}
              title={t("editor.shortcutsTitle")}
            >
              {t("nav.shortcuts")}
            </button>
            <button type="button" className="btn" onClick={handleReset} title={t("editor.resetBtnTitle")}>
              {t("editor.resetConfirm")}
            </button>
            <LocaleSwitcher />
          </div>
        </section>
        <TemplatesPanel />
        <ProjectsPanel />
        <LayersPanel />
        <AnnotationsPanel />
      </div>
      {confirmResetOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={cancelReset}>
          <div
            className="modal"
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