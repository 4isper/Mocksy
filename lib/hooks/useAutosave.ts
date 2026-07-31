"use client";

import { useEffect, useRef } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { useProjectsStore } from "@/lib/state/projectsStore";

const AUTOSAVE_DELAY = 500;

export function useAutosave(scene: EditorScene, setSaved: (v: boolean) => void) {
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prevSceneRef = useRef(scene);
  useEffect(() => {
    if (prevSceneRef.current !== scene) {
      setSaved(false);
    }
    prevSceneRef.current = scene;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      useProjectsStore.getState().updateActiveProjectScene(scene);
      setSaved(true);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [scene, setSaved]);
}
