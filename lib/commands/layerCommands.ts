import type { Command, EditorScene, MediaType } from "@/lib/types/editor";
import { blobToDataUrl, detectMediaType } from "@/lib/media/loadFile";

export function createLayerCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  scene: EditorScene,
  callbacks: {
    addLayer: (url: string, type: MediaType, name?: string | null) => void;
    duplicateLayer: (id: string) => void;
    removeLayer: (id: string) => void;
    toggleLayerHidden: (id: string) => void;
    selectLayer: (id: string) => void;
  },
  activeLayerId: string | null = scene.activeLayerId
): Command[] {
  const { addLayer, duplicateLayer, removeLayer, toggleLayerHidden, selectLayer } = callbacks;
  const layers = scene.layers;
  const activeLayer = activeLayerId ?? layers[0]?.id;

  return [
    {
      id: "layer-add",
      category: "layer",
      label: t("commandPalette.addLayer"),
      description: t("commandPalette.addLayerDesc"),
      keywords: ["layer", "add", "new", "media", "image", "video"],
      action: () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/*";
        input.onchange = e => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          // Store a self-contained data URL like every other upload path: a
          // raw `blob:` URL here would die on reload, pin the File in memory
          // forever, and get revoked out from under the preview by the video
          // export's cleanup.
          void blobToDataUrl(file).then(url => {
            addLayer(url, detectMediaType(file), file.name);
          });
        };
        input.click();
      },
    },
    {
      id: "layer-duplicate",
      category: "layer",
      label: t("commandPalette.duplicateLayer"),
      description: t("commandPalette.duplicateLayerDesc"),
      shortcut: "⌘D",
      keywords: ["layer", "duplicate", "clone", "copy"],
      action: () => {
        if (activeLayer) duplicateLayer(activeLayer);
      },
      disabled: !activeLayer,
    },
    {
      id: "layer-remove",
      category: "layer",
      label: t("commandPalette.removeLayer"),
      description: t("commandPalette.removeLayerDesc"),
      keywords: ["layer", "remove", "delete", "trash"],
      action: () => {
        if (activeLayer && layers.length > 1) removeLayer(activeLayer);
      },
      disabled: !activeLayer || layers.length <= 1,
    },
    {
      id: "layer-toggle-hidden",
      category: "layer",
      label: t("commandPalette.toggleLayerVisibility"),
      description: t("commandPalette.toggleLayerVisibilityDesc"),
      keywords: ["layer", "hide", "show", "visibility", "eye"],
      action: () => {
        if (activeLayer) toggleLayerHidden(activeLayer);
      },
      disabled: !activeLayer,
    },
    ...layers.map(layer => ({
      id: `layer-select-${layer.id}`,
      category: "layer",
      label: t("commandPalette.selectLayer", { name: layer.mediaName || t("commandPalette.layerNumber", { n: layers.indexOf(layer) + 1 }) }),
      description: layer.hidden ? t("commandPalette.hidden") : t("commandPalette.clickToSelect"),
      keywords: ["layer", "select", "switch", layer.mediaName || ""],
      action: () => selectLayer(layer.id),
    })),
  ];
}