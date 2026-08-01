import type { Command } from "@/lib/types/editor";
import { useProjectsStore } from "@/lib/state/projectsStore";

export function createFileCommands(
  t: (key: string, values?: Record<string, any>) => string,
  callbacks: {
    onExportPng: () => void;
    onExportWebp: () => void;
    onExportSvg: () => void;
    onExportHtml: () => void;
    onExportMp4: () => void;
    onExportWebm: () => void;
    onExportGif: () => void;
    onExportWebpAnim: () => void;
    onCopyPng: () => void;
    onCopyShareUrl: () => void;
    onSave: () => void;
  }
): Command[] {
  const { onExportPng, onExportWebp, onExportSvg, onExportHtml, onExportMp4, onExportWebm, onExportGif, onExportWebpAnim, onCopyPng, onCopyShareUrl, onSave } = callbacks;
  return [
    {
      id: "new-project",
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
      label: t("commandPalette.saveProject"),
      description: t("commandPalette.saveProjectDesc"),
      shortcut: "⌘S",
      keywords: ["save", "store", "persist"],
      action: onSave,
    },
    {
      id: "export-png",
      label: t("commandPalette.exportPng"),
      description: t("commandPalette.exportPngDesc"),
      shortcut: "⌘E",
      keywords: ["export", "png", "image", "download", "picture"],
      action: onExportPng,
    },
    {
      id: "export-mp4",
      label: t("commandPalette.exportMp4"),
      description: t("commandPalette.exportMp4Desc"),
      shortcut: "⇧⌘E",
      keywords: ["export", "mp4", "video", "movie", "animation"],
      action: onExportMp4,
    },
    {
      id: "export-webm",
      label: t("commandPalette.exportWebm"),
      description: t("commandPalette.exportWebmDesc"),
      shortcut: "⇧⌘W",
      keywords: ["export", "webm", "video", "movie", "animation"],
      action: onExportWebm,
    },
    {
      id: "export-webp",
      label: t("commandPalette.exportWebp"),
      description: t("commandPalette.exportWebpDesc"),
      shortcut: "⇧⌘P",
      keywords: ["export", "webp", "image", "download", "picture"],
      action: onExportWebp,
    },
    {
      id: "export-webp-anim",
      label: t("commandPalette.exportWebpAnim"),
      description: t("commandPalette.exportWebpAnimDesc"),
      shortcut: "⌘⇧A",
      keywords: ["export", "webp", "animation", "animated"],
      action: onExportWebpAnim,
    },
    {
      id: "export-svg",
      label: t("commandPalette.exportSvg"),
      description: t("commandPalette.exportSvgDesc"),
      shortcut: "⌘⇧S",
      keywords: ["export", "svg", "vector", "figma", "illustrator"],
      action: onExportSvg,
    },
    {
      id: "export-html",
      label: t("commandPalette.exportHtml"),
      description: t("commandPalette.exportHtmlDesc"),
      shortcut: "⌘⇧H",
      keywords: ["export", "html", "snippet", "embed", "web"],
      action: onExportHtml,
    },
    {
      id: "export-gif",
      label: t("commandPalette.exportGif"),
      description: t("commandPalette.exportGifDesc"),
      shortcut: "⇧⌘G",
      keywords: ["export", "gif", "animation", "animated"],
      action: onExportGif,
    },
    {
      id: "copy-png",
      label: t("commandPalette.copyPng"),
      description: t("commandPalette.copyPngDesc"),
      shortcut: "⇧⌘C",
      keywords: ["copy", "clipboard", "png", "image"],
      action: onCopyPng,
    },
    {
      id: "copy-share-url",
      label: t("commandPalette.copyShareUrl"),
      description: t("commandPalette.copyShareUrlDesc"),
      shortcut: "⌘L",
      keywords: ["copy", "share", "url", "link"],
      action: onCopyShareUrl,
    },
  ];
}