"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { isVideoScene } from "@/lib/render/mediaKind";
import { loadMediaFromFile } from "@/lib/media/loadFile";
import { useEditorStore } from "@/lib/state/editorStore";

interface PreviewCanvasProps {
  scene: EditorScene;
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const sceneCss = useMemo(() => buildSceneCss(scene), [scene]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const { setMedia, setVideoDuration, setVideoCurrentTime } = useEditorStore();
  const useVideo = isVideoScene(scene);

  useEffect(() => {
    if (!useVideo) return;
    const video = videoRef.current;
    if (!video) return;
    const delta = Math.abs(video.currentTime - scene.videoCurrentTime);
    if (delta > 0.05) video.currentTime = scene.videoCurrentTime;
  }, [useVideo, scene.videoCurrentTime]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const { url, mediaType, mediaName } = loadMediaFromFile(file);
    setMedia(url, mediaType, mediaName);
  };

  return (
    <div
      className="panel"
      style={{ height: "100%", padding: 16, outline: isDragging ? "2px dashed #00d9ff" : "2px dashed transparent" }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
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
                  borderRadius: sceneCss.screenRadius,
                  background: "#0a0a0a"
                }}
              />
            ) : (
              // Local blob/object URLs can't be optimized by next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={scene.mediaUrl}
                alt="Uploaded media"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: sceneCss.screenRadius
                }}
              />
            )
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: sceneCss.screenRadius,
                display: "grid",
                placeItems: "center",
                color: "#a1a1aa",
                background: "rgba(255,255,255,0.03)"
              }}
            >
              Drop image or video to start
            </div>
          )}
          {sceneCss.frameOverlay && (
            // Local static SVG device skins served from /public.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sceneCss.frameOverlay}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none"
              }}
            />
          )}
        </div>
        {scene.watermarkEnabled && (
          <span style={{ position: "absolute", right: 16, bottom: 16, color: "rgba(255,255,255,0.8)" }}>
            {scene.watermarkText}
          </span>
        )}
        {scene.mediaUrl && (
          <button
            type="button"
            onClick={() => setMedia(null, "none")}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid #27272a",
              background: "rgba(17,17,20,0.8)",
              color: "#f4f4f5",
              cursor: "pointer"
            }}
          >
            Clear media
          </button>
        )}
      </div>
    </div>
  );
}
