import type { Command } from "@/lib/types/editor";
import { ASPECT_RATIOS } from "@/lib/render/frames";

export function createAspectRatioCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  callbacks: {
    setAspectRatio: (ratio: string) => void;
  }
): Command[] {
  const { setAspectRatio } = callbacks;
  return ASPECT_RATIOS.map(ratio => ({
    id: `ratio-${ratio.replace(/\s/g, "-")}`,
    category: "aspect",
    label: t("commandPalette.aspectRatioLabel", { ratio }),
    description: t("commandPalette.aspectRatioDesc", { ratio }),
    keywords: ["ratio", "aspect", "canvas", "size", ratio],
    action: () => setAspectRatio(ratio),
  }));
}