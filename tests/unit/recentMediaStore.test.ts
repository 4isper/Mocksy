// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecentMediaStore } from "@/lib/state/recentMediaStore";

function persistedEntries() {
  const options = useRecentMediaStore.persist.getOptions();
  return options.partialize!(useRecentMediaStore.getState()).entries;
}

describe("recentMediaStore persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return (this as unknown as { store: Record<string, string> }).store[key] ?? null;
      },
      setItem(key: string, value: string) {
        (this as unknown as { store: Record<string, string> }).store[key] = value;
      },
      removeItem(key: string) {
        delete (this as unknown as { store: Record<string, string> }).store[key];
      }
    });
  });

  afterEach(() => {
    useRecentMediaStore.getState().clearAll();
    vi.unstubAllGlobals();
  });

  it("keeps small entries in memory and in the persisted payload", () => {
    useRecentMediaStore.getState().addEntry("data:image/png;base64,AAA", "image", "small.png");
    expect(useRecentMediaStore.getState().entries).toHaveLength(1);
    expect(persistedEntries()).toHaveLength(1);
    expect(persistedEntries()[0]?.dataUrl).toBe("data:image/png;base64,AAA");
  });

  it("keeps oversized data URLs in memory but drops them from persistence", () => {
    const big = `data:image/png;base64,${"A".repeat(5000)}`;
    useRecentMediaStore.getState().addEntry(big, "image", "big.png");
    expect(useRecentMediaStore.getState().entries).toHaveLength(1);
    expect(persistedEntries()).toHaveLength(0);
  });

  it("never persists a truncated (invalid) data URL", () => {
    const big = `data:image/png;base64,${"A".repeat(5000)}`;
    useRecentMediaStore.getState().addEntry(big, "image", null);
    for (const entry of persistedEntries()) {
      expect(entry.dataUrl.length).toBeLessThanOrEqual(4096);
    }
  });
});
