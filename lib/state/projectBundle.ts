"use client";

import type { EditorScene, Project } from "@/lib/types/editor";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { nextProjectId } from "@/lib/state/ids";
import { sanitizeFilename } from "@/lib/export/filename";
import { visitSceneMedia } from "@/lib/state/mediaPersistence";
import { blobToDataUrl, dataUrlToBlob, hashDataUrl } from "@/lib/media/idbMediaStore";

/**
 * Portable project bundles (.mocksy.zip): the full project — scene AND media
 * payloads — packed as project.json plus one deduped file per unique asset
 * under media/. Media fields carry `@media:<hash>.<ext>` references instead of
 * inline data URLs, so the JSON stays readable and identical assets (the same
 * screenshot in several layers) are stored once. Import resolves references
 * back into data: URLs, the exact representation the rest of the app uses.
 */

export const PROJECT_BUNDLE_FORMAT = "mocksy-project-bundle";
export const PROJECT_BUNDLE_VERSION = 1;
export const BUNDLE_MEDIA_REF_PREFIX = "@media:";
export const BUNDLE_MEDIA_DIR = "media";
/** Bundles carry real media files (videos included), so the cap is far above
 *  the 5 MB JSON limit — but bounded to keep a bad import from freezing the tab. */
export const MAX_BUNDLE_FILE_SIZE = 256 * 1024 * 1024;

const BUNDLE_JSON_ENTRY = "project.json";

type MediaHolder = Record<string, unknown>;

const MIME_EXTENSIONS: Array<[string, string]> = [
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
  ["image/avif", "avif"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
  ["audio/mpeg", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/ogg", "ogg"],
  ["audio/mp4", "m4a"]
];

function extensionForMime(mime: string): string {
  const lower = mime.split(";")[0]!.trim().toLowerCase();
  for (const [prefix, ext] of MIME_EXTENSIONS) {
    if (lower === prefix) return ext;
  }
  return "bin";
}

/** ZIP archives don't carry per-entry MIME types, so the extension chosen at
 *  export time is the source of truth on import. */
export function mimeForExtension(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  for (const [prefix, e] of MIME_EXTENSIONS) {
    if (ext === e) return prefix;
  }
  return "application/octet-stream";
}

function mimeOfDataUrl(dataUrl: string): string | null {
  const match = /^data:([^;,]+)/.exec(dataUrl);
  return match ? match[1]! : null;
}

/** File name for one archived asset, e.g. "3f9a….png". Exported for tests. */
export function bundleEntryName(hash: string, mime: string): string {
  return `${hash}.${extensionForMime(mime)}`;
}

/** True when the value is an inline data URL eligible for bundling. */
function isInlineData(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

/**
 * Replaces every inline data URL in the scene with an `@media:` reference,
 * adding the corresponding blob to `sink` (deduped by content hash). Fields
 * that can't be hashed or converted keep their inline data URL rather than
 * being lost. Pure w.r.t. the input scene.
 */
export async function bundleSceneMedia<T extends EditorScene>(scene: T, sink: Map<string, Blob>): Promise<T> {
  // Clone every holder the visitor may mutate — the input shares those objects
  // with live editor state (same reason encodeSceneMedia clones).
  const result: T = {
    ...scene,
    ...(Array.isArray(scene.layers) ? { layers: scene.layers.map((l) => ({ ...l })) } : {}),
    ...(scene.customFrame && typeof scene.customFrame === "object" ? { customFrame: { ...scene.customFrame } } : {})
  };
  const pending: Array<Promise<void>> = [];

  visitSceneMedia(result, (holder, prop) => {
    const value = holder[prop];
    if (!isInlineData(value)) return;
    const source = value;
    pending.push(
      (async () => {
        const hash = await hashDataUrl(source);
        if (!hash) return; // no secure context — keep inline
        const name = bundleEntryName(hash, mimeOfDataUrl(source) ?? "");
        if (!sink.has(name)) {
          const blob = await dataUrlToBlob(source);
          if (!blob) return; // conversion failure keeps this field inline
          sink.set(name, blob);
        }
        holder[prop] = BUNDLE_MEDIA_REF_PREFIX + name;
      })()
    );
  });

  await Promise.all(pending);
  return result;
}

/** Only safe archive entry names pass: `<hex>.<ext>` produced by bundleEntryName. */
const ENTRY_NAME_RE = /^[0-9a-f]{32}\.[a-z0-9]+$/i;

/**
 * Resolves `@media:` references in a parsed scene back into data: URLs using
 * `lookup(name)`. Missing blobs degrade that field to null media instead of a
 * dead reference (mirrors decodeSceneMedia's contract).
 */
export async function resolveBundleMedia<T extends Record<string, unknown>>(
  scene: T,
  lookup: (name: string) => Promise<Blob | null>
): Promise<T> {
  const result: T = { ...scene };
  const pending: Array<Promise<void>> = [];

  visitSceneMedia(result, (holder, prop) => {
    const value = holder[prop];
    if (typeof value !== "string" || !value.startsWith(BUNDLE_MEDIA_REF_PREFIX)) return;
    const name = value.slice(BUNDLE_MEDIA_REF_PREFIX.length);
    if (!ENTRY_NAME_RE.test(name)) {
      holder[prop] = null;
      return;
    }
    pending.push(
      (async () => {
        const blob = await lookup(name);
        if (!blob) {
          holder[prop] = null;
          return;
        }
        const dataUrl = await blobToDataUrl(blob);
        holder[prop] = dataUrl ?? null;
      })()
    );
  });

  await Promise.all(pending);
  return result;
}

interface BundlePayload {
  format?: unknown;
  version?: unknown;
  name?: unknown;
  scene?: unknown;
}

/** Triggers a browser download of the project as a .mocksy.zip bundle. */
export async function exportProjectBundle(project: Project): Promise<void> {
  const sink = new Map<string, Blob>();
  const scene = await bundleSceneMedia(project.scene, sink);

  const payload: BundlePayload = {
    format: PROJECT_BUNDLE_FORMAT,
    version: PROJECT_BUNDLE_VERSION,
    name: project.name,
    scene
  };

  const [{ default: JSZip }] = await Promise.all([import("jszip")]);
  const zip = new JSZip();
  zip.file(BUNDLE_JSON_ENTRY, JSON.stringify(payload, null, 2));
  for (const [name, blob] of sink) {
    zip.file(`${BUNDLE_MEDIA_DIR}/${name}`, blob);
  }

  const archive = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(archive);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(project.name) || "mocksy-project"}.mocksy.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

export function isBundleFile(file: { name: string; type?: string }): boolean {
  return file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip";
}

/**
 * Reads a .mocksy.zip bundle and returns a normalized Project with all media
 * restored as data: URLs. Throws when the archive has no project.json, the
 * format marker mismatches, or the file exceeds MAX_BUNDLE_FILE_SIZE.
 */
export async function importProjectBundle(file: File): Promise<Project> {
  if (file.size > MAX_BUNDLE_FILE_SIZE) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_BUNDLE_FILE_SIZE / 1024 / 1024} MB.`);
  }

  const { default: JSZip } = await import("jszip");
  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error("Not a valid ZIP archive.");
  }

  const jsonEntry = zip.file(BUNDLE_JSON_ENTRY);
  if (!jsonEntry) throw new Error("project.json not found in the bundle.");

  let parsed: BundlePayload | null;
  try {
    parsed = JSON.parse(await jsonEntry.async("string")) as BundlePayload | null;
  } catch {
    throw new Error("project.json inside the bundle is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Not a valid project bundle.");
  if (parsed.format != null && parsed.format !== PROJECT_BUNDLE_FORMAT) {
    throw new Error(`Unsupported bundle format: ${String(parsed.format)}`);
  }
  if (!parsed.scene || typeof parsed.scene !== "object") throw new Error("The bundle carries no scene.");

  const resolvedScene = await resolveBundleMedia(parsed.scene as Record<string, unknown>, async (name) => {
    const entry = zip.file(`${BUNDLE_MEDIA_DIR}/${name}`);
    if (!entry) return null;
    // Rebuild with an explicit type: archive entries don't carry MIME info.
    const bytes = await entry.async("arraybuffer");
    return new Blob([bytes], { type: mimeForExtension(name) });
  });

  const scene = normalizeScene(resolvedScene as unknown as EditorScene);
  const name =
    typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : (file.name.replace(/\.mocksy\.zip$|\.zip$/i, "") || "Imported mockup");

  return {
    id: nextProjectId(),
    name,
    scene,
    updatedAt: Date.now()
  };
}
