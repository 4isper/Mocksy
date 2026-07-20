"use client";

import { create } from "zustand";
import type { EditorScene, Project } from "@/lib/types/editor";
import { makeDemoScene } from "@/lib/state/editorStore";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { readSceneFromUrl } from "@/lib/state/shareState";

const STORAGE_KEY = "mocksy-projects";
const AUTOSAVE_KEY = "mocksy-scene";

let projectSeq = 0;
function nextProjectId(): string {
  projectSeq += 1;
  return `proj-${projectSeq}-${Date.now().toString(36)}`;
}

function cloneScene(scene: EditorScene): EditorScene {
  return JSON.parse(JSON.stringify(scene)) as EditorScene;
}

export interface ProjectsStoreState {
  projects: Project[];
  activeProjectId: string | null;
  /** True once hydrate() has run (localStorage/URL read on the client). */
  hydrated: boolean;
  /** Loads persisted projects (or migrates a legacy autosave / demo) and
   *  returns the scene that should become the editor's active scene. */
  hydrate: () => EditorScene;
  createProject: (name?: string, scene?: EditorScene) => string;
  switchProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  /** Writes the current editor scene into the active project. */
  updateActiveProjectScene: (scene: EditorScene) => void;
  /** Adds an already-built project (e.g. imported from file) and activates it. */
  importProject: (project: Project) => void;
}

function persist(state: ProjectsStoreState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projects: state.projects, activeProjectId: state.activeProjectId })
    );
  } catch {
    // storage full or unavailable — non-fatal, the in-memory state still works
  }
}

function readStorage(): { projects: Project[]; activeProjectId: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { projects?: unknown; activeProjectId?: unknown };
    if (!Array.isArray(parsed.projects)) return null;
    const projects = (parsed.projects as unknown[])
      .map((p) => {
        if (!p || typeof p !== "object") return null;
        const r = p as Record<string, unknown>;
        const scene = normalizeScene(r.scene);
        return {
          id: typeof r.id === "string" ? r.id : nextProjectId(),
          name: typeof r.name === "string" && r.name.length > 0 ? r.name : "Untitled",
          scene,
          updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now()
        } satisfies Project;
      })
      .filter((p): p is Project => p !== null);
    const activeProjectId =
      typeof parsed.activeProjectId === "string" && projects.some((p) => p.id === parsed.activeProjectId)
        ? parsed.activeProjectId
        : (projects[0]?.id ?? null);
    return { projects, activeProjectId };
  } catch {
    return null;
  }
}

export const useProjectsStore = create<ProjectsStoreState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  hydrated: false,
  hydrate: () => {
    // A shared scene URL always wins: it is a one-off scene, not a saved project.
    const fromUrl = readSceneFromUrl();
    if (fromUrl) {
      const project: Project = {
        id: nextProjectId(),
        name: "Shared mockup",
        scene: fromUrl,
        updatedAt: Date.now()
      };
      set({ projects: [project], activeProjectId: project.id, hydrated: true });
      persist(get());
      return fromUrl;
    }

    const stored = readStorage();
    if (stored && stored.projects.length > 0) {
      set({ projects: stored.projects, activeProjectId: stored.activeProjectId, hydrated: true });
      const active = stored.projects.find((p) => p.id === stored.activeProjectId) ?? stored.projects[0]!;
      return active.scene;
    }

    // Legacy single-scene autosave: migrate it into one project.
    if (typeof window !== "undefined") {
      try {
        const legacy = window.localStorage.getItem(AUTOSAVE_KEY);
        if (legacy) {
          const scene = normalizeScene(JSON.parse(legacy));
          const project: Project = { id: nextProjectId(), name: "My mockup", scene, updatedAt: Date.now() };
          set({ projects: [project], activeProjectId: project.id, hydrated: true });
          persist(get());
          return scene;
        }
      } catch {
        // fall through to a fresh demo project
      }
    }

    const scene = makeDemoScene();
    const project: Project = { id: nextProjectId(), name: "My mockup", scene, updatedAt: Date.now() };
    set({ projects: [project], activeProjectId: project.id, hydrated: true });
    persist(get());
    return scene;
  },
  createProject: (name, scene) => {
    const id = nextProjectId();
    const project: Project = {
      id,
      name: name && name.trim().length > 0 ? name.trim() : "Untitled",
      scene: scene ? cloneScene(scene) : makeDemoScene(),
      updatedAt: Date.now()
    };
    set((s) => ({ projects: [...s.projects, project], activeProjectId: id }));
    persist(get());
    return id;
  },
  switchProject: (id) => {
    if (!get().projects.some((p) => p.id === id)) return;
    set({ activeProjectId: id });
    persist(get());
  },
  renameProject: (id, name) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) }));
    persist(get());
  },
  deleteProject: (id) => {
    set((s) => {
      if (s.projects.length <= 1) return {};
      const projects = s.projects.filter((p) => p.id !== id);
      const activeProjectId = s.activeProjectId === id ? (projects[0]?.id ?? null) : s.activeProjectId;
      return { projects, activeProjectId };
    });
    persist(get());
  },
  updateActiveProjectScene: (scene) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    set({
      projects: projects.map((p) =>
        p.id === activeProjectId ? { ...p, scene: cloneScene(scene), updatedAt: Date.now() } : p
      )
    });
    persist(get());
  },
  importProject: (project) => {
    set((s) => ({ projects: [...s.projects, project], activeProjectId: project.id }));
    persist(get());
  }
}));
