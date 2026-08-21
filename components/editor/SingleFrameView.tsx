"use client";

import { useEffect, type ChangeEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { isVideoLayer } from "@/lib/render/mediaKind";
import type { SceneCss } from "@/lib/render/mockupRenderer";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";

interface SingleFrameViewProps {
  scene: EditorScene;
  sceneCss: SceneCss;
  canPan: boolean;
  frameRef: React.RefObject<HTMLDivElement | null>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onPanDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPanMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPanUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  analyzeMedia: (el: HTMLImageElement | HTMLVideoElement) => void;
  handleCanvasFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  canvasFileInputKey: number;
  isMediaLoading: boolean;
  setVideoDuration: (duration: number, layerId?: string) => void;
  setVideoCurrentTime: (time: number) => void;
  setMediaLoading: (loading: boolean) => void;
  selectLayer: (id: string) => void;
}

export function SingleFrameView({
  scene,
  sceneCss,
  canPan,
  frameRef,
  videoRef,
  onPanDown,
  onPanMove,
  onPanUp,
  analyzeMedia,
  handleCanvasFile,
  canvasFileInputKey,
  isMediaLoading,
  setVideoDuration,
  setVideoCurrentTime,
  setMediaLoading,
  selectLayer
}: SingleFrameViewProps) {
  const t = useTranslations();
  // Subscribe here (not in PreviewCanvas) so the whole preview tree — all
  // annotations, the watermark and the frame grid — doesn't re-render on every
  // video time tick. The seek mirrors the Timeline scrubber onto the <video>:
  // onTimeUpdate writes the time back to the store, so we only seek when the
  // delta is large enough to be a user scrub rather than playback echo.
  const videoCurrentTime = useEditorStore((s) => s.videoCurrentTime);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - videoCurrentTime) > 0.1) {
      try {
        video.currentTime = videoCurrentTime;
      } catch {
        // Seeking before metadata is ready can throw; ignore until it loads.
      }
    }
  }, [videoCurrentTime, videoRef]);
  return (
    <div
      ref={frameRef}
      style={{ ...sceneCss.frame, zIndex: 1, cursor: canPan ? "grab" : undefined, touchAction: canPan ? "none" : undefined }}
      data-mockup-frame
      onPointerDown={onPanDown}
      onPointerMove={onPanMove}
      onPointerUp={onPanUp}
      onPointerCancel={onPanUp}
    >
      {scene.layers
        .filter((layer) => !layer.hidden)
        .map((layer) =>
        layer.mediaUrl ? (
          isVideoLayer(layer) ? (
              <video
                key={layer.id}
                ref={videoRef}
                src={layer.mediaUrl}
                muted={layer.videoMuted}
                loop={layer.videoLoop}
                autoPlay={layer.videoAutoplay}
                playsInline
                controls
                crossOrigin="anonymous"
                style={{ ...sceneCss.mediaStyle, objectFit: "contain", backgroundColor: "var(--panel-solid)" }}
                onPointerDown={() => selectLayer(layer.id)}
                onLoadedMetadata={(e) => {
                  const duration = e.currentTarget.duration || 0;
                  setVideoDuration(duration, layer.id);
                  const current = Math.min(layer.videoPosterTime, duration);
                  e.currentTarget.currentTime = current;
                  setVideoCurrentTime(current);
                }}
                onTimeUpdate={(e) => {
                  const t = e.currentTarget.currentTime;
                  if (Math.abs(t - videoCurrentTime) >= 0.1) setVideoCurrentTime(t);
                }}
                onLoadedData={(ev) => {
                  setMediaLoading(false);
                  analyzeMedia(ev.currentTarget);
                }}
              />
            ) : (
              <img
                key={layer.id}
                src={layer.mediaUrl}
                alt={t("editor.uploadedMediaAlt")}
                style={sceneCss.mediaStyle}
                onPointerDown={() => selectLayer(layer.id)}
                onLoad={(e) => {
                  setMediaLoading(false);
                  analyzeMedia(e.currentTarget);
                }}
              />
            )
          ) : null
        )}
      {scene.layers.every((l) => !l.mediaUrl) ? (
        <label style={sceneCss.emptyMediaStyle}>
          <span>{t("editor.dropToStart")}</span>
          <input type="file" accept="image/*,video/*" onChange={handleCanvasFile} key={canvasFileInputKey} style={{ display: "none" }} />
        </label>
      ) : null}
      {sceneCss.screenChrome ? (
        <div
          aria-hidden
          style={sceneCss.screenChromeStyle}
          dangerouslySetInnerHTML={{ __html: sceneCss.screenChrome }}
        />
      ) : null}
      {sceneCss.frameOverlay && (
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
      {sceneCss.browserChrome && sceneCss.browserChromeStyle ? (
        <div
          aria-hidden
          style={sceneCss.browserChromeStyle}
          dangerouslySetInnerHTML={{ __html: sceneCss.browserChrome }}
        />
      ) : null}
      {isMediaLoading ? (
        <div className="media-loading" role="status" aria-busy="true" aria-label={t("editor.loadingMedia")}>
          <span className="spinner" />
        </div>
      ) : null}
    </div>
  );
}
