import { describe, expect, it } from "vitest";
import { CACHE_MAX, PngCache } from "@/lib/server/pngRender";

describe("PngCache", () => {
  it("returns null for a missing key", () => {
    const cache = new PngCache();
    expect(cache.get("nope")).toBeNull();
  });

  it("returns a stored buffer", () => {
    const cache = new PngCache();
    cache.set("a", Buffer.from("bytes"));
    expect(cache.get("a")).toEqual(Buffer.from("bytes"));
  });

  it("evicts the least-recently-used entry when full", () => {
    const cache = new PngCache();
    for (let i = 0; i < CACHE_MAX; i++) cache.set(`k${i}`, Buffer.from([i]));
    cache.set("fresh", Buffer.from([99]));
    expect(cache.get("k0")).toBeNull();
    expect(cache.get("fresh")).toEqual(Buffer.from([99]));
  });

  it("promotes a read key so it survives eviction", () => {
    const cache = new PngCache();
    for (let i = 0; i < CACHE_MAX; i++) cache.set(`k${i}`, Buffer.from([i]));
    expect(cache.get("k0")).toBeTruthy();
    cache.set("fresh", Buffer.from([99]));
    expect(cache.get("k0")).not.toBeNull();
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("fresh")).toEqual(Buffer.from([99]));
  });

  it("keeps at most CACHE_MAX entries", () => {
    const cache = new PngCache();
    for (let i = 0; i < CACHE_MAX * 2; i++) cache.set(`k${i}`, Buffer.from([i]));
    let count = 0;
    for (let i = CACHE_MAX * 2 - 1; i >= 0; i--) if (cache.get(`k${i}`) !== null) count++;
    expect(count).toBe(CACHE_MAX);
  });
});