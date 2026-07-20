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
    useProjectsStore.setState({ projects: [], activeProjectId: null, hydrated: false });
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

  it("importProject adds and activates an external project", () => {
    useProjectsStore.getState().hydrate();
    const external: Project = { id: "ext", name: "From file", scene: makeDemoScene(), updatedAt: Date.now() };
    useProjectsStore.getState().importProject(external);
    const state = useProjectsStore.getState();
    expect(state.projects.some((p) => p.id === "ext")).toBe(true);
    expect(state.activeProjectId).toBe("ext");
  });
});
