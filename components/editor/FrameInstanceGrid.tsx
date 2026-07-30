"use client";

import type { CSSProperties } from "react";
import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";
import type { SceneCss } from "@/lib/render/mockupRenderer";

interface FrameInstanceGridProps {
  scene: EditorScene;
  activeLayer: MediaLayer | undefined;
  frameInstanceCssMap: Map<string, SceneCss>;
  activeFrameInstanceId: string | null;
  selectFrameInstance: (id: string | null) => void;
  analyzeMedia: (el: HTMLImageElement | HTMLVideoElement) => void;
}

export function FrameInstanceGrid({
  scene,
  activeLayer,
  frameInstanceCssMap,
  activeFrameInstanceId,
  selectFrameInstance,
  analyzeMedia
}: FrameInstanceGridProps) {
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
            onClick={() => selectFrameInstance(inst.id)}
            style={{
              position: "absolute",
              left: `${inst.x * 100}%`,
              top: `${inst.y * 100}%`,
              width: `${inst.scale * 100}%`,
              height: "auto",
              transform: "translate(-50%, -50%)",
              aspectRatio: spec.aspectRatio ?? (inst.frame === "watch" ? "1" : "9 / 16"),
              cursor: "pointer",
              outline: activeFrameInstanceId === inst.id ? "2px solid var(--accent)" : undefined,
              outlineOffset: 4,
              borderRadius: 4
            }}
          >
            {spec.isOverlay ? (
              // Overlay frame: match single-frame structure so
              // drop-shadow and frame CSS (border, backdrop-filter)
              // are applied correctly.
              <div
                style={{
                  ...instCss.frame,
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  ...zoomStyle
                }}
              >
                {instCss.frameOverlay ? (
                  <img src={instCss.frameOverlay} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
                ) : null}
                {layer?.mediaUrl ? (
                  isVideoLayer(layer) ? (
                    <video src={layer.mediaUrl} muted playsInline controls loop={layer.videoLoop} autoPlay={layer.videoAutoplay} crossOrigin="anonymous" style={instCss.mediaStyle} onLoadedData={(e) => analyzeMedia(e.currentTarget)} />
                  ) : (
                    <img src={layer.mediaUrl} alt="" style={instCss.mediaStyle} onLoad={(e) => analyzeMedia(e.currentTarget)} />
                  )
                ) : null}
              </div>
            ) : (
              // CSS frame: media fills frame with optional radius
              <div
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
                    <video src={layer.mediaUrl} muted playsInline controls loop={layer.videoLoop} autoPlay={layer.videoAutoplay} crossOrigin="anonymous" style={instCss.mediaStyle} onLoadedData={(e) => analyzeMedia(e.currentTarget)} />
                  ) : (
                    <img src={layer.mediaUrl} alt="" style={instCss.mediaStyle} onLoad={(e) => analyzeMedia(e.currentTarget)} />
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
