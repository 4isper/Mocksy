"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { EditorScene } from "@/lib/types/editor";
import { useProjectsStore } from "@/lib/state/projectsStore";

const AUTOSAVE_DELAY = 500;

export interface AutosaveStatus {
  /** Whether the active scene matches the last persisted baseline. */
  saved: boolean;
  /** Transient toast shown after a save/unsave transition, or null. */
  saveToast: string | null;
  /** Ref to the last persisted scene baseline (used by the bootstrap effect). */
  savedSceneRef: React.MutableRefObject<EditorScene | null>;
  /** Persist the current scene immediately (used by the Ctrl+S shortcut). */
  saveNow: () => void;
  /** Mark the scene as saved and clear the unsaved indicator (used after reset). */
  markSaved: () => void;
}

/**
 * Tracks the saved/unsaved state of the editor and persists scene edits to the
 * active project (via `updateActiveProjectScene`) on a debounce. Also surfaces a
 * short-lived "Saved"/"Unsaved" toast.
 */
export function useAutosaveStatus(
  scene: EditorScene,
  activeLayerId: string | null,
  bootstrappedRef: React.MutableRefObject<boolean>
): AutosaveStatus {
  const t = useTranslations();
  const [saved, setSaved] = useState(true);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const savedSceneRef = useRef<EditorScene | null>(null);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSceneRef = useRef(scene);

  const showSavedToast = useCallback((msg: string) => {
    setSaveToast(msg);
    if (savedToastTimer.current) clearTimeout(savedToastTimer.current);
    savedToastTimer.current = setTimeout(() => setSaveToast(null), 2000);
  }, []);

  const saveNow = useCallback(() => {
    useProjectsStore.getState().updateActiveProjectScene({ ...scene, activeLayerId });
    setSaved(true);
  }, [scene, activeLayerId]);

  const markSaved = useCallback(() => setSaved(true), []);

  useEffect(() => {
    latestSceneRef.current = scene;
    // Only a genuine user edit (a `scene` different from the last persisted
    // baseline) should flip the indicator to "unsaved". The bootstrap restore
    // swaps `scene` from the initial demo to the hydrated one; ignore that
    // transient so we don't flicker a false "unsaved" on every load. Deferred
    // to a microtask so we don't setState synchronously inside the effect.
    if (bootstrappedRef.current && savedSceneRef.current && savedSceneRef.current !== scene && saved) {
      setTimeout(() => {
        // Re-check the live scene is still the one that triggered the edit
        // (a fast autosave could have already resolved it to "saved").
        if (latestSceneRef.current === scene) {
          setSaved(false);
          showSavedToast(t("editor.unsaved"));
        }
      }, 0);
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      // Persist the current scene into the active project (which writes the
      // whole project list to localStorage). Dead blob: layers are handled by
      // the orphaned-blob subscription, so a refresh simply shows the demo.
      useProjectsStore.getState().updateActiveProjectScene({ ...scene, activeLayerId });
      savedSceneRef.current = scene;
      // Only surface "Saved" if no further edit arrived during the debounce
      // window — otherwise the badge would flip Saved→Unsaved a tick later and
      // visibly flicker after a fast burst of edits.
      if (latestSceneRef.current === scene && !saved) {
        setSaved(true);
        showSavedToast(t("editor.saved"));
      }
    }, AUTOSAVE_DELAY);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [scene, activeLayerId, saved, t, showSavedToast, bootstrappedRef]);

  useEffect(() => () => {
    if (savedToastTimer.current) clearTimeout(savedToastTimer.current);
  }, []);

  return { saved, saveToast, savedSceneRef, saveNow, markSaved };
}
