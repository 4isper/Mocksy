"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import type { Annotation, EditorScene, MediaLayer, MockupFrame } from "@/lib/types/editor";
import { buildSceneCss } from "@/lib/render/mockupRenderer";
import { getFrameSpec, SVG_VIEWBOX_HEIGHT, SVG_VIEWBOX_WIDTH } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { sampleVideoTransform } from "@/lib/render/videoComposer";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { extractPalette } from "@/lib/media/palette";
import { useTranslations } from "next-intl";
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
  useEffect(() => {
    layerRef.current = layer;
  });
  const animates = !!layer && layer.animationPreset !== "none";

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const apply = (zoom: number, x: number, y: number) => {
      el.style.setProperty("transform", `scale(${zoom}) translate(${x * 2}px, ${y * 2}px)`);
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

interface AnnotationItemProps {
  annotation: Annotation;
  selected: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
}

/**
 * One annotation overlay in the live preview. Coordinates are fractions of the
 * canvas, so the element is positioned with percentages and the SVG arrow is
 * drawn at measured pixel size (read from the canvas after layout) so its
 * stroke width and arrowhead match the exported PNG exactly.
 */
function AnnotationItem({ annotation, selected, canvasRef, onSelect, onUpdate }: AnnotationItemProps) {
  const t = useTranslations();
  const moveRef = useRef<{ x: number; y: number; ax: number; ay: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; aw: number; ah: number } | null>(null);
  // Measured canvas size, captured after layout so the arrow renders at the
  // correct pixel scale on first paint (the ref is null during the initial
  // render, before the canvas has been laid out).
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) setSize({ w: canvas.clientWidth, h: canvas.clientHeight });
  }, [canvasRef, annotation.x, annotation.y, annotation.w, annotation.h, annotation.type]);

  const onBodyDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect(annotation.id);
    const canvas = canvasRef.current;
    if (!canvas) return;
    moveRef.current = { x: e.clientX, y: e.clientY, ax: annotation.x, ay: annotation.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBodyMove = (e: React.PointerEvent) => {
    const m = moveRef.current;
    const canvas = canvasRef.current;
    if (!m || !canvas) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const nx = Math.max(-1, Math.min(2, m.ax + (e.clientX - m.x) / w));
    const ny = Math.max(-1, Math.min(2, m.ay + (e.clientY - m.y) / h));
    onUpdate(annotation.id, { x: nx, y: ny });
  };
  const onBodyUp = (e: React.PointerEvent) => {
    moveRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeRef.current = { x: e.clientX, y: e.clientY, aw: annotation.w, ah: annotation.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    const canvas = canvasRef.current;
    if (!r || !canvas) return;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const nw = Math.max(-2, Math.min(2, r.aw + (e.clientX - r.x) / w));
    const nh = Math.max(-2, Math.min(2, r.ah + (e.clientY - r.y) / h));
    onUpdate(annotation.id, { w: nw, h: nh });
  };
  const onResizeUp = (e: React.PointerEvent) => {
    resizeRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const bx = Math.min(annotation.x, annotation.x + annotation.w);
  const by = Math.min(annotation.y, annotation.y + annotation.h);
  const bw = Math.abs(annotation.w) || 1e-4;
  const bh = Math.abs(annotation.h) || 1e-4;

  const boxStyle: CSSProperties = {
    position: "absolute",
    left: `${bx * 100}%`,
    top: `${by * 100}%`,
    width: `${bw * 100}%`,
    height: annotation.type === "text" ? "auto" : `${bh * 100}%`,
    cursor: "move",
    touchAction: "none",
    outline: selected ? "1px solid var(--accent)" : "1px dashed transparent",
    outlineOffset: 2,
    zIndex: 2
  };

  let content: ReactNode = null;
  if (annotation.type === "text") {
    content = (
      <div
        style={{
          fontSize: annotation.fontSize,
          color: annotation.color,
          lineHeight: 1.2,
          fontWeight: 600,
          whiteSpace: "pre-wrap",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)"
        }}
      >
        {annotation.text}
      </div>
    );
  } else if (annotation.type === "rect") {
    content = (
      <div
        style={{
          width: "100%",
          height: "100%",
          border: `${annotation.strokeWidth}px solid ${annotation.color}`,
          borderRadius: 4,
          boxSizing: "border-box"
        }}
      />
    );
  } else {
    const cw = size.w || 1;
    const ch = size.h || 1;
    const startX = (annotation.x - bx) * cw;
    const startY = (annotation.y - by) * ch;
    const endX = startX + annotation.w * cw;
    const endY = startY + annotation.h * ch;
    const angle = Math.atan2(endY - startY, endX - startX);
    const head = 14;
    const a1 = angle + Math.PI - 0.45;
    const a2 = angle + Math.PI + 0.45;
    content = (
      <svg width={bw * cw} height={bh * ch} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={annotation.color} strokeWidth={annotation.strokeWidth} strokeLinecap="round" />
        <polygon points={`${endX},${endY} ${endX + head * Math.cos(a1)},${endY + head * Math.sin(a1)} ${endX + head * Math.cos(a2)},${endY + head * Math.sin(a2)}`} fill={annotation.color} />
      </svg>
    );
  }

  return (
    <div style={boxStyle} onPointerDown={onBodyDown} onPointerMove={onBodyMove} onPointerUp={onBodyUp} onPointerCancel={onBodyUp}>
      {content}
      {selected ? (
        <span
          aria-label={t("editor.resizeAnnotation")}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
          style={{
            position: "absolute",
            right: -6,
            bottom: -6,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "2px solid #07070a",
            cursor: "nwse-resize",
            touchAction: "none"
          }}
        />
      ) : null}
    </div>
  );
}

interface PreviewCanvasProps {
  scene: EditorScene;
}

export function PreviewCanvas({ scene }: PreviewCanvasProps) {
  const t = useTranslations();
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
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);

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
  const canvasRef = useRef<HTMLDivElement>(null);
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

  // Drag-to-pan the active media inside the frame, mirroring the Position
  // X/Y sliders. Pointer events cover mouse and single-finger touch; a
  // two-finger touch is claimed by the pinch-zoom handler instead. The
  // frame's offsetWidth is its untransformed layout size, so the delta
  // maps cleanly onto the CSS object-position basis the sliders drive.
  const panState = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);
  const canPan = !!activeLayer?.mediaUrl;
  const onPanDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Let the Clear button and watermark keep their own click behavior.
    if (target.closest("button") || target.closest(".preview-watermark")) return;
    if (!activeLayer?.mediaUrl) return;
    panState.current = {
      x: e.clientX,
      y: e.clientY,
      offX: activeLayer.mediaOffsetX,
      offY: activeLayer.mediaOffsetY
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPanMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = panState.current;
    const el = frameRef.current;
    if (!s || !el) return;
    const w = el.offsetWidth || 1;
    const h = el.offsetHeight || 1;
    const nx = Math.max(-1, Math.min(1, s.offX + ((e.clientX - s.x) / w) * 2));
    const ny = Math.max(-1, Math.min(1, s.offY + ((e.clientY - s.y) / h) * 2));
    const st = useEditorStore.getState();
    st.setMediaOffsetX(nx);
    st.setMediaOffsetY(ny);
  };
  const onPanUp = (e: React.PointerEvent<HTMLDivElement>) => {
    panState.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
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
      setDropError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
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
        ref={canvasRef}
        onPointerDown={() => selectAnnotation(null)}
        style={{
          // Contain inside the size container: take the larger of the two
          // axes that still fits the other, so the canvas keeps its aspect
          // ratio instead of being stretched by a fixed 100% width.
          width: "min(100cqw, calc(100cqh * var(--canvas-ar-w) / var(--canvas-ar-h)))",
          height: "min(100cqh, calc(100cqw * var(--canvas-ar-h) / var(--canvas-ar-w)))",
          aspectRatio: scene.aspectRatio,
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          ...sceneCss.container
        }}
      >
        {sceneCss.backgroundImage ? (
          <div
            data-bg
            aria-hidden
            style={{
              position: "absolute",
              inset: -(sceneCss.backgroundBlur + 6),
              zIndex: 0,
              backgroundImage: `url("${sceneCss.backgroundImage}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: sceneCss.backgroundBlur > 0 ? `blur(${sceneCss.backgroundBlur}px)` : undefined,
              pointerEvents: "none"
            }}
          />
        ) : null}
        {scene.frameInstances.length > 0 && sceneCss.frameOverlay ? (
          // Multi-frame grid mode
          <>
            {scene.frameInstances.map((inst, i) => (
              <FrameInstanceItem
                key={inst.id}
                scene={scene}
                instance={inst}
                media={activeLayer?.mediaUrl ? null : null}
                overlay={sceneCss.frameOverlay}
                zIndex={1 + i}
              />
            ))}
            <div
              ref={frameRef}
              style={{ ...sceneCss.frame, zIndex: 1, pointerEvents: "none" }}
            >
              {scene.layers.filter((l) => !l.hidden).map((layer) => (
                layer.mediaUrl ? (
                  isVideoLayer(layer) ? (
                    <video key={layer.id} src={layer.mediaUrl} muted playsInline style={sceneCss.mediaStyle} />
                  ) : (
                    <img key={layer.id} src={layer.mediaUrl} alt="" style={sceneCss.mediaStyle} onLoad={() => setMediaLoading(false)} />
                  )
                ) : null
              ))}
            </div>
          </>
        ) : (
          // Single-frame mode (original)
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
                      onLoadedMetadata={(e) => {
                        const duration = e.currentTarget.duration || 0;
                        setVideoDuration(duration);
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
                      alt="Uploaded media"
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
              <div style={sceneCss.emptyMediaStyle}>Drop image or video to start</div>
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
        )}
        {scene.annotations.map((a) => (
          <AnnotationItem
            key={a.id}
            annotation={a}
            selected={a.id === selectedAnnotationId}
            canvasRef={canvasRef}
            onSelect={selectAnnotation}
            onUpdate={updateAnnotation}
          />
        ))}
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

/** Renders a single frame instance within a grid. */
function FrameInstanceItem({
  scene,
  instance,
  media,
  overlay,
  zIndex
}: {
  scene: EditorScene;
  instance: { id: string; frame: string; x: number; y: number; scale: number; layerId: string | null };
  media: CanvasImageSource | null;
  overlay: string | null;
  zIndex: number;
}) {
  const spec = getFrameSpec(instance.frame as MockupFrame);
  const frameAr = spec.aspectRatio ? Number(spec.aspectRatio.split("/")[0]) / Number(spec.aspectRatio.split("/")[1]) : 1;

  const mediaStyle: CSSProperties = spec.isOverlay && spec.cutout
    ? {
        position: "absolute",
        left: `${(spec.cutout.x / SVG_VIEWBOX_WIDTH) * 100}%`,
        top: `${(spec.cutout.y / SVG_VIEWBOX_HEIGHT) * 100}%`,
        width: `${(spec.cutout.w / SVG_VIEWBOX_WIDTH) * 100}%`,
        height: `${(spec.cutout.h / SVG_VIEWBOX_HEIGHT) * 100}%`,
        objectFit: "cover",
        borderRadius: `${(spec.cutout.rx / spec.cutout.w) * 100}% / ${(spec.cutout.rx / spec.cutout.h) * 100}%`,
        background: "#0a0a0a"
      }
    : {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        borderRadius: spec.screenRadius
      };

  return (
    <div
      style={{
        position: "absolute",
        left: `${instance.x * 100}%`,
        top: `${instance.y * 100}%`,
        width: `${instance.scale * 100}%`,
        height: "auto",
        transform: "translate(-50%, -50%)",
        aspectRatio: `${spec.aspectRatio ?? "9 / 16"}`
      }}
    >
      <div style={{ position: "relative", width: "100%" }}>
        {media ? (
          typeof media === "object" && "videoWidth" in media ? (
            <video src={String((media as { src?: string }).src)} muted playsInline style={mediaStyle} />
          ) : (
            <img src={String((media as { src?: string }).src)} alt="" style={mediaStyle} />
          )
        ) : (
          <div style={{ ...mediaStyle, background: "rgba(255,255,255,0.03)" }} />
        )}
        {overlay ? <img src={overlay} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} /> : null}
      </div>
    </div>
  );
}
