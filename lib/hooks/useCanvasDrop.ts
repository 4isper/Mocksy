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
  const setMedia = useEditorStore((s) => s.setMedia);

  const loadMediaToLayer = useCallback(
    async (file: File, layerId?: string) => {
      try {
        const { url, mediaType, mediaName } = await loadMediaFromFile(file);
        setMediaUploadError(null);
        if (layerId) useEditorStore.getState().setMediaOnLayer(layerId, url, mediaType, mediaName);
        else setMedia(url, mediaType, mediaName);
      } catch (err) {
        setMediaUploadError(err instanceof UnsupportedMediaError ? err.message : t("editor.uploadError"));
      }
    },
    [setMedia, setMediaUploadError, t]
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
      await loadMediaToLayer(file);
    },
    [loadMediaToLayer, setMediaUploadError, t]
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
