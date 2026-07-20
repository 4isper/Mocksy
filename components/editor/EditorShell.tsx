"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { exportImage } from "@/lib/export/exportImage";
import { exportGif } from "@/lib/export/exportVideo";
import { sceneToShareUrl } from "@/lib/state/shareState";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { ProjectsPanel } from "@/components/editor/ProjectsPanel";

const AUTOSAVE_DELAY = 500;

export function EditorShell() {
  const scene = useEditorStore((s) => s.scene);
  const setScene = useEditorStore((s) => s.setScene);
  const resetScene = useEditorStore((s) => s.resetScene);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const pastLength = useEditorStore((s) => s.past.length);
  const futureLength = useEditorStore((s) => s.future.length);
  const [videoExportStatus, setVideoExportStatus] = useState<string | null>(null);
  const [videoExportProgress, setVideoExportProgress] = useState<number>(0);
  const [gifExportStatus, setGifExportStatus] = useState<string | null>(null);
  const [gifExportProgress, setGifExportProgress] = useState<number>(0);
  const isExporting = videoExportStatus !== null || gifExportStatus !== null;
  const [exportError, setExportError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Bootstrap from projects (URL share, localStorage, or a fresh demo). The
    // restored scene is not a user edit, so don't push it onto the undo stack
    // (also keeps StrictMode's double-mount from recording a duplicate entry).
    const restored = useProjectsStore.getState().hydrate();
    setScene(restored, false);
  }, [setScene]);

  useEffect(() => {
    setSaved(false);
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

  const saveNow = useCallback(() => {
    useProjectsStore.getState().updateActiveProjectScene(scene);
    setSaved(true);
  }, [scene]);

  const copyShareUrl = useCallback(async () => {
    const url = sceneToShareUrl(scene);
    await navigator.clipboard.writeText(url);
  }, [scene]);

  const handleExportPng = useCallback(() => {
    setExportError(null);
    exportImage(scene, "preview-canvas", "mocksy-export", setExportError);
  }, [scene]);

  const handleExportMp4 = useCallback(async () => {
    setExportError(null);
    try {
      setVideoExportStatus("Exporting video…");
      setVideoExportProgress(0);
      // Loaded lazily so the 32MB FFmpeg WASM bundle stays out of the editor's
      // main chunk and only downloads when the user actually exports an MP4.
      const { exportVideo } = await import("@/lib/export/exportVideo");
      await exportVideo(scene, setVideoExportStatus, setVideoExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setVideoExportStatus(null);
        setVideoExportProgress(0);
      }, 800);
    }
  }, [scene]);

  const handleExportGif = useCallback(async () => {
    setExportError(null);
    try {
      setGifExportStatus("Exporting GIF…");
      setGifExportProgress(0);
      // Reuse the lazily-loaded FFmpeg module already imported for MP4.
      const { exportGif } = await import("@/lib/export/exportVideo");
      await exportGif(scene, setGifExportStatus, setGifExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setGifExportStatus(null);
        setGifExportProgress(0);
      }, 800);
    }
  }, [scene]);

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
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
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
      if (modifier && event.key.toLowerCase() === "e") {
        event.preventDefault();
        handleExportPng();
        return;
      }
      if (event.key.toLowerCase() === "r" && !modifier) {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
        event.preventDefault();
        handleReset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, saveNow, handleReset]);

  return (
    <main className="editor-shell">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>Mocksy</h1>
        <span className="tag">Free mockup editor — no subscriptions</span>
      </div>
      <div className="editor-grid">
        <ControlPanel />
        <section style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 12, minHeight: 0, overflow: "hidden" }}>
          <PreviewCanvas scene={scene} />
          <div className="panel toolbar">
            <button type="button" className="btn" onClick={undo} disabled={pastLength === 0} title="Undo (⌘Z)">
              Undo
            </button>
            <button type="button" className="btn" onClick={redo} disabled={futureLength === 0} title="Redo (⇧⌘Z)">
              Redo
            </button>
            <button type="button" className="btn btn-primary" onClick={handleExportPng} title="Export PNG">
              Export PNG
            </button>
            <button
              type="button"
              className="btn"
              disabled={isExporting}
              onClick={handleExportMp4}
              title="Export MP4"
            >
              Export MP4
            </button>
            <button
              type="button"
              className="btn"
              disabled={isExporting}
              onClick={handleExportGif}
              title="Export GIF"
            >
              Export GIF
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
            {exportError ? (
              <span className="error" role="alert">
                {exportError}
              </span>
            ) : (
              <span className={`status${saved ? " saved" : ""}`}>{saved ? "Saved" : "Editing…"}</span>
            )}
            <span className="spacer" />
            <button type="button" className="btn" onClick={saveNow} title="Save (⌘S)">
              Save
            </button>
            <button type="button" className="btn" onClick={copyShareUrl} title="Copy Share URL">
              Share
            </button>
            <button type="button" className="btn" onClick={handleReset} title="Reset (R)">
              Reset
            </button>
          </div>
        </section>
        <TemplatesPanel />
        <ProjectsPanel />
        <LayersPanel />
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
            <h3 id="reset-title">Reset editor?</h3>
            <p id="reset-desc">This clears the current mockup and returns to the default scene. You can undo afterwards.</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={cancelReset} autoFocus>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmReset}>
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
