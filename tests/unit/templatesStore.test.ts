import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_LOCALSTORAGE = globalThis.localStorage;

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

const storage = makeStorage();

vi.stubGlobal("localStorage", storage);
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: storage }
});

const { MAX_USER_TEMPLATES, resetTemplatesStoreForTests, useTemplatesStore } = await import(
  "@/lib/state/templatesStore"
);
import type { EditorScene } from "@/lib/types/editor";

function makeScene(overrides: Record<string, unknown> = {}) {
  return {
    frame: "iphone",
    backgroundMode: "solid",
    backgroundColor: "#112233",
    layers: [
      {
        id: "layer-1",
        mediaUrl: "data:image/png;base64,AAAA",
        mediaType: "image",
        mediaName: "shot.png",
        x: 10,
        y: 20
      }
    ],
    activeLayerId: "layer-1",
    ...overrides
  } as unknown as EditorScene;
}

describe("templatesStore", () => {
  beforeEach(() => {
    storage.clear();
    resetTemplatesStoreForTests();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: ORIGINAL_LOCALSTORAGE });
    vi.unstubAllGlobals();
  });

  it("hydrate starts empty with no stored data and flags hydrated", () => {
    useTemplatesStore.getState().hydrate();
    const state = useTemplatesStore.getState();
    expect(state.templates).toEqual([]);
    expect(state.hydrated).toBe(true);
  });

  it("saveTemplate strips media payloads from the stored scene", () => {
    const id = useTemplatesStore.getState().saveTemplate(makeScene(), "Dark studio");
    expect(id).not.toBeNull();
    const tpl = useTemplatesStore.getState().templates[0]!;
    expect(tpl.name).toBe("Dark studio");
    expect(tpl.scene.layers[0]!.mediaUrl).toBeNull();
    expect(tpl.scene.layers[0]!.mediaType).toBe("none");
    expect(tpl.scene.layers[0]!.mediaName).toBeNull();
  });

  it("saveTemplate trims whitespace and falls back to Untitled", () => {
    useTemplatesStore.getState().saveTemplate(makeScene(), "   ");
    expect(useTemplatesStore.getState().templates[0]!.name).toBe("Untitled");
    useTemplatesStore.getState().saveTemplate(makeScene(), "  Padded  ");
    expect(useTemplatesStore.getState().templates[0]!.name).toBe("Padded");
  });

  it("newest template appears first", () => {
    const store = useTemplatesStore.getState();
    store.saveTemplate(makeScene({ backgroundColor: "#000000" }), "first");
    store.saveTemplate(makeScene({ backgroundColor: "#ffffff" }), "second");
    expect(useTemplatesStore.getState().templates.map((t) => t.name)).toEqual(["second", "first"]);
  });

  it("persists to localStorage and hydrate restores entries", () => {
    useTemplatesStore.getState().saveTemplate(makeScene(), "Persisted");
    resetTemplatesStoreForTests();
    expect(useTemplatesStore.getState().templates).toEqual([]);
    useTemplatesStore.getState().hydrate();
    expect(useTemplatesStore.getState().templates).toHaveLength(1);
    expect(useTemplatesStore.getState().templates[0]!.name).toBe("Persisted");
  });

  it("hydrate sanitizes corrupted persisted entries instead of throwing", () => {
    storage.raw.set(
      "mocksy-templates",
      JSON.stringify([
        null,
        { name: 42, scene: { garbage: true } },
        { id: "tpl-x", name: "Ok", scene: makeScene(), createdAt: "nope" }
      ])
    );
    useTemplatesStore.getState().hydrate();
    const templates = useTemplatesStore.getState().templates;
    expect(templates).toHaveLength(2);
    expect(templates[0]!.name).toBe("Untitled");
    expect(templates[0]!.scene.frame).toBe("iphone");
    expect(templates[1]!.id).toBe("tpl-x");
    expect(typeof templates[1]!.createdAt).toBe("number");
  });

  it("hydrate returns empty list on invalid JSON", () => {
    storage.raw.set("mocksy-templates", "{not json");
    expect(() => useTemplatesStore.getState().hydrate()).not.toThrow();
    expect(useTemplatesStore.getState().templates).toEqual([]);
  });

  it("renameTemplate updates only the target and ignores blank names", () => {
    const a = useTemplatesStore.getState().saveTemplate(makeScene(), "A");
    const b = useTemplatesStore.getState().saveTemplate(makeScene(), "B");
    useTemplatesStore.getState().renameTemplate(a!, "A2");
    useTemplatesStore.getState().renameTemplate(b!, "   ");
    const names = useTemplatesStore.getState().templates.map((t) => t.name);
    expect(names).toEqual(["B", "A2"]);
  });

  it("deleteTemplate removes the entry", () => {
    const id = useTemplatesStore.getState().saveTemplate(makeScene(), "Doomed");
    useTemplatesStore.getState().deleteTemplate(id!);
    expect(useTemplatesStore.getState().templates).toHaveLength(0);
    // Deletion is also persisted
    useTemplatesStore.getState().hydrate();
    expect(useTemplatesStore.getState().templates).toHaveLength(0);
  });

  it("saveTemplate refuses to exceed the cap", () => {
    const store = useTemplatesStore.getState();
    for (let i = 0; i < MAX_USER_TEMPLATES; i++) {
      expect(store.saveTemplate(makeScene(), `tpl-${i}`)).not.toBeNull();
    }
    expect(store.saveTemplate(makeScene(), "overflow")).toBeNull();
    expect(useTemplatesStore.getState().templates).toHaveLength(MAX_USER_TEMPLATES);
  });
});
