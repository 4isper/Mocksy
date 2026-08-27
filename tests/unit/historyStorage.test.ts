import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialScene, makeDemoScene, useEditorStore } from "@/lib/state/editorStore";
import {
  clearPersistedHistory,
  initHistoryPersistence,
  persistHistory,
  readHistory,
  restoreHistory,
  trimHistoryForStorage
} from "@/lib/state/historyStorage";
import type { EditorScene } from "@/lib/types/editor";

const ORIGINAL_WINDOW = globalThis.window;

function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    raw: map
  };
}

function stubWindow(storage: ReturnType<typeof makeStorage>) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  });
}

function restoreRealWindow() {
  Object.defineProperty(globalThis, "window", { configurable: true, value: ORIGINAL_WINDOW });
}

/** A valid scene with a controllable-size media payload. */
function scene(seed: string, mediaSize = 200): EditorScene {
  const demo = makeDemoScene();
  return {
    ...demo,
    activeLayerId: "l-1",
    layers: [
      {
        ...demo.layers[0]!,
        id: "l-1",
        mediaUrl: `data:image/svg+xml;base64,${"A".repeat(mediaSize)}`,
        mediaName: `scene-${seed}`
      }
    ]
  };
}

describe("trimHistoryForStorage", () => {
  it("keeps history that fits the budget intact", () => {
    const past = [scene("a"), scene("b")];
    const future = [scene("c")];
    expect(trimHistoryForStorage(past, future, 100_000)).toEqual({ past, future });
  });

  it("drops the redo stack before any undo entries", () => {
    const past = [scene("a")];
    const future = [scene("f1"), scene("f2")];
    const budget = JSON.stringify({ past: [past[0]], future: [] }).length;
    const result = trimHistoryForStorage(past, future, budget);
    expect(result).not.toBeNull();
    expect(result!.past).toEqual(past);
    expect(result!.future).toEqual([]);
  });

  it("drops oldest undo entries, keeping the most recent", () => {
    const past = [scene("old"), scene("mid"), scene("new")];
    const budget = JSON.stringify({ past: [past[1], past[2]], future: [] }).length;
    const result = trimHistoryForStorage(past, [], budget);
    expect(result).not.toBeNull();
    expect(result!.past.length).toBeLessThan(3);
    expect(result!.past[result!.past.length - 1]).toEqual(past[2]);
  });

  it("returns null when a single snapshot cannot fit", () => {
    const big = scene("big", 5_000);
    expect(trimHistoryForStorage([big], [], 100)).toBeNull();
  });

  it("handles empty stacks", () => {
    expect(trimHistoryForStorage([], [], 1000)).toEqual({ past: [], future: [] });
  });
});

describe("persistHistory / readHistory", () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
    stubWindow(storage);
  });

  afterEach(() => {
    restoreRealWindow();
    vi.unstubAllGlobals();
  });

  it("round-trips the undo stack through localStorage", () => {
    const past = [scene("a"), scene("b")];
    const future = [scene("c")];
    persistHistory(past, future);
    const restored = readHistory();
    expect(restored?.past.map((s) => s.layers[0]?.mediaName)).toEqual(["scene-a", "scene-b"]);
    expect(restored?.future.map((s) => s.layers[0]?.mediaName)).toEqual(["scene-c"]);
  });

  it("returns null when nothing was stored", () => {
    expect(readHistory()).toBeNull();
  });

  it("returns null for a corrupted payload", () => {
    storage.setItem("mocksy-history", "not json");
    expect(readHistory()).toBeNull();
    storage.setItem("mocksy-history", JSON.stringify({ past: "nope", future: [] }));
    expect(readHistory()).toBeNull();
  });

  it("normalizes tampered snapshots on read", () => {
    storage.setItem(
      "mocksy-history",
      JSON.stringify({ past: [{ ...scene("a"), frame: "not-a-frame" }], future: [] })
    );
    const restored = readHistory();
    expect(restored?.past[0]?.frame).toBe("iphone");
  });

  it("swallows quota errors without throwing", () => {
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(() => persistHistory([scene("a")], [])).not.toThrow();
  });

  it("skips writing when snapshots exceed the size budget", () => {
    const huge = scene("huge", 2_000_000);
    persistHistory([huge], []);
    expect(storage.raw.has("mocksy-history")).toBe(false);
  });

  it("restoreHistory fills the store's undo stack", () => {
    persistHistory([scene("a"), scene("b")], [scene("c")]);
    useEditorStore.setState({ past: [], future: [] });
    restoreHistory();
    const state = useEditorStore.getState();
    expect(state.past.map((s) => s.layers[0]?.mediaName)).toEqual(["scene-a", "scene-b"]);
    expect(state.future.map((s) => s.layers[0]?.mediaName)).toEqual(["scene-c"]);
  });

  it("clearPersistedHistory drops the stored stack so it can't be restored later", () => {
    persistHistory([scene("a")], []);
    expect(readHistory()?.past).toHaveLength(1);
    clearPersistedHistory();
    expect(readHistory()).toBeNull();
  });

  it("clearPersistedHistory is a no-op when nothing was stored", () => {
    expect(() => clearPersistedHistory()).not.toThrow();
    expect(readHistory()).toBeNull();
  });

  it("initHistoryPersistence debounces writes on stack changes", () => {
    vi.useFakeTimers();
    const dispose = initHistoryPersistence();
    try {
      useEditorStore.setState({ past: [], future: [], scene: { ...initialScene } });
      useEditorStore.getState().setScene({ backgroundColor: "#112233" });
      expect(storage.raw.has("mocksy-history")).toBe(false);
      vi.advanceTimersByTime(600);
      const stored = JSON.parse(storage.raw.get("mocksy-history")!) as { past: EditorScene[] };
      expect(stored.past).toHaveLength(1);
      expect(stored.past[0]!.backgroundColor).toBe("#111827");
    } finally {
      dispose();
      vi.useRealTimers();
    }
  });

  it("flushes the pending write on dispose and stops watching afterwards", () => {
    vi.useFakeTimers();
    const dispose = initHistoryPersistence();
    useEditorStore.setState({ past: [], future: [], scene: { ...initialScene } });
    useEditorStore.getState().setScene({ backgroundColor: "#112233" });
    // Disposing before the debounce elapses must FLUSH the pending write, not
    // drop it — an SPA unmount would otherwise lose the latest undo steps and
    // the next mount would restore a stale stack.
    dispose();
    expect(storage.raw.has("mocksy-history")).toBe(true);
    const stored = JSON.parse(storage.raw.get("mocksy-history")!) as { past: EditorScene[] };
    expect(stored.past[0]!.backgroundColor).toBe("#111827");
    // After dispose, further stack changes are no longer persisted.
    useEditorStore.getState().setScene({ backgroundColor: "#223344" });
    vi.advanceTimersByTime(1000);
    const after = JSON.parse(storage.raw.get("mocksy-history")!) as { past: EditorScene[] };
    expect(after).toEqual(stored);
    vi.useRealTimers();
  });
});
