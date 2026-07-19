"use client";

import { useEffect, useRef, useState } from "react";
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
  const { scene, setScene } = useEditorStore();
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

  return (
    <main style={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: "320px 1fr 280px", gap: 16, padding: 16 }}>
      <ControlPanel />
      <section style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 12 }}>
        <PreviewCanvas scene={scene} />
        <div className="panel" style={{ padding: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={() => {
            setExportError(null);
            exportImage(scene, "preview-canvas", "mocksy-export", setExportError);
          }}>
            Export PNG
          </button>
          <button
            type="button"
            disabled={videoExportStatus !== null}
            onClick={async () => {
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
            }}
          >
            Export MP4
          </button>
          {videoExportStatus ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
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
                    backgroundColor: "#00d9ff",
                    transition: "width 0.2s ease"
                  }}
                />
              </div>
              <span style={{ fontSize: 12, minWidth: 32 }}>{Math.round(videoExportProgress)}%</span>
            </div>
          ) : null}
          {exportError ? (
            <span style={{ color: "#f87171", fontSize: 13, flex: 1, minWidth: 0 }} role="alert">
              {exportError}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", minWidth: 48 }}>
              {saved ? "Saved" : "Editing…"}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(scene));
              setSaved(true);
            }}
          >
            Save now
          </button>
          <button
            type="button"
            onClick={async () => {
              const url = sceneToShareUrl(scene);
              await navigator.clipboard.writeText(url);
            }}
          >
            Copy Share URL
          </button>
        </div>
      </section>
      <TemplatesPanel />
    </main>
  );
}
