"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { isVideoScene } from "@/lib/render/mediaKind";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { useEditorStore } from "@/lib/state/editorStore";

interface PreviewCanvasProps {
  scene: EditorScene;
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const sceneCss = useMemo(() => buildSceneCss(scene), [scene]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
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
    try {
      const { url, mediaType, mediaName } = loadMediaFromFile(file);
      setDropError(null);
      setMedia(url, mediaType, mediaName);
    } catch (err) {
      setDropError(err instanceof UnsupportedMediaError ? err.message : "Could not load that file.");
    }
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
                style={sceneCss.mediaStyle}
              />
            ) : (
              // Local blob/object URLs can't be optimized by next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={scene.mediaUrl} alt="Uploaded media" style={sceneCss.mediaStyle} />
            )
          ) : (
            <div style={sceneCss.emptyMediaStyle}>Drop image or video to start</div>
          )}
          {sceneCss.frameOverlay && (
            // Local static SVG device skins served from /public. The overlay sits
            // above the media but its screen cutout is transparent, so the media
            // (inset to the same cutout) shows through.
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
                pointerEvents: "none",
                ...sceneCss.overlayStyle
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
        {dropError ? (
          <div
            role="alert"
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
              right: 12,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(127,29,29,0.85)",
              color: "#fecaca",
              fontSize: 13
            }}
          >
            {dropError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
