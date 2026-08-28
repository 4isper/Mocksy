"use client";

import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { EditorScene } from "@/lib/types/editor";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { useEditorStore } from "@/lib/state/editorStore";
import { useTranslations } from "next-intl";

interface UseCanvasDrop {
  scene: EditorScene;
}

/** Finds the frame instance id under a drop target, if any. Multi-frame
 *  previews tag each instance with `data-frame-instance-id`, so dropping a
 *  file onto a specific device targets that device's layer. */
export function closestFrameInstanceId(target: EventTarget | null): string | null {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return null;
  return el.closest("[data-frame-instance-id]")?.getAttribute("data-frame-instance-id") ?? null;
}

/**
 * Handles media drops / file picks on the preview canvas: image & video uploads
 * plus JSON project import. Surfaces upload errors to the store so the canvas
 * can render an alert. Keying the hidden <input> via `fileInputKey` lets callers
 * reset the selection after a pick.
 */
export function useCanvasDrop({ scene }: UseCanvasDrop) {
  const t = useTranslations();
  const [fileInputKey, setFileInputKey] = useState(0);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const setMediaUploadError = useEditorStore((s) => s.setMediaUploadError);

  const loadMediaToLayer = useCallback(
    async (file: File, layerId?: string) => {
      // Pin the target layer before the async decode (a drop targeting a
      // specific frame already passes its layerId in): without it, a user who
      // switches layers while the file decodes would drop the media into the
      // wrong layer — or, if that layer is now locked, silently nowhere.
      const st = useEditorStore.getState();
      const targetLayerId = layerId ?? st.activeLayerId ?? st.scene.layers[0]?.id ?? null;
      try {
        const { url, mediaType, mediaName } = await loadMediaFromFile(file);
        setMediaUploadError(null);
        useEditorStore.getState().setMedia(url, mediaType, mediaName, targetLayerId);
      } catch (err) {
        setMediaUploadError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
      }
    },
    [setMediaUploadError, t]
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (!file) return;
      // JSON project import: drag a .json mockup file onto the canvas
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        try {
          const { importProjectFromFile } = await import("@/lib/state/projectFile");
          const project = await importProjectFromFile(file);
          const { useProjectsStore } = await import("@/lib/state/projectsStore");
          useProjectsStore.getState().importProject(project);
          setMediaUploadError(null);
        } catch {
          setMediaUploadError(t("projects.importError"));
        }
        return;
      }
      // Dropping onto a specific device in a multi-frame scene targets that
      // device's layer (locked layers reject the swap inside the store).
      const instanceId = closestFrameInstanceId(event.target);
      const inst = instanceId ? scene.frameInstances.find((fi) => fi.id === instanceId) : undefined;
      if (inst?.layerId) {
        try {
          const { url, mediaType, mediaName } = await loadMediaFromFile(file);
          setMediaUploadError(null);
          useEditorStore.getState().setScenePalette(null);
          useEditorStore.getState().setMediaOnLayer(inst.layerId, url, mediaType, mediaName);
        } catch (err) {
          setMediaUploadError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
        }
        return;
      }
      await loadMediaToLayer(file);
    },
    [loadMediaToLayer, scene.frameInstances, setMediaUploadError, t]
  );

  const handleFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>, layerId?: string) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await loadMediaToLayer(file, layerId);
      setFileInputKey((k) => k + 1);
    },
    [loadMediaToLayer]
  );

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => e.preventDefault(), []);
  const onDragLeave = useCallback(() => {
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) setIsDragging(false);
  }, []);

  return {
    fileInputKey,
    isDragging,
    handleDrop,
    handleFile,
    onDragEnter,
    onDragOver,
    onDragLeave
  };
}
