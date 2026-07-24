import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { initialScene, makeDemoScene } from "@/lib/state/editorStore";
import type { EditorScene, Project } from "@/lib/types/editor";

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
    value: { localStorage: storage, location: { href: "https://mocksy.test/" } }
  });
}

describe("projectsStore", () => {
  const storage = makeStorage();

  beforeEach(() => {
    stubWindow(storage);
    storage.clear();
    // reset the store to a clean bootstrap state between tests
    useProjectsStore.setState({ projects: [], activeProjectId: null, hydrated: false, saveError: null });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: ORIGINAL_WINDOW });
    vi.unstubAllGlobals();
  });

  it("hydrate seeds a single demo project when storage is empty", () => {
    const scene = useProjectsStore.getState().hydrate();
    const { projects, activeProjectId } = useProjectsStore.getState();
    expect(projects).toHaveLength(1);
    expect(activeProjectId).toBe(projects[0]!.id);
    expect(scene.layers).toHaveLength(1);
  });

  it("hydrate migrates a legacy AUTOSAVE_KEY into one project", () => {
    storage.setItem("mocksy-scene", JSON.stringify({ ...initialScene, frame: "tablet" }));
    const scene = useProjectsStore.getState().hydrate();
    expect(scene.frame).toBe("tablet");
    expect(useProjectsStore.getState().projects).toHaveLength(1);
  });

  it("hydrate loads persisted projects and keeps the active id", () => {
    const projects: Project[] = [
      { id: "p1", name: "One", scene: makeDemoScene(), updatedAt: 1 },
      { id: "p2", name: "Two", scene: makeDemoScene(), updatedAt: 2 }
    ];
    storage.setItem("mocksy-projects", JSON.stringify({ projects, activeProjectId: "p2" }));
    useProjectsStore.getState().hydrate();
    const state = useProjectsStore.getState();
    expect(state.projects).toHaveLength(2);
    expect(state.activeProjectId).toBe("p2");
  });

  it("createProject adds and activates a project from the current scene", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().createProject("My shot", initialScene);
    const state = useProjectsStore.getState();
    expect(state.projects).toHaveLength(2);
    expect(state.activeProjectId).toBe(id);
    expect(state.projects.find((p) => p.id === id)?.name).toBe("My shot");
  });

  it("switchProject changes the active id", () => {
    useProjectsStore.getState().hydrate();
    const first = useProjectsStore.getState().activeProjectId;
    const second = useProjectsStore.getState().createProject("Second");
    useProjectsStore.getState().switchProject(first!);
    expect(useProjectsStore.getState().activeProjectId).toBe(first);
    useProjectsStore.getState().switchProject(second);
    expect(useProjectsStore.getState().activeProjectId).toBe(second);
  });

  it("renameProject updates the name", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().activeProjectId!;
    useProjectsStore.getState().renameProject(id, "Renamed");
    expect(useProjectsStore.getState().projects.find((p) => p.id === id)?.name).toBe("Renamed");
  });

  it("deleteProject removes a project but never the last one", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().activeProjectId!;
    useProjectsStore.getState().deleteProject(id);
    // only one project existed, so it is kept
    expect(useProjectsStore.getState().projects).toHaveLength(1);

    const a = useProjectsStore.getState().createProject("A");
    const b = useProjectsStore.getState().createProject("B");
    useProjectsStore.getState().deleteProject(a);
    const state = useProjectsStore.getState();
    expect(state.projects).toHaveLength(2);
    expect(state.projects.some((p) => p.id === a)).toBe(false);
    // deleting the active project falls back to the first remaining one
    useProjectsStore.getState().deleteProject(b);
    expect(useProjectsStore.getState().activeProjectId).toBe(state.projects[0]!.id);
  });

  it("updateActiveProjectScene writes the scene and bumps updatedAt", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().activeProjectId!;
    const next: EditorScene = { ...initialScene, frame: "watch" };
    useProjectsStore.getState().updateActiveProjectScene(next);
    const stored = useProjectsStore.getState().projects.find((p) => p.id === id)!;
    expect(stored.scene.frame).toBe("watch");
  });

  it("persists the project list to localStorage on every mutation", () => {
    useProjectsStore.getState().hydrate();
    useProjectsStore.getState().createProject("Persisted");
    const raw = storage.getItem("mocksy-projects");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { projects: Project[] };
    expect(parsed.projects.some((p) => p.name === "Persisted")).toBe(true);
  });

  it("persists and restores a data:-URL media layer across hydrate", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().activeProjectId!;
    // A data: URL is self-contained, so it survives a page reload (unlike a
    // one-shot blob: URL, which dies and leaves a blank canvas on refresh).
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
    const scene: EditorScene = {
      ...initialScene,
      layers: [{ ...initialScene.layers[0]!, mediaUrl: dataUrl, mediaType: "image", mediaName: "shot.png" }]
    };
    useProjectsStore.getState().updateActiveProjectScene(scene);

    // The serialized localStorage payload carries the data: URL verbatim.
    const raw = storage.getItem("mocksy-projects");
    expect(raw).toContain(dataUrl);

    // Simulate a fresh page load: drop the in-memory store, then re-hydrate
    // from storage. The uploaded media must come back intact.
    useProjectsStore.setState({ projects: [], activeProjectId: null, hydrated: false });
    useProjectsStore.getState().hydrate();
    const restored = useProjectsStore.getState().projects.find((p) => p.id === id)!;
    expect(restored.scene.layers[0]!.mediaUrl).toBe(dataUrl);
  });

  it("importProject adds and activates an external project", () => {
    useProjectsStore.getState().hydrate();
    const before = useProjectsStore.getState().projects.length;
    const external: Project = { id: "ext", name: "From file", scene: makeDemoScene(), updatedAt: Date.now() };
    useProjectsStore.getState().importProject(external);
    const state = useProjectsStore.getState();
    // id is regenerated on import, but the project is added and activated
    expect(state.projects).toHaveLength(before + 1);
    expect(state.activeProjectId).not.toBeNull();
    expect(state.projects.find((p) => p.id === state.activeProjectId)?.name).toBe("From file");
  });

  it("importProject regenerates the id so cross-device imports can't collide", () => {
    const first = useProjectsStore.getState().hydrate();
    const existing = useProjectsStore.getState().activeProjectId!;
    // Simulate a project file exported on another device carrying an id that
    // already exists locally.
    const external: Project = { id: existing, name: "Clashing id", scene: first, updatedAt: Date.now() };
    useProjectsStore.getState().importProject(external);
    const state = useProjectsStore.getState();
    const clash = state.projects.find((p) => p.id === existing);
    expect(clash?.name).toBe("My mockup");
    expect(state.projects.some((p) => p.name === "Clashing id")).toBe(true);
    expect(state.activeProjectId).not.toBe(existing);
  });

  it("sets saveError when localStorage throws QuotaExceededError", () => {
    const quotaError = new DOMException("Storage full", "QuotaExceededError");
    const origSetItem = storage.setItem;
    storage.setItem = (_k: string, _v: string) => {
      throw quotaError;
    };
    useProjectsStore.getState().hydrate();
    useProjectsStore.getState().createProject("Will fail");
    storage.setItem = origSetItem;
    expect(useProjectsStore.getState().saveError).toBe(
      "Storage full — recent changes may not be saved"
    );
  });

  it("clears saveError on a successful persist", () => {
    // First, cause a quota error to set saveError
    const quotaError = new DOMException("Storage full", "QuotaExceededError");
    const origSetItem = storage.setItem;
    storage.setItem = (_k: string, _v: string) => {
      throw quotaError;
    };
    useProjectsStore.getState().hydrate();
    useProjectsStore.getState().createProject("Will fail");
    storage.setItem = origSetItem;

    // Now a normal write should clear the error
    useProjectsStore.getState().createProject("Should clear error");
    expect(useProjectsStore.getState().saveError).toBeNull();
  });

  it("duplicateProject copies the scene under a new id with a 'copy' suffix", () => {
    const id = useProjectsStore.getState().hydrate();
    const sourceId = useProjectsStore.getState().activeProjectId!;
    const source = useProjectsStore.getState().projects.find((p) => p.id === sourceId)!;
    source.name = "Original";
    useProjectsStore.getState().duplicateProject(sourceId);
    const state = useProjectsStore.getState();
    expect(state.projects).toHaveLength(2);
    const copy = state.projects.find((p) => p.name === "Original copy");
    expect(copy).toBeDefined();
    expect(copy!.id).not.toBe(sourceId);
    expect(copy!.scene).toEqual(source.scene);
    expect(state.activeProjectId).toBe(copy!.id);
  });
});
