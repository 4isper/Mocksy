"use client";

import { create } from "zustand";
import type { EditorScene } from "@/lib/types/editor";
import { normalizeScene } from "@/lib/state/normalizeScene";
import { stripSceneMedia } from "@/lib/state/templateFile";
import { nextTemplateId } from "@/lib/state/ids";

/**
 * User-saved scene templates: the current scene's look (frame, style,
 * background, chrome) stored as named entries so it can be re-applied to any
 * project later. Media is stripped on save (same rule as .mocksy.json
 * templates), which keeps every entry small enough for plain synchronous
 * localStorage persistence — no IndexedDB offload needed.
 */

const STORAGE_KEY = "mocksy-templates";
export const MAX_USER_TEMPLATES = 30;

export interface UserTemplate {
  id: string;
  name: string;
  scene: EditorScene;
  createdAt: number;
}

interface PersistedTemplate {
  id?: unknown;
  name?: unknown;
  scene?: unknown;
  createdAt?: unknown;
}

function sanitizeTemplate(raw: PersistedTemplate): UserTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const scene = stripSceneMedia(normalizeScene(raw.scene));
  return {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : nextTemplateId(),
    name: typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name.trim() : "Untitled",
    scene,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now()
  };
}

function readStorage(): UserTemplate[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((t) => sanitizeTemplate(t as PersistedTemplate))
      .filter((t): t is UserTemplate => t !== null);
  } catch {
    return null;
  }
}

function persist(templates: UserTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Quota or disabled storage: keep the in-memory list working; the user
    // just loses cross-reload persistence for this change.
  }
}

function cloneScene(scene: EditorScene): EditorScene {
  return JSON.parse(JSON.stringify(scene)) as EditorScene;
}

export interface TemplatesStoreState {
  templates: UserTemplate[];
  /** True once hydrate() has run (localStorage read on the client). */
  hydrated: boolean;
  hydrate: () => void;
  /** Saves a media-free snapshot of the scene under the given name and
   *  returns the new template's id (or null when the list is full). */
  saveTemplate: (scene: EditorScene, name: string) => string | null;
  renameTemplate: (id: string, name: string) => void;
  deleteTemplate: (id: string) => void;
}

export const useTemplatesStore = create<TemplatesStoreState>((set, get) => ({
  templates: [],
  hydrated: false,
  hydrate: () => {
    const stored = readStorage();
    set({ templates: stored ?? [], hydrated: true });
  },
  saveTemplate: (scene, name) => {
    const trimmed = name.trim();
    const { templates } = get();
    if (templates.length >= MAX_USER_TEMPLATES) return null;
    const template: UserTemplate = {
      id: nextTemplateId(),
      name: trimmed.length > 0 ? trimmed : "Untitled",
      scene: stripSceneMedia(normalizeScene(scene)),
      createdAt: Date.now()
    };
    // Newest first so the panel shows fresh saves on top without sorting.
    const next = [template, ...templates];
    set({ templates: next });
    persist(next);
    return template.id;
  },
  renameTemplate: (id, name) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    const next = get().templates.map((tpl) => (tpl.id === id ? { ...tpl, name: trimmed } : tpl));
    set({ templates: next });
    persist(next);
  },
  deleteTemplate: (id) => {
    const next = get().templates.filter((tpl) => tpl.id !== id);
    set({ templates: next });
    persist(next);
  }
}));

/** Test seam: zustand state must not leak between suites. */
export function resetTemplatesStoreForTests(): void {
  useTemplatesStore.setState({ templates: [], hydrated: false });
}

export function cloneUserScene(scene: EditorScene): EditorScene {
  return cloneScene(scene);
}
