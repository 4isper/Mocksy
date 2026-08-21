/**
 * Minimal faux IndexedDB + FileReader so media-persistence code can run
 * end-to-end in Node. Mirrors just the one access pattern the store uses:
 * open → transaction → objectStore.{get,put,delete,getAllKeys}, each request
 * resolving asynchronously via onsuccess.
 */

/** Fires a request's success handler on the next microtask. */
function fireSuccess(r: { onsuccess?: () => void }): void {
  queueMicrotask(() => r.onsuccess?.());
}

interface IDBRequestLike<T> {
  result?: T;
  onsuccess?: () => void;
  onerror?: () => void;
}

export interface FakeIdbHandle {
  _store: Map<string, Blob>;
  open(): unknown;
}

export function createFakeIndexedDB(): FakeIdbHandle {
  const store = new Map<string, Blob>();
  const makeRequest = <T>(run: () => T | undefined): IDBRequestLike<T> => {
    const r: IDBRequestLike<T> = {};
    queueMicrotask(() => {
      try {
        const value = run();
        // Real IDB resolves misses with `undefined` through success too.
        if (value !== undefined) r.result = value;
        fireSuccess(r);
      } catch {
        fireSuccess(r);
      }
    });
    return r;
  };
  const makeDb = () => ({
    objectStoreNames: { contains: () => true },
    transaction() {
      return {
        objectStore() {
          return {
            get: (key: string) => makeRequest<Blob>(() => store.get(key)),            put: (value: Blob, key: string) =>
              makeRequest<undefined>(() => {
                store.set(key, value);
                return undefined;
              }),
            delete: (key: string) =>
              makeRequest<undefined>(() => {
                store.delete(key);
                return undefined;
              }),
            getAllKeys: () => makeRequest<string[]>(() => [...store.keys()])
          };
        }
      };
    }
  });
  return {
    _store: store,
    open() {
      const req: { onupgradeneeded?: () => void; onsuccess?: () => void; onerror?: () => void; result?: unknown } = {};
      queueMicrotask(() => {
        req.result = makeDb();
        fireSuccess(req);
      });
      return req;
    }
  };
}

export class FakeFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob): void {
    blob.arrayBuffer().then(
      (buf) => {
        const b64 = Buffer.from(new Uint8Array(buf)).toString("base64");
        this.result = `data:${blob.type || "application/octet-stream"};base64,${b64}`;
        queueMicrotask(() => this.onload?.());
      },
      () => this.onerror?.()
    );
  }
}
