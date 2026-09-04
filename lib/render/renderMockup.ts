"use client";

import type { EditorScene, MediaLayer, ScreenChrome } from "@/lib/types/editor";
import { frameViewBox, getFrameSpec } from "@/lib/render/frames";
import { RENDER, drawAnnotations, drawFrameAndMedia, drawWatermark, type MediaStackEntry } from "@/lib/render/canvasDrawing";
import { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
import { isTextLayer } from "@/lib/render/layerText";
import { createLayerCanvas, layerContext } from "@/lib/render/canvasFactory";
import type { FrameBox, RenderTransform } from "@/lib/render/frameGeometry";
import { computeFrameBox, computeFrameInstances, isVisibleFrameInstance } from "@/lib/render/frameGeometry";
import { TILT_PERSPECTIVE, drawTiltedQuad, hasTilt, projectTiltedRectRotated } from "@/lib/render/tilt";
import { paintBackground } from "@/lib/render/renderBackground";

export { loadImage, loadVideoFrame } from "@/lib/render/canvasMedia";
export type { FrameBox, RenderTransform } from "@/lib/render/frameGeometry";

/** Renders one frame with the 3D tilt: draws the flat frame composite (device
 *  + media + shadow) into an offscreen canvas padded so the drop shadow fits,
 *  then warps it into the projected quad. Only used when the scene is tilted.
 *  Landscape instances are composited in their NATIVE orientation and the
 *  projected quad is rotated afterwards (mirroring the preview, where the
 *  parent rotor's rotate(90deg) applies after the child's 3D tilt). */
function drawTiltedFrame(
  ctx: CanvasRenderingContext2D,
  scene: EditorScene,
  spec: ReturnType<typeof getFrameSpec>,
  layer: MediaLayer | undefined,
  box: FrameBox,
  dpiScale: number,
  zoom: number,
  media: CanvasImageSource | null,
  overlay: CanvasImageSource | null,
  screen: ScreenChrome = scene.screen,
  mediaStack?: MediaStackEntry[]
) {
  const landscape = !!box.rotation && !!box.nativeRect;
  const native = box.nativeRect ?? { x: box.x, y: box.y, width: box.width, height: box.height };
  const padX = RENDER.shadowBlur * dpiScale * zoom + 4;
  const padY = (RENDER.shadowBlur + RENDER.shadowOffsetY) * dpiScale * zoom + 4;
  const w = Math.ceil(native.width + padX * 2);
  const h = Math.ceil(native.height + padY * 2);
  const off = createLayerCanvas(w, h);
  const octx = layerContext(off);
  if (!octx) return;

  // native.x/y (and innerX/innerY) are absolute coordinates on the full export
  // canvas. The offscreen buffer is a small canvas local to just this frame,
  // so every coordinate needs to be re-based to that local origin — not just
  // the frame rect, but innerX/innerY too, or they'll still point at the old
  // absolute position and draw off-buffer for any frame instance not near (0,0).
  const dx = native.x - padX;
  const dy = native.y - padY;
  const localBox: FrameBox = {
    ...box,
    x: padX,
    y: padY,
    nativeRect: { x: padX, y: padY, width: native.width, height: native.height },
    innerX: box.innerX - dx,
    innerY: box.innerY - dy
  };

  drawFrameAndMedia(octx, scene, spec, layer, localBox, dpiScale, zoom, media, overlay, screen, mediaStack);

  // Project the flat composite (device + shadow padding, native orientation),
  // then rotate the projected quad about the assembly center for landscape
  // instances — the same order the CSS preview composes rotor and tilt.
  const quad = projectTiltedRectRotated(
    { x: native.x - padX, y: native.y - padY, width: w, height: h },
    landscape ? box.rotation! : 0,
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
  opacity = RENDER.reflectionOpacity
): void {
  const layer = createLayerCanvas(width, height);
  const lctx = layerContext(layer);
  if (!lctx) return;

  for (const box of boxes) {
    const bottom = box.y + box.height;
    lctx.save();
    // Only the strip below the device may contain reflection: with tilt the
    // mirrored quad extends sideways past the box, and anything drawn outside
    // this rect would escape the fade pass below as a full-strength ghost.
    lctx.beginPath();
    lctx.rect(box.x, bottom, box.width, box.height);
    lctx.clip();
    lctx.setTransform(1, 0, 0, -1, 0, 2 * bottom);
    drawOne(lctx);
    lctx.restore();

    // Fade this strip: keep ~opacity at the device edge, gone by
    // RENDER.reflectionFade of the box height below it (mirrored in SVG).
    lctx.save();
    lctx.beginPath();
    lctx.rect(box.x, bottom, box.width, box.height);
    lctx.clip();
    lctx.globalCompositeOperation = "destination-in";
    const fade = lctx.createLinearGradient(0, bottom, 0, bottom + box.height * RENDER.reflectionFade);
    fade.addColorStop(0, `rgba(0,0,0,${opacity})`);
    fade.addColorStop(1, "rgba(0,0,0,0)");
    lctx.fillStyle = fade;
    lctx.fillRect(box.x, bottom, box.width, box.height);
    lctx.restore();
  }

  ctx.drawImage(layer as CanvasImageSource, 0, 0);
}

/** Builds the single-frame media stack: every visible layer paired with its
 *  decoded media in paint order (bottom → top), mirroring the CSS preview's
 *  media slot. The `resolve` callback supplies each layer's media (already
 *  loaded by the caller). */
function buildMediaStack(
  scene: EditorScene,
  resolve: (layer: MediaLayer) => CanvasImageSource | null
): MediaStackEntry[] {
  return scene.layers
    .filter((l) => !l.hidden)
    .map((layer) => ({ layer, media: resolve(layer) }));
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
    // Same fallback arg as the single-frame path below: a transparent
    // multi-frame scene with no video-export fill must stay transparent,
    // not pick up the default near-white wash.
    paintBackground(ctx, scene, width, height, dpiScale, backgroundFill, backgroundImage, "rgba(0,0,0,0)");

    const frameBoxes = computeFrameInstances(scene, width, height, pixelRatio, transform, activeLayerId);
    // Hidden layers' instances are invisible in the live preview; zip the
    // boxes with their instances and drop hidden ones so exports match.
    const visible: Array<{ box: FrameBox; inst: EditorScene["frameInstances"][number] }> = [];
    for (let i = 0; i < frameBoxes.length; i++) {
      const box = frameBoxes[i];
      const inst = scene.frameInstances[i];
      if (!box || !inst) continue;
      if (!isVisibleFrameInstance(scene, inst)) continue;
      visible.push({ box, inst });
    }

    const renderInstance = (
      target: CanvasRenderingContext2D,
      box: FrameBox,
      inst: EditorScene["frameInstances"][number]
    ) => {
      const layer = scene.layers.find((l) => l.id === inst.layerId) ?? activeLayerForRender;
      const instSpec = getFrameSpec(inst.frame, scene.customFrame);
      // Frame-level zoom (shadow/box scaling) comes only from the sampled
      // animation transform; static media zoom is media-level at draw time.
      const instZoom = Math.max(RENDER.minZoom, transform?.zoom ?? 1);

      const frameMedia = layer?.id ? (layerMedias?.get(layer.id) ?? null) : media;
      // Overlay skins are keyed by instance id: two instances can share a
      // layer with different materials, each needing its own skin.
      const overlay = instSpec.isOverlay ? (frameOverlays?.get(inst.id) ?? null) : null;

      // Landscape instances carry swapped box dimensions plus a rotation.
      // Every part of the assembly is drawn in its NATIVE orientation inside
      // the rotated context (matching the preview's rotor): the native rect
      // for skin/body/shadow/URL, and the already-native inner rect for the
      // media. Drawing the landscape box itself inside the rotated context
      // would re-swap its extents and squash the device into a center strip.
      const rotated = !!box.rotation;
      const drawBox: FrameBox = box.nativeRect
        ? { ...box, x: box.nativeRect.x, y: box.nativeRect.y, width: box.nativeRect.width, height: box.nativeRect.height }
        : box;
      if (hasTilt(scene)) {
        // The tilt path handles orientation itself (native composite + rotated
        // quad) — no context rotation here or the tilt is applied twice.
        drawTiltedFrame(target, scene, instSpec, layer, box, dpiScale, instZoom, frameMedia, overlay, inst.screen ?? scene.screen);
      } else {
        if (rotated) {
          target.save();
          target.translate(box.x + box.width / 2, box.y + box.height / 2);
          target.rotate(box.rotation!);
          target.translate(-(box.x + box.width / 2), -(box.y + box.height / 2));
        }
        drawFrameAndMedia(target, scene, instSpec, layer, drawBox, dpiScale, instZoom, frameMedia, overlay, inst.screen ?? scene.screen);
        if (rotated) target.restore();
      }
    };

    const reflected = visible.filter(({ inst }) => inst.floorReflection ?? scene.floorReflection);
    if (reflected.length > 0) {
      paintFloorReflection(
        ctx,
        reflected.map(({ box }) => box),
        (target) => {
          for (const { box, inst } of reflected) renderInstance(target, box, inst);
        },
        width,
        height
      );
    }

    for (const { box, inst } of visible) {
      renderInstance(ctx, box, inst);
    }
    // Paint order matches the preview and SVG export: annotations first, the
    // watermark on top of them.
    if (scene.annotations.length > 0) drawAnnotations(ctx, scene.annotations, width, height);
    drawWatermark(ctx, scene, width, height, watermarkImage);
    return;
  }

  paintBackground(ctx, scene, width, height, dpiScale, backgroundFill, backgroundImage, "rgba(0,0,0,0)");

  const box = computeFrameBox(scene, width, height, pixelRatio, frameWidth, frameHeight, transform, frameX, frameY, activeLayerId);

  const activeLayerForRender2 = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
   // Frame-level zoom (shadow/box scaling) comes only from the sampled
   // animation transform; static media zoom is media-level at draw time.
   const actualZoom = Math.max(RENDER.minZoom, transform?.zoom ?? 1);

  // Multi-layer single-frame scenes must export every visible layer, matching
  // the preview's media slot. `layerMedias` keyed by layer id (worker path and
  // media-stack callers) wins; otherwise the stack holds just the active layer,
  // which is the historical single-media behavior.
  const singleFrameStack = buildMediaStack(scene, (layer) =>
    layerMedias && layerMedias.has(layer.id) ? layerMedias.get(layer.id)! : layer.id === activeLayerForRender2?.id ? media : null
  );
  const hasStackContent = singleFrameStack.some((e) => e.media != null || isTextLayer(e.layer));
  const stack: MediaStackEntry[] = hasStackContent
    ? singleFrameStack
    : [{ layer: (activeLayerForRender2 ?? scene.layers[0]!) as MediaLayer, media: null }];


  if (scene.floorReflection) {
    paintFloorReflection(
      ctx,
      [box],
      (target) => {
        if (hasTilt(scene)) {
          drawTiltedFrame(target, scene, spec, activeLayerForRender2 ?? scene.layers[0], box, dpiScale, actualZoom, media, frameOverlay ?? null, undefined, stack);
        } else {
          drawFrameAndMedia(target, scene, spec, activeLayerForRender2 ?? scene.layers[0], box, dpiScale, actualZoom, media, frameOverlay ?? null, undefined, stack);
        }
      },
      width,
      height
    );
  }

  if (hasTilt(scene)) {
    drawTiltedFrame(ctx, scene, spec, activeLayerForRender2, box, dpiScale, actualZoom, media, frameOverlay ?? null, undefined, stack);
  } else {
    drawFrameAndMedia(ctx, scene, spec, activeLayerForRender2, box, dpiScale, actualZoom, media, frameOverlay ?? null, undefined, stack);
  }

  // Paint order matches the preview and SVG export: annotations first, the
  // watermark on top of them.
  if (scene.annotations.length > 0) {
    drawAnnotations(ctx, scene.annotations, width, height);
  }
  if (scene.watermarkEnabled && (scene.watermarkText || scene.watermarkImageUrl)) {
    drawWatermark(ctx, scene, width, height, watermarkImage);
  }
}
