"use client";

/**
 * Tiny IndexedDB blob store used to keep large media out of localStorage.
 * Blobs are keyed by content hash so identical media (shared across layers or
 * projects) is stored once. Every call degrades gracefully: when IndexedDB is
 * unavailable (SSR, private mode, disabled storage) the helpers report failure
 * and callers fall back to inlining data URLs as before.
 */

const DB_NAME = "mocksy-media";
const DB_VERSION = 1;
const STORE = "blobs";

export const MEDIA_REF_PREFIX = "@idb:";
/** Data URLs above this size are offloaded to IndexedDB; smaller ones stay
 *  inline (they cost less than the placeholder round-trip). */
export const INLINE_MEDIA_LIMIT = 64 * 1024;

type MediaDbWindow = Window & { __mocksyMediaDb?: Promise<IDBDatabase | null> };

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  // The handle is cached on the window (not module scope) so it follows the
  // active global — tests swap in fresh fakes, private mode may swap out.
  const w = window as MediaDbWindow;
  if (!w.__mocksyMediaDb) {
    w.__mocksyMediaDb = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return w.__mocksyMediaDb;
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putMediaBlob(key: string, blob: Blob): Promise<boolean> {
  const result = await withStore<void>("readwrite", (store) => store.put(blob, key));
  return result !== null;
}

export async function getMediaBlob(key: string): Promise<Blob | null> {
  const result = await withStore<Blob>("readonly", (store) => store.get(key));
  return result instanceof Blob ? result : null;
}

export async function deleteMediaBlob(key: string): Promise<boolean> {
  await withStore<undefined>("readwrite", (store) => store.delete(key));
  return true;
}

export async function listMediaKeys(): Promise<string[]> {
  const result = await withStore<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
  return Array.isArray(result) ? result.filter((k): k is string => typeof k === "string") : [];
}

/** SHA-256 of the payload, hex-encoded (first 32 chars — collision-safe for
 *  a local cache and keeps keys readable in DevTools). */
export async function hashDataUrl(dataUrl: string): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(dataUrl);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  } catch {
    // crypto.subtle requires a secure context; degrade to no-offload.
    return null;
  }
}

export function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  return fetch(dataUrl)
    .then((res) => res.blob())
    .catch(() => null);
}

export function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    } catch {
      resolve(null);
    }
  });
}
