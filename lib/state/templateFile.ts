"use client";

import type { EditorScene, MediaLayer } from "@/lib/types/editor";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { sanitizeFilename } from "@/lib/export/filename";

/**
 * Shareable scene templates (.mocksy.json): the scene's appearance (frame,
 * style, background, chrome, annotations) without any media payloads, so the
 * file stays small enough to share while everything visual about the mockup
 * survives the trip. Media is stripped both on export and on import (a full
 * project JSON dropped here still yields a media-free template).
 */

export const TEMPLATE_FORMAT = "mocksy-template";
export const TEMPLATE_VERSION = 1;

function stripLayer(layer: MediaLayer): MediaLayer {
  return {
    ...layer,
    mediaUrl: null,
    // An empty layer must stay empty through normalization (see
    // normalizeLayer), so clear the media type along with the URL.
    mediaType: "none",
    mediaName: null
  };
}

/** Returns a copy of the scene with every media payload removed. Pure. */
export function stripSceneMedia(scene: EditorScene): EditorScene {
  return {
    ...scene,
    layers: scene.layers.map(stripLayer),
    backgroundImageUrl: null,
    backgroundAudioUrl: null,
    backgroundAudioName: null,
    watermarkImageUrl: null
  };
}

interface TemplatePayload {
  format?: unknown;
  version?: unknown;
  name?: unknown;
  scene?: unknown;
}

/** Triggers a browser download of the current scene as a .mocksy.json template. */
export function exportTemplateToFile(scene: EditorScene, name = "mocksy-template"): void {
  const payload: TemplatePayload = {
    format: TEMPLATE_FORMAT,
    version: TEMPLATE_VERSION,
    name,
    scene: stripSceneMedia(scene)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(name) || "mocksy-template"}.mocksy.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Reads a .mocksy.json template (or any JSON carrying a scene) and resolves
 * with a normalized, media-free scene ready for setScene. Throws when the
 * file can't be parsed or exceeds the same 5 MB cap as project files.
 */
export async function importTemplateFromFile(file: File): Promise<EditorScene> {
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
  }
  const parsed = JSON.parse(await file.text()) as TemplatePayload | null;
  if (!parsed || typeof parsed !== "object") throw new Error("Not a valid template file.");
  if (parsed.format != null && parsed.format !== TEMPLATE_FORMAT) {
    throw new Error(`Unsupported template format: ${String(parsed.format)}`);
  }
  const scene = normalizeScene(parsed.scene ?? parsed);
  return stripSceneMedia(scene);
}
