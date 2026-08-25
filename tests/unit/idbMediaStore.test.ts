import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
import { createFakeIndexedDB, FakeFileReader, type FakeIdbHandle } from "./helpers/fakeIdb";

const ORIGINAL_WINDOW = globalThis.window;
const ORIGINAL_FILE_READER = globalThis.FileReader;
// crypto is getter-only on some globals; swap it via defineProperty.
const ORIGINAL_CRYPTO = Object.getOwnPropertyDescriptor(globalThis, "crypto");

let idb: FakeIdbHandle;

function installWindow(indexedDB: unknown): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: indexedDB ? { indexedDB } : {}
  });
}

beforeEach(() => {
  idb = createFakeIndexedDB();
  installWindow(idb);
  globalThis.FileReader = FakeFileReader as unknown as typeof FileReader;
});

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: ORIGINAL_WINDOW
  });
  globalThis.FileReader = ORIGINAL_FILE_READER;
  if (ORIGINAL_CRYPTO) {
    Object.defineProperty(globalThis, "crypto", ORIGINAL_CRYPTO);
  }
});

function pngBlob(...bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "image/png" });
}

describe("idbMediaStore blob CRUD", () => {
  it("stores and reads back a blob by key", async () => {
    const blob = pngBlob(1, 2, 3);
    await expect(putMediaBlob("k1", blob)).resolves.toBe(true);
    await expect(getMediaBlob("k1")).resolves.toBe(blob);
    await expect(listMediaKeys()).resolves.toEqual(["k1"]);
  });

  it("returns null for a missing key", async () => {
    await putMediaBlob("k1", pngBlob(1));
    await expect(getMediaBlob("missing")).resolves.toBeNull();
  });

  it("deletes an entry so a later read misses", async () => {
    await putMediaBlob("k1", pngBlob(7));
    await expect(deleteMediaBlob("k1")).resolves.toBe(true);
    await expect(getMediaBlob("k1")).resolves.toBeNull();
    await expect(listMediaKeys()).resolves.toEqual([]);
  });

  it("treats a corrupt (non-blob) entry as missing instead of throwing", async () => {
    (idb._store as unknown as Map<string, string>).set("bad", "not-a-blob");
    await expect(getMediaBlob("bad")).resolves.toBeNull();
  });
});

describe("idbMediaStore failure modes", () => {
  it("reports failure for every op when IndexedDB is unavailable", async () => {
    installWindow(undefined);
    await expect(putMediaBlob("k", pngBlob(1))).resolves.toBe(false);
    await expect(getMediaBlob("k")).resolves.toBeNull();
    // Callers rely on list/get for correctness, not the delete boolean.
    await expect(deleteMediaBlob("k")).resolves.toBe(true);
    await expect(listMediaKeys()).resolves.toEqual([]);
  });

  it("reports false when the open request errors (blocked/private mode)", async () => {
    installWindow({
      open() {
        const req: { onerror?: () => void; onsuccess?: () => void } = {};
        queueMicrotask(() => req.onerror?.());
        return req;
      }
    });
    await expect(putMediaBlob("k", pngBlob(1))).resolves.toBe(false);
    await expect(listMediaKeys()).resolves.toEqual([]);
  });

  it("reports false when the transaction aborts after the write (quota)", async () => {
    // A commit can abort after request success (quota pressure); reporting
    // success then would strand a placeholder with no blob behind it.
    installWindow({
      open() {
        const req: { onsuccess?: () => void; result?: unknown } = {};
        queueMicrotask(() => {
          req.result = {
            objectStoreNames: { contains: () => true },
            transaction() {
              const tx = {
                oncomplete: null as (() => void) | null,
                onabort: null as (() => void) | null,
                onerror: null as (() => void) | null,
                objectStore: () => ({
                  put: (_value: Blob, _key: string) => ({ onsuccess: null as (() => void) | null })
                })
              };
              queueMicrotask(() => tx.onabort?.());
              return tx;
            }
          };
          req.onsuccess?.();
        });
        return req;
      }
    });
    await expect(putMediaBlob("k", pngBlob(1))).resolves.toBe(false);
  });

  it("reports false when the transaction cannot even start", async () => {
    installWindow({
      open() {
        const req: { onsuccess?: () => void; result?: unknown } = {};
        queueMicrotask(() => {
          req.result = {
            objectStoreNames: { contains: () => true },
            transaction() {
              throw new Error("InvalidStateError");
            }
          };
          req.onsuccess?.();
        });
        return req;
      }
    });
    await expect(putMediaBlob("k", pngBlob(1))).resolves.toBe(false);
  });
});

describe("idbMediaStore connection caching", () => {
  it("reuses the cached connection even if window.indexedDB is swapped later", async () => {
    const win: Record<string, unknown> = { indexedDB: idb };
    Object.defineProperty(globalThis, "window", { configurable: true, value: win });
    await putMediaBlob("a", pngBlob(1));

    const second = createFakeIndexedDB();
    win.indexedDB = second;
    await putMediaBlob("b", pngBlob(2));

    // The handle is cached on the window object, so writes keep landing in
    // the original store — swapping the API underneath must not fork data.
    expect(idb._store.has("b")).toBe(true);
    expect(second._store.size).toBe(0);
  });

  it("opens a fresh connection on a new window object", async () => {
    await putMediaBlob("a", pngBlob(1));
    const second = createFakeIndexedDB();
    installWindow(second);
    await putMediaBlob("b", pngBlob(2));
    expect(idb._store.has("b")).toBe(false);
    expect(second._store.has("b")).toBe(true);
  });
});

describe("hashDataUrl", () => {
  it("produces a stable 32-char hex key per payload", async () => {
    const a = await hashDataUrl("data:image/png;base64,AAAA");
    const b = await hashDataUrl("data:image/png;base64,AAAA");
    const c = await hashDataUrl("data:image/png;base64,BBBB");
    expect(a).toMatch(/^[a-f0-9]{32}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("returns null without crypto.subtle (insecure context)", async () => {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });
    await expect(hashDataUrl("data:image/png;base64,AAAA")).resolves.toBeNull();
  });});

describe("data url codec", () => {
  it("round-trips a data URL through blob and back unchanged", async () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    const blob = await dataUrlToBlob(dataUrl);
    expect(blob).toBeInstanceOf(Blob);
    await expect(blobToDataUrl(blob!)).resolves.toBe(dataUrl);
  });

  it("degrades an unfetchable payload to null", async () => {
    await expect(dataUrlToBlob("not-a-url")).resolves.toBeNull();
  });

  it("exposes the placeholder prefix and inline limit used by callers", () => {
    expect(MEDIA_REF_PREFIX).toBe("@idb:");
    expect(INLINE_MEDIA_LIMIT).toBe(64 * 1024);
  });
});
