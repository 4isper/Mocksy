"use client";

import type { EditorScene, Project } from "@/lib/types/editor";
import {
  INLINE_MEDIA_LIMIT,
  MEDIA_REF_PREFIX,
  blobToDataUrl,
  dataUrlToBlob,
  deleteMediaBlob,
  getMediaBlob,
  hashDataUrl,
  listMediaKeys,
  putMediaBlob
} from "@/lib/media/idbMediaStore";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { nextProjectId } from "@/lib/state/ids";

/**
 * Persistence-layer codec that keeps large media out of localStorage: when a
 * scene is written, data: URLs above INLINE_MEDIA_LIMIT are swapped for
 * `@idb:<hash>` placeholders while the raw blobs land in IndexedDB (deduped by
 * content hash). Reading swaps them back. The rest of the app — renderers,
 * exports, undo history, share URLs — only ever sees regular data: URLs, so
 * nothing else needs to know the store exists.
 *
 * Degradation contract: if IndexedDB or crypto.subtle is unavailable, encoding
 * reports failure and callers write fully-inline JSON exactly like before.
 */

type MediaHolder = Record<string, unknown>;

/** Calls `visit` for every media-URL field of the scene (layers, background
 *  image, watermark logo, background audio, custom frame asset). */
function visitSceneMedia(scene: unknown, visit: (holder: MediaHolder, prop: string) => void): void {
  if (!scene || typeof scene !== "object") return;
  const s = scene as MediaHolder;
  if (Array.isArray(s.layers)) {
    for (const layer of s.layers) {
      if (layer && typeof layer === "object") visit(layer as MediaHolder, "mediaUrl");
    }
  }
  visit(s, "backgroundImageUrl");
  visit(s, "watermarkImageUrl");
  visit(s, "backgroundAudioUrl");
  if (s.customFrame && typeof s.customFrame === "object") {
    visit(s.customFrame as MediaHolder, "asset");
  }
}

/** True when the value is an offloadable payload (big inline data URL). */
function isOffloadable(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:") && value.length > INLINE_MEDIA_LIMIT;
}

/** Fast pre-check so persistence can skip the async encode entirely when no
 *  scene carries large media — the common case keeps its synchronous write. */
export function stateNeedsMediaOffload(state: PersistedProjectsState): boolean {
  let found = false;
  for (const project of state.projects) {
    visitSceneMedia(project.scene, (holder, prop) => {
      if (!found && isOffloadable(holder[prop])) found = true;
    });
    if (found) break;
  }
  return found;
}

/**
 * Replaces every large data: URL in the scene with an `@idb:` placeholder,
 * adding the corresponding blob to `sink` (deduped by content hash). Returns
 * the scene unchanged when hashing/conversion is not possible for a field.
 */
export async function encodeSceneMedia<T extends EditorScene>(scene: T, sink: Map<string, Blob>): Promise<T> {
  // Clone every holder the visitor may mutate (layers, customFrame): the input
  // shares those objects with live state — the editor scene, undo history and
  // the other projects in the store — and replacing mediaUrl with a placeholder
  // in place would corrupt them (broken previews until the next reload).
  const result: T = {
    ...scene,
    ...(Array.isArray(scene.layers)
      ? { layers: scene.layers.map((l) => ({ ...l })) }
      : {}),
    ...(scene.customFrame && typeof scene.customFrame === "object"
      ? { customFrame: { ...scene.customFrame } }
      : {})
  };
  const pending: Array<Promise<void>> = [];

  visitSceneMedia(result, (holder, prop) => {
    const value = holder[prop];
    if (!isOffloadable(value)) return;
    const source = value;
    pending.push(
      (async () => {
        const hash = await hashDataUrl(source);
        if (!hash) return; // no secure context — keep inline
        const key = hash;
        if (!sink.has(key)) {
          const blob = await dataUrlToBlob(source);
          // Conversion failure keeps this field inline rather than losing it.
          if (!blob) return;
          sink.set(key, blob);
        }
        holder[prop] = MEDIA_REF_PREFIX + key;
      })()
    );
  });

  await Promise.all(pending);
  return result;
}

/** Resolves `@idb:` placeholders in a parsed scene back into data: URLs.
 *  Blobs that went missing (manual IndexedDB cleanup) degrade to null media
 *  instead of dead references. */
export async function decodeSceneMedia(scene: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...scene };
  const pending: Array<Promise<void>> = [];

  visitSceneMedia(result, (holder, prop) => {
    const value = holder[prop];
    if (typeof value !== "string" || !value.startsWith(MEDIA_REF_PREFIX)) return;
    const key = value.slice(MEDIA_REF_PREFIX.length);
    pending.push(
      (async () => {
        const blob = await getMediaBlob(key);
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

export interface PersistedProjectsState {
  projects: Project[];
  activeProjectId: string | null;
}

/**
 * Encodes the whole projects state for localStorage. Returns null when any
 * part could not be offloaded (no IndexedDB, conversion failure) so the caller
 * can fall back to the legacy fully-inline write instead of storing dead
 * references.
 */
export async function encodeProjectsState(state: PersistedProjectsState): Promise<string | null> {
  const sink = new Map<string, Blob>();
  try {
    const encodedProjects = await Promise.all(
      state.projects.map(async (project) => ({
        ...project,
        scene: await encodeSceneMedia(project.scene, sink)
      }))
    );

    if (sink.size > 0) {
      const puts = await Promise.all([...sink.entries()].map(([key, blob]) => putMediaBlob(key, blob)));
      // A single failed put would strand its placeholder → write inline instead.
      if (!puts.every(Boolean)) return null;
    }

    return JSON.stringify({ projects: encodedProjects, activeProjectId: state.activeProjectId });
  } catch {
    return null;
  }
}

/** Parses and decodes a stored projects JSON (placeholder → data: URLs, then
 *  the same scene normalization the sync reader applies). Returns null when
 *  there is nothing usable — callers fall back to the legacy parse. */
export async function decodeProjectsState(raw: string | null): Promise<PersistedProjectsState | null> {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  try {
    const state = parsed as Record<string, unknown>;
    if (!Array.isArray(state.projects)) return null;
    const projects: Project[] = (
      await Promise.all(
        (state.projects as unknown[]).map(async (p): Promise<Project | null> => {
          if (!p || typeof p !== "object") return null;
          const r = p as Record<string, unknown>;
          if (!r.scene || typeof r.scene !== "object") return null;
          const decoded = await decodeSceneMedia(r.scene as Record<string, unknown>);
          return {
            id: typeof r.id === "string" && r.id.length > 0 ? r.id : nextProjectId(),
            name: typeof r.name === "string" && r.name.length > 0 ? r.name : "Untitled",
            scene: normalizeScene(decoded as unknown as EditorScene),
            updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
            ...(typeof r.deletedAt === "number" ? { deletedAt: r.deletedAt } : {})
          };
        })
      )
    ).filter((p): p is Project => p !== null);
    if (projects.length === 0) return null;
    const activeProjectId =
      typeof state.activeProjectId === "string" && projects.some((p) => p.id === state.activeProjectId)
        ? state.activeProjectId
        : projects[0]!.id;
    return { projects, activeProjectId };
  } catch {
    return null;
  }
}

/** Deletes IndexedDB blobs no longer referenced by any stored project
 *  (deleted scenes, replaced uploads). Runs once per load after decoding.
 *  `readFreshRaw` re-snapshots the raw localStorage JSON at deletion time:
 *  a concurrent persist (share-link bootstrap, another tab) may offload new
 *  blobs while we await listMediaKeys — deleting against the stale load-time
 *  snapshot would strand those fresh placeholders with no blob behind them. */
export async function sweepOrphanedMedia(
  state: PersistedProjectsState | null,
  readFreshRaw?: () => string | null
): Promise<number> {
  const referenced = new Set<string>();
  const collect = (scene: unknown) =>
    visitSceneMedia(scene, (holder, prop) => {
      const value = holder[prop];
      if (typeof value === "string" && value.startsWith(MEDIA_REF_PREFIX)) {
        referenced.add(value.slice(MEDIA_REF_PREFIX.length));
      }
    });
  if (state) for (const p of state.projects) collect(p.scene);

  const keys = await listMediaKeys();
  if (readFreshRaw) {
    let raw: string | null = null;
    try {
      raw = readFreshRaw();
    } catch {
      raw = null;
    }
    if (raw) {
      // Textual scan is enough — placeholders are plain "@idb:<hex>" strings.
      for (const match of raw.matchAll(/@idb:([0-9a-f]+)/g)) {
        referenced.add(match[1]!);
      }
    }
  }
  const orphans = keys.filter((k) => !referenced.has(k));
  for (const key of orphans) await deleteMediaBlob(key);
  return orphans.length;
}
