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
  const setMedia = useEditorStore((s) => s.setMedia);
  const setVideoDuration = useEditorStore((s) => s.setVideoDuration);
  const setVideoCurrentTime = useEditorStore((s) => s.setVideoCurrentTime);
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

  const [arW, arH] = scene.aspectRatio.split("/").map((n) => Number(n.trim()));

  return (
    <div
      className="panel"
      style={{
        height: "100%",
        minHeight: 0,
        padding: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Establish a size container so the canvas can size itself with
        // container query units, fitting inside both axes without distortion.
        containerType: "size",
        ["--canvas-ar-w" as string]: arW,
        ["--canvas-ar-h" as string]: arH,
        outline: isDragging ? "2px dashed #00d9ff" : "2px dashed transparent"
      }}
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
          // Contain inside the size container: take the larger of the two
          // axes that still fits the other, so the canvas keeps its aspect
          // ratio instead of being stretched by a fixed 100% width.
          width: "min(100cqw, calc(100cqh * var(--canvas-ar-w) / var(--canvas-ar-h)))",
          height: "min(100cqh, calc(100cqw * var(--canvas-ar-h) / var(--canvas-ar-w)))",
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
                  // Throttle store writes to ~10fps: playback scrubbing doesn't
                  // need per-frame precision and the store update re-renders
                  // every component subscribed to scene.
                  const t = e.currentTarget.currentTime;
                  if (Math.abs(t - scene.videoCurrentTime) >= 0.1) setVideoCurrentTime(t);
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
        {scene.watermarkEnabled && <span className="preview-watermark">{scene.watermarkText}</span>}
        {scene.mediaUrl && (
          <button type="button" className="preview-chip" onClick={() => setMedia(null, "none")}>
            Clear media
          </button>
        )}
        {dropError ? (
          <div role="alert" className="preview-error">
            {dropError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
