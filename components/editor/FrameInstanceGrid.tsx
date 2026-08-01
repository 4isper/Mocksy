"use client";

import { useRef, useCallback, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import type { SceneCss } from "@/lib/render/mockupRenderer";
import { useEditorStore } from "@/lib/state/editorStore";

import { snapToGrid } from "@/lib/render/grid";

interface FrameInstanceGridProps {
  scene: EditorScene;
  activeLayer: MediaLayer | undefined;
  frameInstanceCssMap: Map<string, SceneCss>;
  activeFrameInstanceId: string | null;
  selectFrameInstance: (id: string | null) => void;
  analyzeMedia: (el: HTMLImageElement | HTMLVideoElement) => void;
  setVideoDuration: (duration: number, layerId?: string) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Number of grid divisions for snap-to-grid; null disables snapping. */
  snapDivisions: number | null;
}

interface DragState {
  id: string;
  startX: number;
  startY: number;
  initialInstX: number;
  initialInstY: number;
  moved: boolean;
}

export function FrameInstanceGrid({
  scene,
  activeLayer,
  frameInstanceCssMap,
  activeFrameInstanceId,
  selectFrameInstance,
  analyzeMedia,
  setVideoDuration,
  canvasRef,
  snapDivisions
}: FrameInstanceGridProps) {
  const t = useTranslations();
  const updateFrameInstance = useEditorStore((s) => s.updateFrameInstance);
  const dragState = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect();
  }, [canvasRef]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, instId: string) => {
      const canvasRect = getCanvasRect();
      if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return;

      const inst = scene.frameInstances.find((fi) => fi.id === instId);
      if (!inst) return;

      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("video") || target.closest("button") || target.closest("input")) return;

      dragState.current = {
        id: instId,
        startX: e.clientX,
        startY: e.clientY,
        initialInstX: inst.x,
        initialInstY: inst.y,
        moved: false
      };
      selectFrameInstance(instId);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [getCanvasRect, scene.frameInstances, selectFrameInstance]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, instId: string) => {
      const ds = dragState.current;
      if (!ds || ds.id !== instId) return;

      const canvasRect = getCanvasRect();
      if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return;

      const dxPx = e.clientX - ds.startX;
      const dyPx = e.clientY - ds.startY;

      if (!ds.moved && (Math.abs(dxPx) > 3 || Math.abs(dyPx) > 3)) {
        ds.moved = true;
        setDraggingId(instId);
      }

      if (!ds.moved) return;

      const dx = dxPx / canvasRect.width;
      const dy = dyPx / canvasRect.height;

      let nextX = Math.max(0, Math.min(1, ds.initialInstX + dx));
      let nextY = Math.max(0, Math.min(1, ds.initialInstY + dy));

      // Snap to grid unless Shift is held (fine-control override)
      if (snapDivisions && !e.shiftKey) {
        nextX = snapToGrid(nextX, snapDivisions);
        nextY = snapToGrid(nextY, snapDivisions);
      }

      updateFrameInstance(ds.id, { x: nextX, y: nextY }, true);
    },
    [getCanvasRect, updateFrameInstance, snapDivisions]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>, instId: string) => {
    const ds = dragState.current;
    if (ds && ds.id === instId) {
      const didMove = ds.moved;
      dragState.current = null;
      setDraggingId((prev) => (prev === instId ? null : prev));
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
      // If it was just a click (no movement), select the frame instance
      if (!didMove) {
        selectFrameInstance(instId);
      }
    }
  }, [selectFrameInstance]);

  return (
    <>
      {scene.frameInstances.filter((inst) => {
        const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayer;
        return !layer?.hidden;
      }).map((inst) => {
        const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayer;
        const spec = getFrameSpec(inst.frame);
        const instCss = frameInstanceCssMap.get(inst.id)!;
        const zoom = layer?.zoom ?? 1;
        const offsetX = layer?.mediaOffsetX ?? 0;
        const offsetY = layer?.mediaOffsetY ?? 0;
        const zoomStyle = { transform: `scale(${zoom}) translate(${offsetX * 2}px, ${offsetY * 2}px)`, transformOrigin: "center" };
        return (
          <div
            key={inst.id}
            className="frame-instance"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectFrameInstance(inst.id);
              }
            }}
            onPointerDown={(e) => handlePointerDown(e, inst.id)}
            onPointerMove={(e) => handlePointerMove(e, inst.id)}
            onPointerUp={(e) => handlePointerUp(e, inst.id)}
            onPointerCancel={(e) => handlePointerUp(e, inst.id)}
            style={{
              position: "absolute",
              left: `${inst.x * 100}%`,
              top: `${inst.y * 100}%`,
              width: `${inst.scale * 100}%`,
              height: "auto",
              transform: "translate(-50%, -50%)",
              aspectRatio: spec.aspectRatio ?? (inst.frame === "watch" ? "1" : "9 / 16"),
              cursor: draggingId === inst.id ? "grabbing" : "grab",
              outline: activeFrameInstanceId === inst.id ? "2px solid var(--accent)" : undefined,
              outlineOffset: 4,
              borderRadius: 4,
              touchAction: "none"
            } as CSSProperties}
          >
            {spec.isOverlay ? (
              // Overlay frame: match single-frame structure so
              // drop-shadow and frame CSS (border, backdrop-filter)
              // are applied correctly.
              <div
                data-mockup-frame
                style={{
                  ...instCss.frame,
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  ...zoomStyle
                }}
              >
                {instCss.frameOverlay ? (
                  <img src={instCss.frameOverlay} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
                ) : null}
                {layer?.mediaUrl ? (
                  isVideoLayer(layer) ? (
                  <video
                    src={layer.mediaUrl}
                    muted
                    playsInline
                    controls
                    loop={layer.videoLoop}
                    autoPlay={layer.videoAutoplay}
                    crossOrigin="anonymous"
                    style={instCss.mediaStyle}
                    onLoadedData={(e) => analyzeMedia(e.currentTarget)}
                    onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || 0, layer.id)}
                  />
                  ) : (
                    <img src={layer.mediaUrl} alt={t("editor.uploadedMediaAlt")} style={instCss.mediaStyle} onLoad={(e) => analyzeMedia(e.currentTarget)} />
                  )
                ) : null}
              </div>
            ) : (
              // CSS frame: media fills frame with optional radius
              <div
                data-mockup-frame
                style={{
                  ...instCss.frame,
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  ...zoomStyle
                }}
              >
                {layer?.mediaUrl ? (
                  isVideoLayer(layer) ? (
                  <video
                    src={layer.mediaUrl}
                    muted
                    playsInline
                    controls
                    loop={layer.videoLoop}
                    autoPlay={layer.videoAutoplay}
                    crossOrigin="anonymous"
                    style={instCss.mediaStyle}
                    onLoadedData={(e) => analyzeMedia(e.currentTarget)}
                    onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || 0, layer.id)}
                  />
                  ) : (
                    <img src={layer.mediaUrl} alt={t("editor.uploadedMediaAlt")} style={instCss.mediaStyle} onLoad={(e) => analyzeMedia(e.currentTarget)} />
                  )
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
