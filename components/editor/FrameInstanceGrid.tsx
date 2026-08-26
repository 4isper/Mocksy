"use client";

import { useRef, useCallback, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { EditorScene, FrameInstance, MediaLayer } from "@/lib/types/editor";
import { frameInstanceHalfExtents, frameInstAr, getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { buildTextLayerSvg, isTextLayer } from "@/lib/render/layerText";
import { buildEntranceAnimationCss, buildEntranceKeyframesStyle, type SceneCss } from "@/lib/render/mockupRenderer";
import { useEditorStore } from "@/lib/state/editorStore";
import { resolveZoomScale } from "@/lib/render/previewViewport";
import { snapToGrid } from "@/lib/render/grid";
import { snapCenteredBox, type GuideLine, type NormBox } from "@/lib/render/annotationAlign";
import { tiltCss } from "@/lib/render/tilt";
import { FrameContent } from "@/components/editor/FrameContent";

interface FrameInstanceGridProps {
  scene: EditorScene;
  activeLayer: MediaLayer | undefined;
  frameInstanceCssMap: Map<string, SceneCss>;
  activeFrameInstanceId: string | null;
  selectFrameInstance: (id: string | null) => void;
  analyzeMedia: (el: HTMLImageElement | HTMLVideoElement) => void;
  setVideoDuration: (duration: number, layerId?: string) => void;
  /** Clears the store's media-loading flag once uploaded media decodes; the
   *  grid renders uploads just like SingleFrameView, so it must reset the
   *  flag the same way or the layers panel keeps its loading skeleton. */
  setMediaLoading: (loading: boolean) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  snapDivisions: number | null;
  /** Smart-guide lines to draw while dragging (canvas fractions). */
  onGuides?: (guides: GuideLine[]) => void;
}

interface DragState {
  id: string;
  startX: number;
  startY: number;
  initialInstX: number;
  initialInstY: number;
  /** View zoom captured at drag start: pointer deltas arrive in screen
   *  pixels, which the zoom layer scales, so they must be divided back down
   *  to canvas pixels for the fraction math below. */
  viewScale: number;
  moved: boolean;
}

interface ResizeState {
  id: string;
  startX: number;
  startY: number;
  initialScale: number;
  /** Same screen↔canvas compensation as DragState.viewScale. */
  viewScale: number;
}

export function FrameInstanceGrid({
  scene,
  activeLayer,
  frameInstanceCssMap,
  activeFrameInstanceId,
  selectFrameInstance,
  analyzeMedia,
  setVideoDuration,
  setMediaLoading,
  canvasRef,
  snapDivisions,
  onGuides
}: FrameInstanceGridProps) {
  const t = useTranslations();
  const updateFrameInstance = useEditorStore((s) => s.updateFrameInstance);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const dragState = useRef<DragState | null>(null);
  const resizeState = useRef<ResizeState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);

  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect();
  }, [canvasRef]);

  /** Normalized box of a sibling instance, in the same canvas fractions the
   *  renderer uses (see computeFrameInstances) so guides align with what is
   *  drawn. */
  const instanceBox = useCallback(
    (inst: FrameInstance): NormBox => {
      const half = frameInstanceHalfExtents(inst, scene.customFrame, scene.aspectRatio);
      return {
        id: inst.id,
        left: inst.x - half.w,
        top: inst.y - half.h,
        right: inst.x + half.w,
        bottom: inst.y + half.h,
        cx: inst.x,
        cy: inst.y
      };
    },
    [scene.customFrame, scene.aspectRatio]
  );

  // ═══ Move ═════════════════════════════════════════════
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, instId: string) => {
      const canvasRect = getCanvasRect();
      if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return;

      const inst = scene.frameInstances.find((fi) => fi.id === instId);
      if (!inst) return;

      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Buttons/inputs (resize handle, media controls) keep their own behavior;
      // selecting the frame still happens so the device is highlighted. Video
      // elements are excluded from starting a *drag* (so their controls stay
      // usable) but still select the device on click.
      if (target.closest("button") || target.closest("input")) return;
      const onVideo = !!target.closest("video");
      selectFrameInstance(instId);
      if (onVideo) return;

      dragState.current = {
        id: instId,
        startX: e.clientX,
        startY: e.clientY,
        initialInstX: inst.x,
        initialInstY: inst.y,
        viewScale: resolveZoomScale(useEditorStore.getState().previewZoom),
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

      const dx = dxPx / canvasRect.width / ds.viewScale;
      const dy = dyPx / canvasRect.height / ds.viewScale;

      let nextX = Math.max(0, Math.min(1, ds.initialInstX + dx));
      let nextY = Math.max(0, Math.min(1, ds.initialInstY + dy));

      if (e.shiftKey) {
        // Free move: no grid snap, no smart guides.
        onGuides?.([]);
      } else if (snapDivisions) {
        nextX = snapToGrid(nextX, snapDivisions);
        nextY = snapToGrid(nextY, snapDivisions);
        onGuides?.([]);
      } else {
        // Smart guides: snap the dragged box to the canvas edges/centerlines
        // and to sibling instances (same precedence as annotations — the grid
        // takes over when it is active).
        const inst = scene.frameInstances.find((fi) => fi.id === ds.id);
        if (inst) {
          const half = frameInstanceHalfExtents(inst, scene.customFrame, scene.aspectRatio);
          const others = scene.frameInstances.filter((fi) => fi.id !== ds.id).map(instanceBox);
          const snapped = snapCenteredBox({ x: nextX, y: nextY, halfW: half.w, halfH: half.h }, others);
          nextX = Math.max(0, Math.min(1, snapped.x));
          nextY = Math.max(0, Math.min(1, snapped.y));
          onGuides?.(snapped.guides);
        }
      }

      updateFrameInstance(ds.id, { x: nextX, y: nextY }, true);
    },
    [getCanvasRect, updateFrameInstance, snapDivisions, scene.frameInstances, scene.customFrame, scene.aspectRatio, instanceBox, onGuides]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>, instId: string) => {
    const ds = dragState.current;
    if (ds && ds.id === instId) {
      const didMove = ds.moved;
      dragState.current = null;
      setDraggingId((prev) => (prev === instId ? null : prev));
      onGuides?.([]);
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
      if (!didMove) {
        selectFrameInstance(instId);
      }
    }
  }, [selectFrameInstance, onGuides]);

  // ═══ Resize ═══════════════════════════════════════════
  const handleResizeDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, instId: string) => {
      e.stopPropagation();
      e.preventDefault();

      const inst = scene.frameInstances.find((fi) => fi.id === instId);
      if (!inst) return;

      resizeState.current = {
        id: instId,
        startX: e.clientX,
        startY: e.clientY,
        initialScale: inst.scale,
        viewScale: resolveZoomScale(useEditorStore.getState().previewZoom)
      };
      setResizingId(instId);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [scene.frameInstances]
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, instId: string) => {
      const rs = resizeState.current;
      if (!rs || rs.id !== instId) return;

      const canvasRect = getCanvasRect();
      if (!canvasRect || canvasRect.width === 0) return;

      const dxPx = e.clientX - rs.startX;
      const factor = 2;
      const nextScale = Math.max(0.05, Math.min(1.0, rs.initialScale + ((dxPx / canvasRect.width) * factor) / rs.viewScale));

      updateFrameInstance(instId, { scale: nextScale }, true);
    },
    [getCanvasRect, updateFrameInstance]
  );

  const handleResizeUp = useCallback((e: React.PointerEvent<HTMLDivElement>, instId: string) => {
    const rs = resizeState.current;
    if (rs && rs.id === instId) {
      resizeState.current = null;
      setResizingId((prev) => (prev === instId ? null : prev));
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    }
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: buildEntranceKeyframesStyle(scene.layers) }} />
      {scene.frameInstances.filter((inst) => {
        const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayer;
        return !layer?.hidden;
      }).map((inst) => {
        const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayer;
        const spec = getFrameSpec(inst.frame);
        const instCss = frameInstanceCssMap.get(inst.id)!;
        const zoom = layer?.zoom ?? 1;
        // mediaOffset pans the MEDIA inside the frame (objectPosition in
        // instCss, matching the exporters) — translating the whole frame here
        // as well double-applies it and shifts the device ~2px per unit away
        // from its exported position.
        const zoomStyle = { transform: tiltCss(scene) + "scale(" + zoom + ")", transformOrigin: "center" };
        // Live preview uses the native -webkit-box-reflect (Chromium/Safari);
        // canvas-based exports implement the effect fully for every browser.
        const isSelected = activeFrameInstanceId === inst.id;
        return (
          <div
            key={inst.id}
            className="frame-instance"
            data-frame-instance-id={inst.id}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectFrameInstance(inst.id);
                return;
              }
              if (!e.key.startsWith("Arrow")) return;
              e.preventDefault();
              const step = e.shiftKey ? 0.02 : 0.01;
              const dirs: Record<string, [number, number, number?]> = {
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0]
              };
              const [dx, dy] = dirs[e.key] ?? [0, 0];
              if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                // Shift+vertical arrows resize (scale) the frame instance.
                const nextScale = Math.max(0.05, Math.min(1, inst.scale + (e.key === "ArrowUp" ? step : -step)));
                updateFrameInstance(inst.id, { scale: nextScale });
                return;
              }
              const nextX = Math.max(0, Math.min(1, inst.x + dx));
              const nextY = Math.max(0, Math.min(1, inst.y + dy));
              updateFrameInstance(inst.id, { x: nextX, y: nextY });
            }}
            onPointerDown={(e) => handlePointerDown(e, inst.id)}
            onPointerMove={(e) => handlePointerMove(e, inst.id)}
            onPointerUp={(e) => handlePointerUp(e, inst.id)}
            onPointerCancel={(e) => handlePointerUp(e, inst.id)}
            style={{
              position: "absolute",
              left: (inst.x * 100) + "%",
              top: (inst.y * 100) + "%",
              // Landscape swaps the physical extents: the box becomes
              // scale·nativeAr wide (fraction of canvas width).
              width: ((inst.orientation === "landscape"
                ? inst.scale * (frameInstAr(inst.frame, scene.customFrame, scene.aspectRatio) ?? 1)
                : inst.scale) * 100) + "%",
              height: "auto",
              transform: "translate(-50%, -50%)",
              // Physical width/height ratio so the browser sizes the box
              // exactly like computeFrameInstances does.
              aspectRatio: (() => {
                const native = frameInstAr(inst.frame, scene.customFrame, scene.aspectRatio) ?? 390 / 844;
                return inst.orientation === "landscape" ? `${native} / 1` : `1 / ${native}`;
              })(),
              cursor: (draggingId === inst.id ? "grabbing" : "grab") as CSSProperties["cursor"],
              outline: isSelected ? "2px solid var(--accent)" : undefined,
              outlineOffset: 4,
              borderRadius: 4,
              touchAction: "none",
              ...(inst.floorReflection ?? scene.floorReflection
                ? ({ WebkitBoxReflect: "below 0 linear-gradient(transparent 45%, rgba(255,255,255,0.30))" } as CSSProperties)
                : {})
            } as CSSProperties}
          >
            {/* ── Frame content ──
                Landscape wraps everything in a rotor whose PRE-rotation box
                equals the native-orientation assembly: width = swapped-box
                height (calc(100% / native)), ratio = native physical w/h.
                After rotate(90°) its footprint lands exactly on the swapped
                wrapper, matching computeFrameInstances. */}
            <div
              style={inst.orientation === "landscape" ? {
                position: "absolute",
                left: "50%",
                top: "50%",
                width: `calc(100% / ${(frameInstAr(inst.frame, scene.customFrame, scene.aspectRatio) ?? 1).toFixed(6)})`,
                aspectRatio: `${(1 / (frameInstAr(inst.frame, scene.customFrame, scene.aspectRatio) ?? 1)).toFixed(6)} / 1`,
                transform: "translate(-50%, -50%) rotate(90deg)"
              } as CSSProperties : undefined}
            >
            <div
              data-mockup-frame
              style={{
                ...instCss.frame,
                width: "100%",
                height: "100%",
                position: "relative",
                ...zoomStyle
              }}
              onPointerDown={layer?.mediaUrl ? () => selectLayer(layer.id) : undefined}
            >
              <FrameContent
                css={instCss}
                media={
                  layer?.mediaUrl ? (
                    (() => {
                      const entranceStyle = buildEntranceAnimationCss(layer);
                      const hasEntrance = layer.entranceAnimation && layer.entranceAnimation !== "none";
                      const blendCss = layer.blendMode && layer.blendMode !== "normal" ? { mixBlendMode: layer.blendMode } : {};
                      const wrapper: CSSProperties = hasEntrance
                        ? { position: "relative", width: "100%", height: "100%", ...entranceStyle }
                        : {};
                      const wrap = (el: React.ReactNode) =>
                        hasEntrance
                          ? <div key={`${layer.id}-${layer.entranceAnimation}`} style={wrapper}>{el}</div>
                          : el;
                      return isVideoLayer(layer) ? wrap(
                        <video
                          src={layer.mediaUrl}
                          muted
                          playsInline
                          controls
                          loop={layer.videoLoop}
                          autoPlay={layer.videoAutoplay}
                          crossOrigin="anonymous"
                          style={{ ...instCss.mediaStyle, objectFit: "contain", backgroundColor: "var(--panel-solid)", cursor: "grab", ...blendCss }}
                          onPointerDown={() => selectLayer(layer.id)}
                          onLoadedData={(e) => {
                            setMediaLoading(false);
                            analyzeMedia(e.currentTarget);
                          }}
                          onLoadedMetadata={(e) => {
                            setVideoDuration(e.currentTarget.duration || 0, layer.id);
                            e.currentTarget.playbackRate = Math.max(0.5, Math.min(2, layer.playbackSpeed ?? 1));
                          }}
                        />
                      ) : wrap(
                        <img
                          src={layer.mediaUrl}
                          alt={t("editor.uploadedMediaAlt")}
                          style={{ ...instCss.mediaStyle, cursor: "grab", ...blendCss }}
                          onLoad={(e) => {
                            setMediaLoading(false);
                            analyzeMedia(e.currentTarget);
                          }}
                          onPointerDown={() => selectLayer(layer.id)}
                        />
                      );
                    })()
                  ) : isTextLayer(layer) ? (
                    <div
                      style={{ ...instCss.textStyle, cursor: "grab" }}
                      onPointerDown={() => selectLayer(layer!.id)}
                      dangerouslySetInnerHTML={{ __html: buildTextLayerSvg(layer, instCss.screenAspect) ?? "" }}
                    />
                  ) : null
                }
              />
            </div>
            </div>

            {/* ── Resize handle ── */}
            {isSelected ? (
              <div
                className="frame-instance-resize"
                role="button"
                tabIndex={0}
                aria-label={t("editor.resizeFrame")}
                onPointerDown={(e) => handleResizeDown(e, inst.id)}
                onPointerMove={(e) => handleResizeMove(e, inst.id)}
                onPointerUp={(e) => handleResizeUp(e, inst.id)}
                onPointerCancel={(e) => handleResizeUp(e, inst.id)}
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 16,
                  height: 16,
                  cursor: "nwse-resize",
                  zIndex: 10,
                  borderBottomRightRadius: 4,
                  background: resizingId === inst.id ? "var(--accent)" : "rgba(255,255,255,0.45)",
                  boxShadow: "0 0 0 1.5px rgba(0,0,0,0.35)"
                } as CSSProperties}
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}
