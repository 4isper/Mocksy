import type { EditorScene, MockupFrame } from "@/lib/types/editor";
import { frameInstanceSize, getFrameSpec, frameViewBox } from "@/lib/render/frames";
import { RENDER } from "@/lib/render/canvasDrawing";
import { parseAspectRatioOr } from "@/lib/render/aspectRatio";

export interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
  outerRadius: number;
  innerX: number;
  innerY: number;
  innerW: number;
  innerH: number;
  innerRadius: number;
  /** 0 for portrait, Math.PI/2 for a landscape (rotated) instance. The box
   *  above already carries the swapped dimensions; rotation is applied around
   *  the box center by the canvas renderer. */
  rotation?: number;
  /** The frame this box represents, so renderers can derive OS-specific chrome. */
  frame?: MockupFrame;
}

export interface RenderTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

/** Animation pan keyframes store small offsets (e.g. ±20). The live preview
 *  displaces the frame by that many units × this factor (CSS px), so the
 *  canvas export must shift the frame box by the same factor × pixelRatio to
 *  keep "what you see previews what you export". Shared so the two can't drift.
 */
export const PAN_OFFSET_SCALE = 2;

function panOffset(transform: RenderTransform | undefined, dpiScale: number, zoom: number): { panX: number; panY: number } {
  return {
    panX: (transform?.offsetX ?? 0) * PAN_OFFSET_SCALE * dpiScale * zoom,
    panY: (transform?.offsetY ?? 0) * PAN_OFFSET_SCALE * dpiScale * zoom
  };
}

export function computeFrameBox(
  scene: EditorScene,
  canvasWidth: number,
  canvasHeight: number,
  pixelRatio: number,
  frameWidth?: number,
  frameHeight?: number,
  transform?: RenderTransform,
  frameX?: number,
  frameY?: number,
  activeLayerId: string | null = scene.activeLayerId
): FrameBox {
   const spec = getFrameSpec(scene.frame, scene.customFrame);
   const dpiScale = pixelRatio;
   const activeLayerForRender = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
    const actualZoom = Math.max(RENDER.minZoom, transform?.zoom ?? activeLayerForRender?.zoom ?? 1);
    const defaultFrameW = Math.min(RENDER.defaultFrameWidth, (canvasWidth / dpiScale) * RENDER.defaultFrameFill) * dpiScale;
    const ratioSrc = spec.aspectRatio ?? (scene.frame === "none" ? scene.aspectRatio : "1 / 1");
    const { w: ratioW, h: ratioH } = parseAspectRatioOr(ratioSrc);
    const frameAr = ratioH / ratioW;
   const frameW = (typeof frameWidth === "number" && frameWidth > 0 ? frameWidth : defaultFrameW) * actualZoom;
   const frameH = typeof frameHeight === "number" && frameHeight > 0 ? frameHeight * actualZoom : frameW * frameAr;
  const { panX, panY } = panOffset(transform, dpiScale, actualZoom);
  const x = (typeof frameX === "number" ? frameX : (canvasWidth - frameW) / 2) + panX;
  const y = (typeof frameY === "number" ? frameY : (canvasHeight - frameH) / 2) + panY;
  const cutout = spec.cutout;
  const vb = frameViewBox(spec);
  const padX = cutout ? (cutout.x / vb.w) * frameW : spec.padding * dpiScale * actualZoom;
  const padY = cutout ? (cutout.y / vb.h) * frameH : spec.padding * dpiScale * actualZoom;
  const outerRadius = (spec.isOverlay ? spec.screenRadius : scene.borderRadius + spec.padding) * dpiScale * actualZoom;
  const innerX = x + padX;
  const innerY = y + padY;
  const innerW = cutout ? (cutout.w / vb.w) * frameW : frameW - padX * 2;
  const innerH = cutout ? (cutout.h / vb.h) * frameH : frameH - padY * 2;
  const innerRadius = cutout
    ? Math.max(0, (cutout.rx / cutout.w) * innerW, (cutout.rx / cutout.h) * innerH)
    : Math.max(0, spec.screenRadius * dpiScale * actualZoom);
  return { x, y, width: frameW, height: frameH,     outerRadius, innerX, innerY, innerW, innerH, innerRadius, frame: scene.frame };
}

export function computeFrameInstances(
  scene: EditorScene,
  canvasWidth: number,
  canvasHeight: number,
  pixelRatio: number,
  transform?: RenderTransform,
  activeLayerId: string | null = scene.activeLayerId
): FrameBox[] {
  const instances = scene.frameInstances.length > 0 ? scene.frameInstances : [];
  if (instances.length === 0) return [];
  const dpiScale = pixelRatio;

  return instances.map((inst) => {
    const layer = scene.layers.find((l) => l.id === inst.layerId);
    // Only the frame instance whose layer is the currently active one should
    // reflect the live transform (mid-animation zoom/pan sampled for export).
    // Every other instance keeps its own static layer.zoom and no pan offset —
    // matching how the preview builds each instance's css independently via
    // frameInstanceCssMap, instead of applying one global transform to all.
    const isActiveInstance = !!layer && layer.id === activeLayerId;
    const instZoom = Math.max(
      RENDER.minZoom,
      isActiveInstance ? (transform?.zoom ?? layer?.zoom ?? 1) : (layer?.zoom ?? 1)
    );

    const spec = getFrameSpec(inst.frame, scene.customFrame);
    const instScale = inst.scale ?? 1;
    const ratioSrc = spec.aspectRatio ?? (inst.frame === "none" ? scene.aspectRatio : "1 / 1");
    const { w: rW, h: rH } = parseAspectRatioOr(ratioSrc);
    const nativeAr = rH / rW;
    const landscape = inst.orientation === "landscape";
    // Physical box in pixels, mirroring the CSS preview exactly: portrait
    // width = scale · canvasW with height following the native ratio;
    // landscape swaps those two extents.
    const pw = instScale * canvasWidth;
    const ph = pw * nativeAr;
    const w = (landscape ? ph : pw) * instZoom;
    const h = (landscape ? pw : ph) * instZoom;
    const { panX, panY } = isActiveInstance
      ? panOffset(transform, dpiScale, instZoom)
      : { panX: 0, panY: 0 };
    const x = inst.x * canvasWidth - w / 2 + panX;
    const y = inst.y * canvasHeight - h / 2 + panY;

    const cutout = spec.cutout;
    const vb = frameViewBox(spec);
    // Skin/media geometry below stays in NATIVE orientation — the renderer
    // rotates the whole assembly around the box center when landscape.
    const drawW = landscape ? h : w;
    const drawH = landscape ? w : h;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const dx = cx - drawW / 2;
    const dy = cy - drawH / 2;
    const padX = cutout ? (cutout.x / vb.w) * drawW : spec.padding * dpiScale * instZoom;
    const padY = cutout ? (cutout.y / vb.h) * drawH : spec.padding * dpiScale * instZoom;
    const outerRadius = spec.isOverlay ? 0 : (scene.borderRadius + spec.padding) * dpiScale * instZoom;

    return {
      x,
      y,
      width: w,
      height: h,
      rotation: landscape ? Math.PI / 2 : undefined,
      outerRadius,
      innerX: dx + padX,
      innerY: dy + padY,
      innerW: cutout ? (cutout.w / vb.w) * drawW : drawW - padX * 2,
      innerH: cutout ? (cutout.h / vb.h) * drawH : drawH - padY * 2,
      innerRadius: cutout
        ? Math.max(0, (cutout.rx / cutout.w) * (drawW - padX * 2), (cutout.rx / cutout.h) * (drawH - padY * 2))
        : spec.screenRadius * dpiScale * instZoom,
      frame: inst.frame
    };
  });
}

