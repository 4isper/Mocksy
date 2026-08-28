import type { EditorScene } from "@/lib/types/editor";
import type { RenderTransform } from "@/lib/render/frameGeometry";
import { getFrameSpec } from "@/lib/render/frames";
import { isVideoLayer } from "@/lib/render/mediaKind";

/**
 * Message contract between the export pipeline and the bundled render worker
 * (mockupRenderWorker.ts). Media travels as URL descriptors the worker fetches
 * itself (data:, blob: and same-origin URLs all fetch fine inside a worker);
 * anything a worker cannot decode on its own — video poster frames — arrives
 * as a pre-decoded, transferred ImageBitmap under `bitmaps`.
 */

export interface RenderImageSlot {
  /** Layer id for media, `overlay:<layerId>` for per-layer skins. */
  key: string;
  url: string;
}

export interface RenderWorkerPayload {
  id: number;
  width: number;
  height: number;
  pixelRatio: number;
  mimeType: string;
  scene: EditorScene;
  activeLayerId: string | null;
  transform?: RenderTransform;
  frameWidth?: number;
  frameHeight?: number;
  backgroundFill?: string;
  images: RenderImageSlot[];
  overlayUrl: string | null;
  backgroundImageUrl: string | null;
  watermarkImageUrl: string | null;
  /** Pre-decoded bitmaps for SVG assets (skins, custom frames, SVG media).
   *  Workers have no Image constructor and createImageBitmap refuses SVG
   *  blobs, so the main thread rasterizes them via an <img> first and ships
   *  the pixels over (transferred, zero-copy). Keyed by source URL. */
  bitmaps?: Array<{ url: string; bitmap: ImageBitmap }>;
}

export interface RenderWorkerResponse {
  id: number;
  blob?: Blob;
  error?: string;
}

/** Key used for the single-frame mode's active layer media. */
export const ACTIVE_MEDIA_KEY = "active";
/** Prefix for per-layer device-skin slots in multi-frame scenes. */
export const OVERLAY_KEY_PREFIX = "overlay:";

/** True for SVG payloads. `createImageBitmap` refuses to rasterize SVG blobs
 *  in Chromium/Firefox, so those slots must be pre-decoded on the main thread
 *  (see payload.bitmaps) — workers have no Image constructor. */
export function isSvgMimeType(type: string): boolean {
  return type === "image/svg+xml" || type === "image/svg" || type.endsWith("+xml");
}

/** True when a URL points at an SVG asset: a .svg path (device skins) or an
 *  inline data: URL (user-uploaded/custom-frame skins). */
export function isSvgAssetUrl(url: string): boolean {
  if (url.startsWith("data:image/svg")) return true;
  try {
    const path = new URL(url, "https://mocksy.invalid").pathname;
    return /\.svg$/i.test(path);
  } catch {
    return false;
  }
}

function isRenderableLayer(scene: EditorScene, layerId: string | null): boolean {
  const layer = scene.layers.find((l) => l.id === layerId) ?? scene.layers[0];
  return !layer?.hidden && !!layer?.mediaUrl && !isVideoLayer(layer);
}

/**
 * True when every layer this render draws is decodable inside a worker.
 * Video layers force the main-thread path: workers have no <video> decoder,
 * so their poster frames would need main-thread extraction anyway.
 */
export function canRenderSceneInWorker(scene: EditorScene, activeLayerId: string | null = scene.activeLayerId): boolean {
  if (!isRenderableLayer(scene, activeLayerId)) return false;
  return scene.frameInstances.every((inst) => isRenderableLayer(scene, inst.layerId));
}

interface BuildOptions {
  id: number;
  scene: EditorScene;
  activeLayerId?: string | null;
  width: number;
  height: number;
  pixelRatio: number;
  mimeType: string;
  transform?: RenderTransform;
  frameWidth?: number;
  frameHeight?: number;
  backgroundFill?: string;
}

/**
 * Collects every asset URL the worker needs and packs the render request.
 * Callers must first check `canRenderSceneInWorker`. Returns null when the
 * scene turns out to be unrenderable off-thread after all.
 */
export function buildRenderWorkerPayload(opts: BuildOptions): RenderWorkerPayload | null {
  const { scene } = opts;
  const activeLayerId = opts.activeLayerId ?? scene.activeLayerId;
  if (!canRenderSceneInWorker(scene, activeLayerId)) return null;

  const images: RenderImageSlot[] = [];
  const active = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];

  let overlayUrl: string | null = null;
  if (scene.frameInstances.length === 0) {
    if (active?.mediaUrl) images.push({ key: ACTIVE_MEDIA_KEY, url: active.mediaUrl });
    const spec = getFrameSpec(scene.frame, scene.customFrame, scene.frameMaterial);
    if (spec.isOverlay && spec.asset) overlayUrl = spec.asset;
  } else {
    for (const inst of scene.frameInstances) {
      const layer = scene.layers.find((l) => l.id === inst.layerId);
      if (layer?.mediaUrl) images.push({ key: layer.id, url: layer.mediaUrl });
      const spec = getFrameSpec(inst.frame, scene.customFrame, inst.material);
      if (spec.isOverlay && spec.asset && layer?.id) {
        images.push({ key: `${OVERLAY_KEY_PREFIX}${layer.id}`, url: spec.asset });
      }
    }
  }

  return {
    id: opts.id,
    width: opts.width,
    height: opts.height,
    pixelRatio: opts.pixelRatio,
    mimeType: opts.mimeType,
    scene,
    activeLayerId,
    transform: opts.transform,
    frameWidth: opts.frameWidth,
    frameHeight: opts.frameHeight,
    backgroundFill: opts.backgroundFill,
    images,
    overlayUrl,
    backgroundImageUrl: scene.backgroundMode === "image" ? scene.backgroundImageUrl : null,
    watermarkImageUrl: scene.watermarkEnabled ? scene.watermarkImageUrl : null
  };
}
