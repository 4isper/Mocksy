"use client";

import type { ChangeEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { isVideoLayer } from "@/lib/render/mediaKind";
import type { SceneCss } from "@/lib/render/mockupRenderer";
import { useTranslations } from "next-intl";

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
  videoCurrentTime: number;
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
  videoCurrentTime
}: SingleFrameViewProps) {
  const t = useTranslations();
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
                style={sceneCss.mediaStyle}
              />
            ) : (
              <img
                key={layer.id}
                src={layer.mediaUrl}
                alt={t("editor.uploadedMediaAlt")}
                style={sceneCss.mediaStyle}
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
      {isMediaLoading ? (
        <div className="media-loading" role="status" aria-busy="true" aria-label={t("editor.loadingMedia")}>
          <span className="spinner" />
        </div>
      ) : null}
    </div>
  );
}
