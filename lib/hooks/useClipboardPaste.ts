"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { loadMediaFromFile, loadMediaFromUrl, UnsupportedMediaError, UnsupportedMediaUrlError } from "@/lib/media/loadFile";
import { pickClipboardMedia } from "@/lib/media/clipboard";
import { getCopiedObject, setCopiedObject } from "@/lib/state/editorClipboard";
import { useEditorStore } from "@/lib/state/editorStore";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable === true;
}

/**
 * Global paste handler with a clear priority: (1) OS clipboard media — a
 * screenshot/copied image-video file, or an http(s) media link — lands in the
 * active layer; (2) otherwise an object copied inside the editor via ⌘C
 * (annotation, frame instance or layer) is duplicated. Ignored while typing in
 * a field. Media errors surface through the shared upload error.
 */
export function useClipboardPaste(): void {
  const t = useTranslations();

  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const payload = pickClipboardMedia(event.clipboardData);
      if (!payload) {
        pasteCopiedObject(event);
        return;
      }
      event.preventDefault();
      const { setMediaUploadError } = useEditorStore.getState();
      // Pin the active layer before decoding: decoding can outlive the paste
      // event, and a layer switch (or lock) in that window would otherwise put
      // the media into the wrong layer or drop it silently.
      const st = useEditorStore.getState();
      const targetLayerId = st.activeLayerId ?? st.scene.layers[0]?.id ?? null;
      try {
        const loaded = payload.kind === "file"
          ? await loadMediaFromFile(payload.file)
          : await loadMediaFromUrl(payload.url);
        setMediaUploadError(null);
        // Drop any palette from the previous media; a fresh one is computed
        // once the new file decodes in the preview.
        useEditorStore.getState().setScenePalette(null);
        useEditorStore.getState().setMedia(loaded.url, loaded.mediaType, loaded.mediaName, targetLayerId);
      } catch (err) {
        if (err instanceof UnsupportedMediaError || err instanceof UnsupportedMediaUrlError) setMediaUploadError(err.message);
        else setMediaUploadError(t("editor.uploadError"));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [t]);
}

/** Fallback for ⌘V when the OS clipboard carries no media: duplicate the
 *  annotation/frame/layer copied via ⌘C. Stale ids (target deleted) are
 *  dropped. */
function pasteCopiedObject(event: ClipboardEvent): void {
  const copiedEntry = getCopiedObject();
  if (!copiedEntry) return;
  const st = useEditorStore.getState();
  if (copiedEntry.kind === "annotation" && st.scene.annotations.some((a) => a.id === copiedEntry.id)) {
    event.preventDefault();
    st.duplicateAnnotation(copiedEntry.id);
  } else if (copiedEntry.kind === "frameInstance" && st.scene.frameInstances.some((fi) => fi.id === copiedEntry.id)) {
    event.preventDefault();
    st.duplicateFrameInstance(copiedEntry.id);
  } else if (copiedEntry.kind === "layer" && st.scene.layers.some((l) => l.id === copiedEntry.id)) {
    event.preventDefault();
    st.duplicateLayer(copiedEntry.id);
  } else {
    setCopiedObject(null);
  }
}
