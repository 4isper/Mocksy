"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { extractPalette } from "@/lib/media/palette";
import { useEditorStore } from "@/lib/state/editorStore";

/** Duration of one animation loop in the preview, matching the video export. */
const ANIMATION_DURATION_MS = 3000;

/**
 * Drives the frame's zoomIn/zoomOut/parallax in the live preview by writing
 * the transform straight to the frame DOM via rAF — no React re-render per
 * frame, and buildSceneCss (the expensive part) is untouched. The sampled
 * transform mirrors sampleVideoTransform used by the video export, so what you
 * see previews what you export. Zoom/animation scale the whole mockup (device
 * + media together), matching the export where the frame box is multiplied by
 * the zoom.
 */
function useFrameTransform(node: React.RefObject<HTMLDivElement | null>, layer: MediaLayer | undefined) {
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const animates = !!layer && layer.animationPreset !== "none";

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const apply = (zoom: number, x: number, y: number) => {
      el.style.transform = `scale(${zoom}) translate(${x * 2}px, ${y * 2}px)`;
    };
    if (!animates) {
      const base = sampleVideoTransform(layerRef.current ?? ({} as MediaLayer), 0);
      apply(base.zoom, base.x, base.y);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const progress = ((performance.now() - start) % ANIMATION_DURATION_MS) / ANIMATION_DURATION_MS;
      const { zoom, x, y } = sampleVideoTransform(layerRef.current ?? ({} as MediaLayer), progress);
      apply(zoom, x, y);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Re-seed when the preset, zoom, or pan changes so the static branch
    // re-applies, and the rAF loop picks up fresh values.
  }, [node, animates, layer?.animationPreset, layer?.zoom, layer?.mediaOffsetX, layer?.mediaOffsetY]);
}

interface PreviewCanvasProps {
  scene: EditorScene;
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const sceneCss = useMemo(() => buildSceneCss(scene), [scene]);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const setMedia = useEditorStore((s) => s.setMedia);
  const addLayer = useEditorStore((s) => s.addLayer);
  const setVideoDuration = useEditorStore((s) => s.setVideoDuration);
  const setVideoCurrentTime = useEditorStore((s) => s.setVideoCurrentTime);
  const videoCurrentTime = useEditorStore((s) => s.videoCurrentTime);
  const isMediaLoading = useEditorStore((s) => s.isMediaLoading);
  const setMediaLoading = useEditorStore((s) => s.setMediaLoading);
  const setScenePalette = useEditorStore((s) => s.setScenePalette);

  // Sample the active layer's media for a dominant-color palette once it has
  // decoded, so the "match background" control can suggest a gradient. Runs
  // whenever the active layer's media changes; failures (e.g. tainted
  // cross-origin video) are swallowed so the rest of the preview still works.
  const analyzeMedia = (el: HTMLImageElement | HTMLVideoElement) => {
    try {
      const { colors } = extractPalette(el, 5);
      setScenePalette(colors.length ? colors : null);
    } catch {
      setScenePalette(null);
    }
  };

  // When the active layer changes (e.g. via the layers panel), recompute the
  // palette from that layer's media already in the DOM — the onLoad hook only
  // fires on a fresh decode, so switching layers would otherwise keep the
  // previous layer's palette. Skips while the new layer is still loading.
  useEffect(() => {
    const frame = document.querySelector<HTMLElement>("[data-mockup-frame]");
    if (!frame) return;
    const el = frame.querySelector<HTMLImageElement | HTMLVideoElement>("img, video");
    if (!el) {
      setScenePalette(null);
      return;
    }
    const ready = el instanceof HTMLVideoElement ? el.readyState >= 2 : el.complete && el.naturalWidth > 0;
    if (ready) analyzeMedia(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.activeLayerId]);
  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];

  // The whole-mockup zoom/animation is applied to the frame container so the
  // device skin and media scale together, matching the export.
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useFrameTransform(frameRef, activeLayer);

  // Mirror the Timeline scrubber (driven by VideoOptions) onto the actual
  // <video>. The onTimeUpdate handler also writes videoCurrentTime back to the
  // store, so we only seek when the change is large enough to be a user scrub
  // rather than playback echo — otherwise we'd fight the playing video.
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
  }, [videoCurrentTime]);

  // Pinch-to-zoom on touch devices: track the two-finger distance and map it
  // to the active layer zoom so mobile users can scale the mockup without a slider.
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && activeLayer) {
      const a = e.touches[0];
      const b = e.touches[1];
      if (!a || !b) return;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      pinchStart.current = { dist: Math.hypot(dx, dy), zoom: activeLayer.zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || !pinchStart.current || !activeLayer) return;
    e.preventDefault();
    const a = e.touches[0];
    const b = e.touches[1];
    if (!a || !b) return;
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    const dist = Math.hypot(dx, dy);
    const next = Math.min(1.5, Math.max(0.8, pinchStart.current.zoom * (dist / pinchStart.current.dist)));
    useEditorStore.getState().setZoom(next);
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) pinchStart.current = null;
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setDropError(null);
      // Drop adds a new layer on top of the stack.
      addLayer(url, mediaType, mediaName);
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
        // Let the component own pinch gestures instead of the browser zooming
        // the whole page when two fingers land on the preview.
        touchAction: "none",
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
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
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
        <div ref={frameRef} style={sceneCss.frame} data-mockup-frame>
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
                    onLoadedMetadata={(e) => {
                      const duration = e.currentTarget.duration || 0;
                      setVideoDuration(duration);
                      const current = Math.min(layer.videoPosterTime, duration);
                      e.currentTarget.currentTime = current;
                      setVideoCurrentTime(current);
                    }}
                    onTimeUpdate={(e) => {
                      // Throttle store writes to ~10fps: playback scrubbing doesn't
                      // need per-frame precision and the store update re-renders
                      // every component subscribed to videoCurrentTime.
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
                  // Local blob/object URLs can't be optimized by next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={layer.id}
                    src={layer.mediaUrl}
                    alt="Uploaded media"
                    style={sceneCss.mediaStyle}
                    onLoad={(e) => {
                      setMediaLoading(false);
                      analyzeMedia(e.currentTarget);
                    }}
                  />
                )
              )
            : null
          )}
          {scene.layers.every((l) => !l.mediaUrl) ? (
            <div style={sceneCss.emptyMediaStyle}>Drop image or video to start</div>
          ) : null}
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
          {isMediaLoading ? (
            <div className="media-loading" role="status" aria-busy="true" aria-label="Loading media">
              <span className="spinner" />
            </div>
          ) : null}
        </div>
        {scene.watermarkEnabled && (
          <span
            className="preview-watermark"
            style={{
              ...(scene.watermarkPosition === "bottom-left" || scene.watermarkPosition === "top-left"
                ? { left: 16 }
                : { right: 16 }),
              ...(scene.watermarkPosition === "top-left" || scene.watermarkPosition === "top-right"
                ? { top: 16 }
                : { bottom: 16 }),
              fontSize: scene.watermarkSize
            }}
          >
            {scene.watermarkText}
          </span>
        )}
        {activeLayer ? (
          <button type="button" className="preview-chip" onClick={() => setMedia(null, "none", null)}>
            Clear media
          </button>
        ) : null}
        {dropError ? (
          <div role="alert" className="preview-error">
            {dropError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
