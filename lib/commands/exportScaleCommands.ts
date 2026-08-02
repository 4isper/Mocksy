import type { Command } from "@/lib/types/editor";

export function createExportScaleCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  callbacks: {
    setExportScale: (scale: 1 | 2 | 4) => void;
  }
): Command[] {
  const { setExportScale } = callbacks;
  return [
    {
      id: "export-scale-1x",
      label: t("commandPalette.exportScale1x"),
      description: t("commandPalette.exportScale1xDesc"),
      keywords: ["export", "scale", "resolution", "1x"],
      action: () => setExportScale(1),
    },
    {
      id: "export-scale-2x",
      label: t("commandPalette.exportScale2x"),
      description: t("commandPalette.exportScale2xDesc"),
      keywords: ["export", "scale", "resolution", "2x", "retina"],
      action: () => setExportScale(2),
    },
    {
      id: "export-scale-4x",
      label: t("commandPalette.exportScale4x"),
      description: t("commandPalette.exportScale4xDesc"),
      keywords: ["export", "scale", "resolution", "4x", "print"],
      action: () => setExportScale(4),
    },
  ];
}