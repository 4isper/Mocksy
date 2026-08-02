import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Stubs the service-worker global scope so we can load sw.js as a script
 * and inspect the installed handlers.
 */
function mockSwEnv() {
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  const self = {
    location: { origin: "https://mocksy.test" },
    skipWaiting: vi.fn(() => Promise.resolve()),
    clients: { claim: vi.fn(() => Promise.resolve()) },
    addEventListener: vi.fn((type: string, handler: (event: unknown) => void) => {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    }),
    // @ts-expect-error service-worker globals may differ from window
    caches: {
      open: vi.fn(() => Promise.resolve({
        addAll: vi.fn(() => Promise.resolve()),
        put: vi.fn(() => Promise.resolve()),
        match: vi.fn(() => Promise.resolve(undefined)),
        delete: vi.fn(() => Promise.resolve(true)),
      })),
      keys: vi.fn(() => Promise.resolve([])),
      match: vi.fn(() => Promise.resolve(undefined)),
    },
  };
  return { self, listeners };
}

describe("service worker", () => {
  let env: ReturnType<typeof mockSwEnv>;

  beforeEach(async () => {
    env = mockSwEnv();
    vi.stubGlobal("self", env.self);
    await import("@/public/sw.js");
  });

  it("registers install and activate listeners", () => {
    expect(env.self.addEventListener).toHaveBeenCalledWith("install", expect.any(Function));
    expect(env.self.addEventListener).toHaveBeenCalledWith("activate", expect.any(Function));
    expect(env.self.addEventListener).toHaveBeenCalledWith("fetch", expect.any(Function));
  });
});
