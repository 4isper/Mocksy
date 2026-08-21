import type { Command } from "@/lib/types/editor";
import { useProjectsStore } from "@/lib/state/projectsStore";
import { useEditorStore } from "@/lib/state/editorStore";
import { isScreenRecordingActive, isScreenRecordingSupported, startScreenRecording, stopScreenRecording } from "@/lib/media/screenRecording";

export function createFileCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  callbacks: {
    onExportPng: () => void;
    onExportWebp: () => void;
    onExportSvg: () => void;
    onExportHtml: () => void;
    onExportPdf: () => void;
    onExportMp4: () => void;
    onExportWebm: () => void;
    onExportGif: () => void;
    onExportWebpAnim: () => void;
    onCopyPng: () => void;
    onCopyShareUrl: () => void;
    onSave: () => void;
  }
): Command[] {
  const { onExportPng, onExportWebp, onExportSvg, onExportHtml, onExportPdf, onExportMp4, onExportWebm, onExportGif, onExportWebpAnim, onCopyPng, onCopyShareUrl, onSave } = callbacks;
  const recording = isScreenRecordingActive();
  return [
    {
      id: "record-screen",
      category: "file",
      label: t(recording ? "editor.stopRecording" : "editor.recordScreen"),
      description: t("commandPalette.recordScreenDesc"),
      keywords: ["record", "screen", "capture", "display", "screencast", "video"],
      disabled: !isScreenRecordingSupported() && !recording,
      action: () => {
        if (isScreenRecordingActive()) {
          stopScreenRecording();
          return;
        }
        // The clip lands in the active layer through the same flow the
        // MediaSection button uses.
        void import("@/lib/hooks/useScreenRecording").then(({ loadRecordedClip }) =>
          startScreenRecording({
            onDone: (blob) => {
              loadRecordedClip(blob).catch(() => {
                useEditorStore.getState().setMediaUploadError(t("editor.uploadError"));
              });
            },
            onError: (message) => useEditorStore.getState().setMediaUploadError(message)
          })
        );
      },
    },
    {
      id: "new-project",
      category: "file",
      label: t("commandPalette.newProject"),
      description: t("commandPalette.newProjectDesc"),
      shortcut: "⌘N",
      keywords: ["new", "create", "fresh", "start"],
      action: () => {
        const newProjectId = useProjectsStore.getState().createProject("Untitled");
        useProjectsStore.getState().switchProject(newProjectId);
      },
    },
    {
      id: "save-project",
      category: "file",
      label: t("commandPalette.saveProject"),
      description: t("commandPalette.saveProjectDesc"),
      shortcut: "⌘S",
      keywords: ["save", "store", "persist"],
      action: onSave,
    },
    {
      id: "export-png",
      category: "export",
      label: t("commandPalette.exportPng"),
      description: t("commandPalette.exportPngDesc"),
      shortcut: "⌘E",
      keywords: ["export", "png", "image", "download", "picture"],
      action: onExportPng,
    },
    {
      id: "export-mp4",
      category: "export",
      label: t("commandPalette.exportMp4"),
      description: t("commandPalette.exportMp4Desc"),
      shortcut: "⇧⌘E",
      keywords: ["export", "mp4", "video", "movie", "animation"],
      action: onExportMp4,
    },
    {
      id: "export-webm",
      category: "export",
      label: t("commandPalette.exportWebm"),
      description: t("commandPalette.exportWebmDesc"),
      shortcut: "⇧⌘W",
      keywords: ["export", "webm", "video", "movie", "animation"],
      action: onExportWebm,
    },
    {
      id: "export-webp",
      category: "export",
      label: t("commandPalette.exportWebp"),
      description: t("commandPalette.exportWebpDesc"),
      shortcut: "⇧⌘P",
      keywords: ["export", "webp", "image", "download", "picture"],
      action: onExportWebp,
    },
    {
      id: "export-webp-anim",
      category: "export",
      label: t("commandPalette.exportWebpAnim"),
      description: t("commandPalette.exportWebpAnimDesc"),
      shortcut: "⌘⇧A",
      keywords: ["export", "webp", "animation", "animated"],
      action: onExportWebpAnim,
    },
    {
      id: "export-svg",
      category: "export",
      label: t("commandPalette.exportSvg"),
      description: t("commandPalette.exportSvgDesc"),
      shortcut: "⌘⇧S",
      keywords: ["export", "svg", "vector", "figma", "illustrator"],
      action: onExportSvg,
    },
    {
      id: "export-html",
      category: "export",
      label: t("commandPalette.exportHtml"),
      description: t("commandPalette.exportHtmlDesc"),
      shortcut: "⌘⇧H",
      keywords: ["export", "html", "snippet", "embed", "web"],
      action: onExportHtml,
    },
    {
      id: "export-pdf",
      category: "export",
      label: t("commandPalette.exportPdf"),
      description: t("commandPalette.exportPdfDesc"),
      shortcut: "⌘⇧F",
      keywords: ["export", "pdf", "document", "print", "save"],
      action: onExportPdf,
    },
    {
      id: "export-gif",
      category: "export",
      label: t("commandPalette.exportGif"),
      description: t("commandPalette.exportGifDesc"),
      shortcut: "⇧⌘G",
      keywords: ["export", "gif", "animation", "animated"],
      action: onExportGif,
    },
    {
      id: "copy-png",
      category: "export",
      label: t("commandPalette.copyPng"),
      description: t("commandPalette.copyPngDesc"),
      shortcut: "⇧⌘C",
      keywords: ["copy", "clipboard", "png", "image"],
      action: onCopyPng,
    },
    {
      id: "copy-share-url",
      category: "export",
      label: t("commandPalette.copyShareUrl"),
      description: t("commandPalette.copyShareUrlDesc"),
      keywords: ["copy", "share", "url", "link"],
      action: onCopyShareUrl,
    },
  ];
}