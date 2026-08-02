import type { Command, EditorScene, MediaType } from "@/lib/types/editor";

export function createLayerCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  scene: EditorScene,
  callbacks: {
    addLayer: (url: string, type: MediaType, name?: string | null) => void;
    duplicateLayer: (id: string) => void;
    removeLayer: (id: string) => void;
    toggleLayerHidden: (id: string) => void;
    selectLayer: (id: string) => void;
  }
): Command[] {
  const { addLayer, duplicateLayer, removeLayer, toggleLayerHidden, selectLayer } = callbacks;
  const layers = scene.layers;
  const activeLayerId = scene.activeLayerId ?? layers[0]?.id;

  return [
    {
      id: "layer-add",
      label: t("commandPalette.addLayer"),
      description: t("commandPalette.addLayerDesc"),
      keywords: ["layer", "add", "new", "media", "image", "video"],
      action: () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/*";
        input.onchange = e => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            const type = file.type.startsWith("video/") ? "video" : "image";
            addLayer(url, type, file.name);
          }
        };
        input.click();
      },
    },
    {
      id: "layer-duplicate",
      label: t("commandPalette.duplicateLayer"),
      description: t("commandPalette.duplicateLayerDesc"),
      shortcut: "⌘D",
      keywords: ["layer", "duplicate", "clone", "copy"],
      action: () => {
        if (activeLayerId) duplicateLayer(activeLayerId);
      },
      disabled: !activeLayerId,
    },
    {
      id: "layer-remove",
      label: t("commandPalette.removeLayer"),
      description: t("commandPalette.removeLayerDesc"),
      keywords: ["layer", "remove", "delete", "trash"],
      action: () => {
        if (activeLayerId && layers.length > 1) removeLayer(activeLayerId);
      },
      disabled: !activeLayerId || layers.length <= 1,
    },
    {
      id: "layer-toggle-hidden",
      label: t("commandPalette.toggleLayerVisibility"),
      description: t("commandPalette.toggleLayerVisibilityDesc"),
      keywords: ["layer", "hide", "show", "visibility", "eye"],
      action: () => {
        if (activeLayerId) toggleLayerHidden(activeLayerId);
      },
      disabled: !activeLayerId,
    },
    ...layers.map(layer => ({
      id: `layer-select-${layer.id}`,
      label: t("commandPalette.selectLayer", { name: layer.mediaName || t("commandPalette.layerNumber", { n: layers.indexOf(layer) + 1 }) }),
      description: layer.hidden ? t("commandPalette.hidden") : t("commandPalette.clickToSelect"),
      keywords: ["layer", "select", "switch", layer.mediaName || ""],
      action: () => selectLayer(layer.id),
    })),
  ];
}