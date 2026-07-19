"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { exportImage } from "@/lib/export/exportImage";
import { exportVideo } from "@/lib/export/exportVideo";
import { readSceneFromUrl, sceneToShareUrl } from "@/lib/state/shareState";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";

const AUTOSAVE_KEY = "mocksy-scene";
const AUTOSAVE_DELAY = 500;

export function EditorShell() {
  const { scene, setScene, resetScene, undo, redo } = useEditorStore();
  const pastLength = useEditorStore((s) => s.past.length);
  const futureLength = useEditorStore((s) => s.future.length);
  const [videoExportStatus, setVideoExportStatus] = useState<string | null>(null);
  const [videoExportProgress, setVideoExportProgress] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fromUrl = readSceneFromUrl();
    const fromLocal = window.localStorage.getItem(AUTOSAVE_KEY);
    if (fromUrl) setScene(fromUrl);
    else if (fromLocal) {
      try {
        setScene(normalizeScene(JSON.parse(fromLocal)));
      } catch {
        setScene({ mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME });
      }
    } else setScene({ mediaUrl: DEMO_MEDIA_URL, mediaType: "image", mediaName: DEMO_MEDIA_NAME });
  }, [setScene]);

  useEffect(() => {
    setSaved(false);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(scene));
      setSaved(true);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [scene]);

  const saveNow = useCallback(() => {
    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(scene));
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
      setVideoExportStatus("Starting...");
      setVideoExportProgress(0);
      await exportVideo(scene, setVideoExportStatus, setVideoExportProgress, setExportError);
    } finally {
      setTimeout(() => {
        setVideoExportStatus(null);
        setVideoExportProgress(0);
      }, 800);
    }
  }, [scene]);

  const handleReset = useCallback(() => {
    resetScene();
    setSaved(false);
  }, [resetScene]);

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
  }, [undo, redo, saveNow, handleExportPng, handleReset]);

  return (
    <main className="editor-shell">
      <div className="brand">
        <h1>Mocksy</h1>
        <span className="tag">Free mockup editor — no subscriptions</span>
      </div>
      <div className="editor-grid">
        <ControlPanel />
        <section style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 12 }}>
          <PreviewCanvas scene={scene} />
          <div className="panel toolbar">
            <button type="button" className="btn" onClick={undo} disabled={pastLength === 0} title="Undo (⌘Z)">
              Undo
            </button>
            <button type="button" className="btn" onClick={redo} disabled={futureLength === 0} title="Redo (⇧⌘Z)">
              Redo
            </button>
            <button type="button" className="btn btn-primary" onClick={handleExportPng} title="Export PNG (⌘E)">
              Export PNG
            </button>
            <button
              type="button"
              className="btn"
              disabled={videoExportStatus !== null}
              onClick={handleExportMp4}
              title="Export MP4"
            >
              Export MP4
            </button>
            {videoExportStatus ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 160 }}>
                <span style={{ flex: 1, minWidth: 0 }}>{videoExportStatus}</span>
                <div
                  style={{
                    width: 100,
                    height: 6,
                    backgroundColor: "rgba(255,255,255,0.1)",
                    borderRadius: 3,
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${videoExportProgress}%`,
                      backgroundColor: "var(--accent)",
                      transition: "width 0.2s ease"
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, minWidth: 32 }}>{Math.round(videoExportProgress)}%</span>
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
      </div>
    </main>
  );
}
