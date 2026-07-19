"use client";

import { useEffect } from "react";
import { useState } from "react";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { PreviewCanvas } from "@/components/editor/PreviewCanvas";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { useEditorStore } from "@/lib/state/editorStore";
import { exportImage } from "@/lib/export/exportImage";
import { exportVideo } from "@/lib/export/exportVideo";
import { readSceneFromUrl, sceneToShareUrl } from "@/lib/state/shareState";

export function EditorShell() {
  const { scene, setScene } = useEditorStore();
  const [videoExportStatus, setVideoExportStatus] = useState<string | null>(null);
  const [videoExportProgress, setVideoExportProgress] = useState<number>(0);

  useEffect(() => {
    const fromUrl = readSceneFromUrl();
    const fromLocal = window.localStorage.getItem("mocksy-scene");
    if (fromUrl) setScene(fromUrl);
    else if (fromLocal) setScene(JSON.parse(fromLocal));
  }, [setScene]);

  return (
    <main style={{ minHeight: "100dvh", display: "grid", gridTemplateColumns: "320px 1fr 280px", gap: 16, padding: 16 }}>
      <ControlPanel />
      <section style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 12 }}>
        <PreviewCanvas scene={scene} />
        <div className="panel" style={{ padding: 12, display: "flex", gap: 8 }}>
          <button type="button" onClick={() => exportImage(scene, "preview-canvas", "mocksy-export")}>
            Export PNG
          </button>
          <button
            type="button"
            disabled={videoExportStatus !== null}
            onClick={async () => {
              try {
                setVideoExportStatus("Starting...");
                setVideoExportProgress(0);
                await exportVideo(scene, setVideoExportStatus, setVideoExportProgress);
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
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem("mocksy-scene", JSON.stringify(scene));
            }}
          >
            Save
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
