"use client";

import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { frameViewBox, getFrameSpec } from "@/lib/render/frames";
import { RENDER, drawAnnotations, drawFrameAndMedia, drawWatermark } from "@/lib/render/canvasDrawing";
import { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
import { createLayerCanvas, layerContext } from "@/lib/render/canvasFactory";
import type { FrameBox, RenderTransform } from "@/lib/render/frameGeometry";
import { computeFrameBox, computeFrameInstances } from "@/lib/render/frameGeometry";
import { TILT_PERSPECTIVE, drawTiltedQuad, hasTilt, projectTiltedRect } from "@/lib/render/tilt";
import { paintBackground } from "@/lib/render/renderBackground";

export { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
export type { FrameBox, RenderTransform } from "@/lib/render/frameGeometry";

/** Renders one frame with the 3D tilt: draws the flat frame composite (device
 *  + media + shadow) into an offscreen canvas padded so the drop shadow fits,
 *  then warps it into the projected quad. Only used when the scene is tilted. */
function drawTiltedFrame(
  ctx: CanvasRenderingContext2D,
  scene: EditorScene,
  spec: ReturnType<typeof getFrameSpec>,
  layer: MediaLayer | undefined,
  box: FrameBox,
  dpiScale: number,
  zoom: number,
  media: CanvasImageSource | null,
  overlay: CanvasImageSource | null
) {
  const padX = RENDER.shadowBlur * dpiScale * zoom + 4;
  const padY = (RENDER.shadowBlur + RENDER.shadowOffsetY) * dpiScale * zoom + 4;
  const w = Math.ceil(box.width + padX * 2);
  const h = Math.ceil(box.height + padY * 2);
  const off = createLayerCanvas(w, h);
  const octx = layerContext(off);
  if (!octx) return;

  // box.x/y (and innerX/innerY) are absolute coordinates on the full export
  // canvas. The offscreen buffer is a small canvas local to just this frame,
  // so every coordinate needs to be re-based to that local origin — not just
  // x/y, but innerX/innerY too, or they'll still point at the old absolute
  // position and draw off-buffer for any frame instance not near (0,0).
  const dx = box.x - padX;
  const dy = box.y - padY;
  const localBox: FrameBox = {
    ...box,
    x: box.x - dx,       // === padX
    y: box.y - dy,       // === padY
    innerX: box.innerX - dx,
    innerY: box.innerY - dy
  };

  drawFrameAndMedia(octx, scene, spec, layer, localBox, dpiScale, zoom, media, overlay);

  const quad = projectTiltedRect(
    { x: box.x - padX, y: box.y - padY, width: w, height: h },
    scene.tiltX,
    scene.tiltY,
    TILT_PERSPECTIVE * dpiScale
  );
  drawTiltedQuad(ctx, off, quad);
}

/**
 * Draws vertically-mirrored, downward-fading copies of every frame box onto an
 * isolated layer, then composites it under the frames. The flip maps original
 * pixel y to 2·bottom − y so each reflection starts exactly at its device's
 * bottom edge; a per-strip `destination-in` gradient fades it out without
 * touching the background. Returns silently when the document is unavailable
 * (tests / SSR callers).
 */
function paintFloorReflection(
  ctx: CanvasRenderingContext2D,
  boxes: Array<{ x: number; y: number; width: number; height: number }>,
  drawOne: (target: CanvasRenderingContext2D) => void,
  width: number,
  height: number,
  opacity = 0.28
): void {
  const layer = createLayerCanvas(width, height);
  const lctx = layerContext(layer);
  if (!lctx) return;

  for (const box of boxes) {
    const bottom = box.y + box.height;
    lctx.save();
    lctx.setTransform(1, 0, 0, -1, 0, 2 * bottom);
    drawOne(lctx);
    lctx.restore();

    // Fade this strip: keep ~opacity at the device edge, gone by ~55% down.
    lctx.save();
    lctx.beginPath();
    lctx.rect(box.x, bottom, box.width, box.height);
    lctx.clip();
    lctx.globalCompositeOperation = "destination-in";
    const fade = lctx.createLinearGradient(0, bottom, 0, bottom + box.height * 0.55);
    fade.addColorStop(0, `rgba(0,0,0,${opacity})`);
    fade.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = fade;
    lctx.fillRect(box.x, bottom, box.width, box.height);
    lctx.restore();
  }

  ctx.drawImage(layer as CanvasImageSource, 0, 0);
}

export function renderMockupToCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  scene: EditorScene,
  media: CanvasImageSource | null,
  frameX?: number,
  frameY?: number,
  frameWidth?: number,
  frameHeight?: number,
  pixelRatio = 2,
  transform?: RenderTransform,
  backgroundFill?: string,
  frameOverlay?: CanvasImageSource | null,
  backgroundImage?: CanvasImageSource | null,
  layerMedias?: Map<string, CanvasImageSource | null>,
  frameOverlays?: Map<string, CanvasImageSource | null>,
  activeLayerId: string | null = scene.activeLayerId,
  watermarkImage?: CanvasImageSource | null
) {
  const ctx = layerContext(canvas);
  if (!ctx) return;

  const spec = getFrameSpec(scene.frame, scene.customFrame);
  const width = canvas.width;
  const height = canvas.height;
  const dpiScale = pixelRatio;
  const activeLayerForRender = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  ctx.clearRect(0, 0, width, height);

  if (scene.frameInstances.length > 0) {
    paintBackground(ctx, scene, width, height, dpiScale, backgroundFill, backgroundImage);

    const frameBoxes = computeFrameInstances(scene, width, height, pixelRatio, transform, activeLayerId);

    const renderInstance = (
      target: CanvasRenderingContext2D,
      box: FrameBox,
      inst: EditorScene["frameInstances"][number]
    ) => {
      const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayerForRender;
      const instSpec = getFrameSpec(inst.frame, scene.customFrame);
      const isActiveInstance = !!layer && layer.id === activeLayerId;
      const instZoom = isActiveInstance ? (transform?.zoom ?? layer?.zoom ?? 1) : (layer?.zoom ?? 1);

      const frameMedia = layer?.id ? (layerMedias?.get(layer.id) ?? null) : media;
      const overlay = layer?.id && instSpec.isOverlay ? (frameOverlays?.get(layer.id) ?? null) : null;

      // Landscape instances carry swapped box dimensions plus a rotation —
      // the whole assembly (skin, media, chrome) turns around the box center,
      // which also composes correctly with the tilted-quad path below.
      const rotated = !!box.rotation;
      if (rotated) {
        target.save();
        target.translate(box.x + box.width / 2, box.y + box.height / 2);
        target.rotate(box.rotation!);
        target.translate(-(box.x + box.width / 2), -(box.y + box.height / 2));
      }
      if (hasTilt(scene)) {
        drawTiltedFrame(target, scene, instSpec, layer, box, dpiScale, instZoom, frameMedia, overlay);
      } else {
        drawFrameAndMedia(target, scene, instSpec, layer, box, dpiScale, instZoom, frameMedia, overlay);
      }
      if (rotated) target.restore();
    };

    if (scene.floorReflection) {
      paintFloorReflection(
        ctx,
        frameBoxes,
        (target) => {
          for (let i = 0; i < frameBoxes.length; i++) {
            const box = frameBoxes[i];
            const inst = scene.frameInstances[i];
            if (box && inst) renderInstance(target, box, inst);
          }
        },
        width,
        height
      );
    }

    for (let i = 0; i < frameBoxes.length; i++) {
      const box = frameBoxes[i];
      const inst = scene.frameInstances[i];
      if (!box || !inst) continue;
      renderInstance(ctx, box, inst);
    }
    drawWatermark(ctx, scene, width, height, watermarkImage);
    if (scene.annotations.length > 0) drawAnnotations(ctx, scene.annotations, width, height);
    return;
  }

  paintBackground(ctx, scene, width, height, dpiScale, backgroundFill, backgroundImage, "rgba(0,0,0,0)");

  const box = computeFrameBox(scene, width, height, pixelRatio, frameWidth, frameHeight, transform, frameX, frameY, activeLayerId);

  const activeLayerForRender2 = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
   const actualZoom = Math.max(RENDER.minZoom, transform?.zoom ?? activeLayerForRender2?.zoom ?? 1);


  if (scene.floorReflection) {
    paintFloorReflection(
      ctx,
      [box],
      (target) => {
        if (hasTilt(scene)) {
          drawTiltedFrame(target, scene, spec, activeLayerForRender2 ?? scene.layers[0], box, dpiScale, actualZoom, media, frameOverlay ?? null);
        } else {
          drawFrameAndMedia(target, scene, spec, activeLayerForRender2 ?? scene.layers[0], box, dpiScale, actualZoom, media, frameOverlay ?? null);
        }
      },
      width,
      height
    );
  }

  if (hasTilt(scene)) {
    drawTiltedFrame(ctx, scene, spec, activeLayerForRender2, box, dpiScale, actualZoom, media, frameOverlay ?? null);
  } else {
    drawFrameAndMedia(ctx, scene, spec, activeLayerForRender2, box, dpiScale, actualZoom, media, frameOverlay ?? null);
  }

  if (scene.watermarkEnabled && (scene.watermarkText || scene.watermarkImageUrl)) {
    drawWatermark(ctx, scene, width, height, watermarkImage);
  }

  if (scene.annotations.length > 0) {
    drawAnnotations(ctx, scene.annotations, width, height);
  }
}
