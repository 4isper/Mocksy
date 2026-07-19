"use client";

import { useEffect, useMemo, useRef } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { useEditorStore } from "@/lib/state/editorStore";

interface PreviewCanvasProps {
  scene: EditorScene;
}

function isVideoMedia(scene: EditorScene) {
  if (scene.mediaType === "video") return true;
  return Boolean(scene.mediaName && /\.(mp4|mov|m4v|webm|ogg|ogv|avi|mkv)$/i.test(scene.mediaName));
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const sceneCss = useMemo(() => buildSceneCss(scene), [scene]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { setVideoDuration, setVideoCurrentTime } = useEditorStore();
  const useVideo = isVideoMedia(scene);

  useEffect(() => {
    if (!useVideo) return;
    const video = videoRef.current;
    if (!video) return;
    const delta = Math.abs(video.currentTime - scene.videoCurrentTime);
    if (delta > 0.05) video.currentTime = scene.videoCurrentTime;
  }, [useVideo, scene.videoCurrentTime]);

  return (
    <div className="panel" style={{ height: "100%", padding: 16 }}>
      <div
        id="preview-canvas"
        style={{
          width: "100%",
          aspectRatio: scene.aspectRatio,
          position: "relative",
          borderRadius: 12,
          ...sceneCss.container
        }}
      >
        <div style={sceneCss.frame} data-mockup-frame>
          {scene.mediaUrl ? (
            useVideo ? (
              <video
                ref={videoRef}
                src={scene.mediaUrl}
                muted={scene.videoMuted}
                loop={scene.videoLoop}
                autoPlay={scene.videoAutoplay}
                playsInline
                controls
                onLoadedMetadata={(e) => {
                  const duration = e.currentTarget.duration || 0;
                  setVideoDuration(duration);
                  const current = Math.min(scene.videoPosterTime, duration);
                  e.currentTarget.currentTime = current;
                  setVideoCurrentTime(current);
                }}
                onTimeUpdate={(e) => {
                  setVideoCurrentTime(e.currentTarget.currentTime);
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: scene.borderRadius,
                  background: "#0a0a0a"
                }}
              />
            ) : (
              <img
                src={scene.mediaUrl}
                alt="Uploaded media"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: scene.borderRadius
                }}
              />
            )
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: scene.borderRadius,
                display: "grid",
                placeItems: "center",
                color: "#a1a1aa",
                background: "rgba(255,255,255,0.03)"
              }}
            >
              Drop image or video to start
            </div>
          )}
        </div>
        {scene.watermarkEnabled && (
          <span style={{ position: "absolute", right: 16, bottom: 16, color: "rgba(255,255,255,0.8)" }}>
            {scene.watermarkText}
          </span>
        )}
      </div>
    </div>
  );
}
