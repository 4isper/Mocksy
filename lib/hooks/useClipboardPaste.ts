"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { loadMediaFromFile, loadMediaFromUrl, UnsupportedMediaError, UnsupportedMediaUrlError } from "@/lib/media/loadFile";
import { pickClipboardMedia } from "@/lib/media/clipboard";
import { useEditorStore } from "@/lib/state/editorStore";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable === true;
}

/**
 * Global paste handler: ⌘V pastes a screenshot/copied image or video into the
 * active layer, or an http(s) media link as remote media. Ignored while the
 * user is typing in a field (normal text paste must keep working). Errors
 * surface through the shared media upload error shown on the preview.
 */
export function useClipboardPaste(): void {
  const t = useTranslations();

  useEffect(() => {
    const loading = useEditorStore.getState;
    const onPaste = async (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const payload = pickClipboardMedia(event.clipboardData);
      if (!payload) return;
      event.preventDefault();
      const { setMediaUploadError } = loading();
      try {
        const loaded = payload.kind === "file"
          ? await loadMediaFromFile(payload.file)
          : await loadMediaFromUrl(payload.url);
        setMediaUploadError(null);
        // Drop any palette from the previous media; a fresh one is computed
        // once the new file decodes in the preview.
        useEditorStore.getState().setScenePalette(null);
        useEditorStore.getState().setMedia(loaded.url, loaded.mediaType, loaded.mediaName);
      } catch (err) {
        if (err instanceof UnsupportedMediaError || err instanceof UnsupportedMediaUrlError) setMediaUploadError(err.message);
        else setMediaUploadError(t("editor.uploadError"));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [t]);
}
