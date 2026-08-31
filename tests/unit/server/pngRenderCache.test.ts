import { describe, expect, it } from "vitest";
import { CACHE_MAX, CACHE_MAX_BYTES, PngCache } from "@/lib/server/pngRender";

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

  it("evicts oldest entries when the byte budget is exceeded even under CACHE_MAX", () => {
    const cache = new PngCache();
    // Fewer than CACHE_MAX entries, but each far above the byte budget —
    // count-only bounds would let dozens of 8K PNGs pin gigabytes of RSS.
    const big = Buffer.alloc(CACHE_MAX_BYTES + 1);
    cache.set("a", big);
    cache.set("b", Buffer.from([1]));
    // The oversized entry alone exceeds the budget; it is kept (size > 1
    // guard) but any further entry pushes it out.
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).not.toBeNull();
  });
});