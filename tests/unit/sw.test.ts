import { readFileSync } from "node:fs";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";

const swSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const cacheMatch = swSource.match(/const CACHE = "(mocksy-sw-[^"]+)"/);
const cacheName = cacheMatch?.[1];
if (!cacheName) {
  throw new Error("public/sw.js does not contain a versioned CACHE constant");
}
const CACHE = cacheName;
const PRECACHE_URLS = ["/", "/manifest.json", "/icon.svg", "/icon-192.png", "/icon-512.png"];

/** Builds a service-worker global scope backed by an in-memory cache store so
 *  the installed handlers can be invoked and their effects asserted. */
function mockSwEnv() {
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  const store = new Map<string, Response>();
  const keyOf = (req: unknown) => (typeof req === "string" ? req : (req as { url?: string })?.url ?? "");
  const cache = {
    addAll: vi.fn(async (urls: string[]) => {
      for (const url of urls) store.set(url, new Response("ok"));
    }),
    put: vi.fn(async (req: unknown, res: Response) => {
      store.set(keyOf(req), res);
    }),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async (): Promise<string[]> => []),
    delete: vi.fn(async () => true),
    match: vi.fn(async (req: unknown) => store.get(keyOf(req))),
  };
  const self = {
    location: { origin: "https://mocksy.test" },
    skipWaiting: vi.fn(() => Promise.resolve()),
    clients: { claim: vi.fn(() => Promise.resolve()) },
    addEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    }),
  };
  return { self, caches, cache, listeners, store };
}

describe("service worker", () => {
  let env: ReturnType<typeof mockSwEnv>;

  type SwEvent = {
    request?: unknown;
    respondWith?: Mock;
    waitUntil?: (promise: Promise<unknown>) => void;
  };

  const handler = (type: string) => env.listeners.get(type)?.at(-1) as (event: SwEvent) => void;

  function fetchEvent(overrides: Partial<{ method: string; url: string; mode: string }>): SwEvent {
    const event: SwEvent = {
      request: { method: "GET", url: "https://mocksy.test/", mode: "cors", ...overrides },
      respondWith: vi.fn(),
    };
    return event;
  }

  beforeEach(async () => {
    env = mockSwEnv();
    vi.stubGlobal("self", env.self);
    vi.stubGlobal("caches", env.caches);
    vi.resetModules();
    await import("@/public/sw.js");
  });

  it("registers install, activate and fetch listeners", () => {
    expect(env.self.addEventListener).toHaveBeenCalledWith("install", expect.any(Function));
    expect(env.self.addEventListener).toHaveBeenCalledWith("activate", expect.any(Function));
    expect(env.self.addEventListener).toHaveBeenCalledWith("fetch", expect.any(Function));
  });

  it("precaches the core URLs on install and skips waiting", async () => {
    const event = { waitUntil: vi.fn() };
    handler("install")(event);
    await event.waitUntil.mock.calls[0]![0];
    expect(env.caches.open).toHaveBeenCalledWith(CACHE);
    expect(env.cache.addAll).toHaveBeenCalledWith(PRECACHE_URLS);
    expect(env.self.skipWaiting).toHaveBeenCalled();
  });

  it("purges stale caches on activate and claims clients", async () => {
    env.caches.keys.mockResolvedValue([CACHE, "mocksy-sw-v0"]);
    const event = { waitUntil: vi.fn() };
    handler("activate")(event);
    await event.waitUntil.mock.calls[0]![0];
    expect(env.caches.delete).toHaveBeenCalledWith("mocksy-sw-v0");
    expect(env.caches.delete).not.toHaveBeenCalledWith(CACHE);
    expect(env.self.clients.claim).toHaveBeenCalled();
  });

  it("ignores non-GET requests", () => {
    const event = fetchEvent({ method: "POST", url: "https://mocksy.test/api" });
    handler("fetch")(event);
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it("ignores cross-origin requests", () => {
    const event = fetchEvent({ url: "https://other.test/x" });
    handler("fetch")(event);
    expect(event.respondWith).not.toHaveBeenCalled();
  });

  it("serves navigations network-first and updates the cache in background", async () => {
    const html = new Response("<html>ok</html>", { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(html));
    const event = fetchEvent({ url: "https://mocksy.test/", mode: "navigate" });
    handler("fetch")(event);
    const res = await event.respondWith!.mock.calls[0]![0];
    expect(await res.text()).toBe("<html>ok</html>");
    expect(env.cache.put).toHaveBeenCalled();
  });

  it("falls back to the cache for navigations when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    const cached = new Response("<html>cached</html>");
    env.caches.match.mockResolvedValue(cached);
    const event = fetchEvent({ url: "https://mocksy.test/", mode: "navigate" });
    handler("fetch")(event);
    const res = await event.respondWith!.mock.calls[0]![0];
    expect(await res.text()).toBe("<html>cached</html>");
  });

  it("serves Next.js chunks network-first and caches successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("chunk")));
    const event = fetchEvent({ url: "https://mocksy.test/_next/static/chunks/abc.js" });
    handler("fetch")(event);
    const res = await event.respondWith!.mock.calls[0]![0];
    expect(res.status).toBe(200);
    expect(env.cache.put).toHaveBeenCalled();
  });

  it("falls back to a cached chunk when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    const cached = new Response("cached chunk");
    env.caches.match.mockResolvedValue(cached);
    const event = fetchEvent({ url: "https://mocksy.test/_next/static/chunks/abc.js" });
    handler("fetch")(event);
    const res = await event.respondWith!.mock.calls[0]![0];
    expect(await res.text()).toBe("cached chunk");
  });

  it("returns 408 for a chunk that is neither online nor cached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    env.caches.match.mockResolvedValue(undefined);
    const event = fetchEvent({ url: "https://mocksy.test/_next/static/chunks/abc.js" });
    handler("fetch")(event);
    const res = await event.respondWith!.mock.calls[0]![0];
    expect(res.status).toBe(408);
  });

  it("serves immutable assets stale-while-revalidate when cached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("new font")));
    const cached = new Response("cached font");
    env.caches.match.mockResolvedValue(cached);
    const event = fetchEvent({ url: "https://mocksy.test/fonts/foo.woff2" });
    handler("fetch")(event);
    const res = await event.respondWith!.mock.calls[0]![0];
    expect(await res.text()).toBe("cached font");
    expect(vi.mocked(fetch)).toHaveBeenCalled();
  });

  it("fetches and caches immutable assets when not cached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("new font")));
    env.caches.match.mockResolvedValue(undefined);
    const event = fetchEvent({ url: "https://mocksy.test/fonts/foo.woff2" });
    handler("fetch")(event);
    const res = await event.respondWith!.mock.calls[0]![0];
    expect(await res.text()).toBe("new font");
    expect(env.cache.put).toHaveBeenCalled();
  });

  it("matches manifest.json as an immutable asset", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("manifest")));
    env.caches.match.mockResolvedValue(undefined);
    const event = fetchEvent({ url: "https://mocksy.test/manifest.json" });
    handler("fetch")(event);
    const res = await event.respondWith!.mock.calls[0]![0];
    expect(res.status).toBe(200);
  });

  it("returns 408 for an immutable asset that is neither online nor cached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    env.caches.match.mockResolvedValue(undefined);
    const event = fetchEvent({ url: "https://mocksy.test/fonts/foo.woff2" });
    handler("fetch")(event);
    const res = await event.respondWith!.mock.calls[0]![0];
    expect(res.status).toBe(408);
  });

  it("leaves non-matching media requests untouched", () => {
    const event = fetchEvent({ url: "https://mocksy.test/sample-video.mp4" });
    handler("fetch")(event);
    expect(event.respondWith).not.toHaveBeenCalled();
  });
});
