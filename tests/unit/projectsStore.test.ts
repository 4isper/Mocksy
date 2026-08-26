import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectsStore, resetProjectCacheForTests, warmProjectCache, STORAGE_FULL_ERROR_KEY } from "@/lib/state/projectsStore";
import { initialScene, makeDemoScene, useEditorStore } from "@/lib/state/editorStore";
import { readSharedSceneFromUrl, sceneToShareUrl } from "@/lib/state/shareState";
import { createFakeIndexedDB, FakeFileReader } from "./helpers/fakeIdb";
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
    resetProjectCacheForTests();
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
    expect(scene.layers).toHaveLength(2);
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
    // only one project existed, so it is kept (not soft-deleted)
    expect(useProjectsStore.getState().projects).toHaveLength(1);
    expect(useProjectsStore.getState().projects[0]!.deletedAt).toBeUndefined();

    const a = useProjectsStore.getState().createProject("A");
    const b = useProjectsStore.getState().createProject("B");
    useProjectsStore.getState().deleteProject(a);
    const state = useProjectsStore.getState();
    expect(state.projects).toHaveLength(3);
    expect(state.projects.some((p) => p.id === a && p.deletedAt != null)).toBe(true);
    // deleting the active project falls back to the first remaining one
    useProjectsStore.getState().deleteProject(b);
    expect(useProjectsStore.getState().activeProjectId).toBe(state.projects.find((p) => p.id !== a && p.id !== b && p.deletedAt == null)?.id);
  });

  it("updateActiveProjectScene writes the scene and bumps updatedAt", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().activeProjectId!;
    const next: EditorScene = { ...initialScene, frame: "watch" };
    useProjectsStore.getState().updateActiveProjectScene(next);
    const stored = useProjectsStore.getState().projects.find((p) => p.id === id)!;
    expect(stored.scene.frame).toBe("watch");
  });

  it("deleting the active project does not overwrite the switched-to project on autosave", () => {
    useProjectsStore.getState().hydrate();
    const x = useProjectsStore.getState().activeProjectId!; // the legacy/demo project
    const a = useProjectsStore.getState().createProject("A");
    // Give X a distinct scene so a clobber from A's scene would be visible.
    useProjectsStore.getState().switchProject(x);
    useEditorStore.getState().setFrame("watch");
    useProjectsStore.getState().updateActiveProjectScene(useEditorStore.getState().scene);
    // Switch to A (its default scene), then delete the active project A.
    useProjectsStore.getState().switchProject(a);
    useProjectsStore.getState().deleteProject(a);
    // Autosave must write the now-active project's (X's) scene, not A's.
    useProjectsStore.getState().updateActiveProjectScene(useEditorStore.getState().scene);
    const storedX = useProjectsStore.getState().projects.find((p) => p.id === x)!;
    expect(storedX.scene.frame).toBe("watch");
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

  it("importProject loads the imported scene into the editor", () => {
    useProjectsStore.getState().hydrate();
    const external: Project = {
      id: "ext",
      name: "From file",
      scene: { ...initialScene, frame: "tablet" },
      updatedAt: Date.now()
    };
    useProjectsStore.getState().importProject(external);
    expect(useProjectsStore.getState().activeProjectId).toBe(useProjectsStore.getState().projects.find((p) => p.name === "From file")!.id);
    expect(useEditorStore.getState().scene.frame).toBe("tablet");
  });

  it("duplicateProject loads the copy's scene into the editor", () => {
    useProjectsStore.getState().hydrate();
    const source = useProjectsStore.getState().activeProjectId!;
    const watchScene: EditorScene = { ...initialScene, frame: "watch" };
    useProjectsStore.getState().updateActiveProjectScene(watchScene);
    useProjectsStore.getState().duplicateProject(source);
    expect(useEditorStore.getState().scene.frame).toBe("watch");
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
      STORAGE_FULL_ERROR_KEY
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

  it("hydrate creates shared mockup project from URL scene parameter", async () => {
    const scene: EditorScene = { ...initialScene, frame: "desktop" };
    const url = await sceneToShareUrl(scene);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage, location: { href: url } }
    });
    // Compressed links resolve asynchronously before hydration (as the app bootstrap does).
    const shared = await readSharedSceneFromUrl();
    const result = useProjectsStore.getState().hydrate(shared);
    const { projects, activeProjectId } = useProjectsStore.getState();
    expect(projects).toHaveLength(1);
    expect(projects[0]!.name).toBe("Shared mockup");
    expect(activeProjectId).toBe(projects[0]!.id);
    expect(result.frame).toBe("desktop");
    expect(result.layers.some((l) => l.mediaUrl)).toBe(true);
  });

  it("hydrate merges a shared scene with existing projects instead of wiping them", async () => {
    const saved: Project[] = [
      { id: "p1", name: "Saved one", scene: makeDemoScene(), updatedAt: 1 },
      { id: "p2", name: "Saved two", scene: makeDemoScene(), updatedAt: 2 }
    ];
    storage.setItem("mocksy-projects", JSON.stringify({ projects: saved, activeProjectId: "p1" }));
    const url = await sceneToShareUrl({ ...initialScene, frame: "tablet" });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage, location: { href: url } }
    });
    const shared = await readSharedSceneFromUrl();
    const result = useProjectsStore.getState().hydrate(shared);
    const { projects, activeProjectId } = useProjectsStore.getState();
    expect(projects).toHaveLength(3);
    expect(projects.find((p) => p.id === "p1")).toBeDefined();
    expect(projects.find((p) => p.id === "p2")).toBeDefined();
    expect(projects.find((p) => p.name === "Shared mockup")).toBeDefined();
    expect(activeProjectId).toBe(projects.find((p) => p.name === "Shared mockup")!.id);
    expect(result.frame).toBe("tablet");
  });

  it("hydrate clears the scene param from the URL after reading it", async () => {
    const url = await sceneToShareUrl({ ...initialScene, frame: "desktop" });
    const replaceState = vi.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: storage,
        location: { href: url },
        history: { replaceState }
      }
    });
    const shared = await readSharedSceneFromUrl();
    useProjectsStore.getState().hydrate(shared);
    expect(replaceState).toHaveBeenCalledTimes(1);
    const cleared = new URL(replaceState.mock.calls[0]![2]);
    expect(cleared.searchParams.has("scene")).toBe(false);
  });

  it("handles corrupted localStorage gracefully", () => {
    storage.setItem("mocksy-projects", "not-valid-json");
    const result = useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().projects).toHaveLength(1);
    expect(result).toBeDefined();
  });

  it("handles malformed projects data (non-array projects)", () => {
    storage.setItem("mocksy-projects", JSON.stringify({ projects: "not-an-array", activeProjectId: null }));
    useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().projects).toHaveLength(1);
  });

  it("handles null entries in projects array", () => {
    storage.setItem("mocksy-projects", JSON.stringify({ projects: [null, { id: "p1", name: "Valid", scene: makeDemoScene(), updatedAt: 1 }], activeProjectId: "p1" }));
    useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().projects).toHaveLength(1);
  });

  it("regenerates non-string project ids", () => {
    storage.setItem("mocksy-projects", JSON.stringify({ projects: [{ id: 123, name: "Numeric id", scene: makeDemoScene(), updatedAt: 1 }], activeProjectId: "123" }));
    useProjectsStore.getState().hydrate();
    const p = useProjectsStore.getState().projects[0]!;
    expect(typeof p.id).toBe("string");
  });

  it("defaults empty project name to Untitled", () => {
    storage.setItem("mocksy-projects", JSON.stringify({ projects: [{ id: "p1", name: "", scene: makeDemoScene(), updatedAt: 1 }], activeProjectId: "p1" }));
    useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().projects[0]!.name).toBe("Untitled");
  });

  it("falls back to Date.now for non-number updatedAt", () => {
    const now = Date.now();
    storage.setItem("mocksy-projects", JSON.stringify({ projects: [{ id: "p1", name: "P1", scene: makeDemoScene(), updatedAt: "yesterday" }], activeProjectId: "p1" }));
    useProjectsStore.getState().hydrate();
    const p = useProjectsStore.getState().projects[0]!;
    expect(typeof p.updatedAt).toBe("number");
    expect(p.updatedAt).toBeGreaterThanOrEqual(now);
  });

  it("handles empty projects array in storage by falling back to demo project", () => {
    storage.setItem("mocksy-projects", JSON.stringify({ projects: [], activeProjectId: null }));
    useProjectsStore.getState().hydrate();
    expect(useProjectsStore.getState().projects).toHaveLength(1);
    expect(useProjectsStore.getState().activeProjectId).toBe(useProjectsStore.getState().projects[0]!.id);
  });

  it("createProject defaults to Untitled when name omitted", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().createProject();
    expect(useProjectsStore.getState().projects.find((p) => p.id === id)?.name).toBe("Untitled");
  });

  it("createProject defaults to Untitled for empty string name", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().createProject("");
    expect(useProjectsStore.getState().projects.find((p) => p.id === id)?.name).toBe("Untitled");
  });

  it("switchProject is a no-op for non-existent id", () => {
    useProjectsStore.getState().hydrate();
    const current = useProjectsStore.getState().activeProjectId;
    useProjectsStore.getState().switchProject("nonexistent");
    expect(useProjectsStore.getState().activeProjectId).toBe(current);
  });

  it("switchProject loads the target project's scene into the editor", () => {
    useProjectsStore.getState().hydrate();
    const first = useProjectsStore.getState().activeProjectId!;
    const watchScene: EditorScene = { ...initialScene, frame: "watch" };
    const second = useProjectsStore.getState().createProject("Second", watchScene);
    // switch to the second project — the editor must show its scene
    useProjectsStore.getState().switchProject(second);
    expect(useEditorStore.getState().scene.frame).toBe("watch");
    // switch back to the first — the editor must restore its scene
    useProjectsStore.getState().switchProject(first);
    expect(useEditorStore.getState().scene.frame).toBe(useProjectsStore.getState().projects.find((p) => p.id === first)!.scene.frame);
    expect(useProjectsStore.getState().activeProjectId).toBe(first);
  });

  it("switchProject clears the previous project's undo/redo history", () => {
    useProjectsStore.getState().hydrate();
    const watchScene: EditorScene = { ...initialScene, frame: "watch" };
    const second = useProjectsStore.getState().createProject("Second", watchScene);
    // Edit the current (first) project so its undo stack gains entries.
    useEditorStore.getState().setScene({ frame: "tablet" });
    expect(useEditorStore.getState().past.length).toBeGreaterThan(0);
    useProjectsStore.getState().switchProject(second);
    expect(useEditorStore.getState().past).toEqual([]);
    expect(useEditorStore.getState().future).toEqual([]);
    expect(useEditorStore.getState().lastHistoryKey).toBeNull();
    // Undo after the switch must be a no-op — it must not paste the previous
    // project's scene into the newly-activated one (autosave would persist it).
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().scene.frame).toBe("watch");
  });

  it("switchProject flushes the outgoing project's pending autosave", () => {
    useProjectsStore.getState().hydrate();
    const first = useProjectsStore.getState().activeProjectId!;
    const watchScene: EditorScene = { ...initialScene, frame: "watch" };
    const second = useProjectsStore.getState().createProject("Second", watchScene);
    // createProject activates the new project — switch back so we're editing A.
    useProjectsStore.getState().switchProject(first);
    expect(useEditorStore.getState().scene.frame).toBe(useProjectsStore.getState().projects.find((p) => p.id === first)!.scene.frame);
    // An edit that the debounced autosave hasn't persisted yet (the watcher
    // would cancel its timer on the scene swap below).
    useEditorStore.setState({ scene: { ...useEditorStore.getState().scene, frame: "tablet" } });
    useProjectsStore.getState().switchProject(second);
    // The unsaved edit must have been written into project A before switching.
    expect(useProjectsStore.getState().projects.find((p) => p.id === first)!.scene.frame).toBe("tablet");
    // And the editor now shows project B's own scene.
    expect(useEditorStore.getState().scene.frame).toBe("watch");
  });

  it("renameProject is a no-op for empty name", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().activeProjectId!;
    const nameBefore = useProjectsStore.getState().projects.find((p) => p.id === id)!.name;
    useProjectsStore.getState().renameProject(id, "   ");
    expect(useProjectsStore.getState().projects.find((p) => p.id === id)!.name).toBe(nameBefore);
  });

  it("renameProject leaves other projects unchanged", () => {
    useProjectsStore.getState().hydrate();
    const a = useProjectsStore.getState().createProject("A");
    const b = useProjectsStore.getState().createProject("B");
    useProjectsStore.getState().renameProject(a, "Renamed A");
    expect(useProjectsStore.getState().projects.find((p) => p.id === b)!.name).toBe("B");
  });

  it("duplicateProject is a no-op for non-existent source", () => {
    useProjectsStore.getState().hydrate();
    const before = useProjectsStore.getState().projects.length;
    useProjectsStore.getState().duplicateProject("nonexistent");
    expect(useProjectsStore.getState().projects).toHaveLength(before);
  });

  it("updateActiveProjectScene is a no-op when there is no active project", () => {
    useProjectsStore.setState({ projects: [], activeProjectId: null, hydrated: true });
    useProjectsStore.getState().updateActiveProjectScene(initialScene);
    expect(useProjectsStore.getState().projects).toHaveLength(0);
  });

  it("updateActiveProjectScene only updates the active project in multi-project", () => {
    useProjectsStore.getState().hydrate();
    // Pin the editor scene: createProject snapshots it, and switchProject now
    // flushes the live scene into the outgoing project.
    useEditorStore.setState({ scene: { ...initialScene } });
    const b = useProjectsStore.getState().activeProjectId!;
    const a = useProjectsStore.getState().createProject("A");
    useProjectsStore.getState().switchProject(b);
    useProjectsStore.getState().updateActiveProjectScene({ ...initialScene, frame: "watch" as const });
    expect(useProjectsStore.getState().projects.find((p) => p.id === a)!.scene.frame).toBe(initialScene.frame);
    expect(useProjectsStore.getState().projects.find((p) => p.id === b)!.scene.frame).toBe("watch");
  });

  it("deleteProject soft-deletes instead of hard-deleting", () => {
    useProjectsStore.getState().hydrate();
    const a = useProjectsStore.getState().createProject("A");
    useProjectsStore.getState().deleteProject(a);
    const state = useProjectsStore.getState();
    // Project should still exist with deletedAt set
    expect(state.projects.some((p) => p.id === a)).toBe(true);
    const trashed = state.projects.find((p) => p.id === a)!;
    expect(trashed.deletedAt).toBeGreaterThan(0);
    // Active project should switch to remaining one
    expect(state.activeProjectId).not.toBe(a);
  });

  it("restoreProject clears deletedAt", () => {
    useProjectsStore.getState().hydrate();
    const a = useProjectsStore.getState().createProject("A");
    useProjectsStore.getState().deleteProject(a);
    expect(useProjectsStore.getState().projects.find((p) => p.id === a)?.deletedAt).toBeDefined();
    useProjectsStore.getState().restoreProject(a);
    expect(useProjectsStore.getState().projects.find((p) => p.id === a)?.deletedAt).toBeUndefined();
  });

  it("preserves deletedAt across hydrate so trash survives reloads", () => {
    useProjectsStore.getState().hydrate();
    const a = useProjectsStore.getState().createProject("A");
    useProjectsStore.getState().deleteProject(a);
    // Simulate a fresh page load: drop the in-memory store, then re-hydrate
    // from localStorage. The soft-deleted project must stay in the trash.
    useProjectsStore.setState({ projects: [], activeProjectId: null, hydrated: false });
    useProjectsStore.getState().hydrate();
    const trashed = useProjectsStore.getState().projects.find((p) => p.id === a);
    expect(trashed?.deletedAt).toBeGreaterThan(0);
  });

  it("emptyTrash permanently removes soft-deleted projects", () => {
    useProjectsStore.getState().hydrate();
    const a = useProjectsStore.getState().createProject("A");
    const b = useProjectsStore.getState().createProject("B");
    useProjectsStore.getState().deleteProject(a);
    useProjectsStore.getState().deleteProject(b);
    expect(useProjectsStore.getState().projects).toHaveLength(3); // original + 2 trashed
    useProjectsStore.getState().emptyTrash();
    expect(useProjectsStore.getState().projects).toHaveLength(1);
    expect(useProjectsStore.getState().projects.some((p) => p.id === a || p.id === b)).toBe(false);
  });

  it("deleteProject refuses to trash the last active project", () => {
    useProjectsStore.getState().hydrate();
    const id = useProjectsStore.getState().activeProjectId!;
    // Only one non-deleted project exists
    useProjectsStore.getState().deleteProject(id);
    expect(useProjectsStore.getState().projects.find((p) => p.id === id)?.deletedAt).toBeUndefined();
  });

  it("sets saveError for Firefox NS_ERROR_DOM_QUOTA_REACHED", () => {
    const quotaError = new DOMException("Storage full", "NS_ERROR_DOM_QUOTA_REACHED");
    const origSetItem = storage.setItem;
    storage.setItem = (_k: string, _v: string) => {
      throw quotaError;
    };
    useProjectsStore.getState().hydrate();
    useProjectsStore.getState().createProject("Will fail");
    storage.setItem = origSetItem;
    expect(useProjectsStore.getState().saveError).toBe(
      STORAGE_FULL_ERROR_KEY
    );
  });
});

describe("projectsStore media offload", () => {
  const storage = makeStorage();
  const ORIGINAL_FILE_READER = globalThis.FileReader;

  afterEach(() => {
    globalThis.FileReader = ORIGINAL_FILE_READER;
    resetProjectCacheForTests();
  });

  function makeBigDataUrl(kb = 96): string {
    const bytes = new Uint8Array(kb * 1024).fill(97); // 'a'
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  }

  it("persists large media as IndexedDB placeholders and hydrates them back", async () => {
    const idb = createFakeIndexedDB();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage, location: { href: "https://mocksy.test/" }, indexedDB: idb }
    });
    globalThis.FileReader = FakeFileReader as unknown as typeof FileReader;
    resetProjectCacheForTests();

    const big = makeBigDataUrl();
    const scene: EditorScene = { ...makeDemoScene(), layers: [{ ...makeDemoScene().layers[0]!, id: "l-big", mediaUrl: big }] };
    useProjectsStore.setState({ projects: [{ id: "p1", name: "Big", scene, updatedAt: 1 }], activeProjectId: "p1" });

    // Any store action triggers persist; rename is side-effect-free here.
    useProjectsStore.getState().renameProject("p1", "Renamed");

    // Wait for the async encode → localStorage write with placeholders.
    await vi.waitFor(() => {
      const raw = storage.getItem("mocksy-projects") ?? "";
      expect(raw).toContain("@idb:");
    });
    expect(storage.getItem("mocksy-projects")).not.toContain(big.slice(0, 100));

    // A fresh load warms the cache and restores the real data URL.
    useProjectsStore.setState({ projects: [], activeProjectId: null, hydrated: false });
    await warmProjectCache();
    const restored = useProjectsStore.getState().hydrate(null);
    expect(restored.layers[0]?.mediaUrl).toBe(big);
  });
});
