import type { Command } from "@/lib/types/editor";
import { backgroundPresets } from "@/lib/presets/presets";

export function createBackgroundCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  callbacks: {
    setBackgroundSolid: (color: string) => void;
    setBackgroundGradient: (from: string, to: string) => void;
    setBackgroundTransparent: () => void;
  }
): Command[] {
  const { setBackgroundSolid, setBackgroundGradient, setBackgroundTransparent } = callbacks;
  return backgroundPresets.map(bg => ({
    id: `bg-${bg.id}`,
    label: t("commandPalette.backgroundLabel", { name: t(`preset.${bg.id}`) }),
    description: bg.kind === "gradient" ? `${bg.gradientFrom} → ${bg.gradientTo}` : bg.backgroundColor,
    keywords: ["background", "bg", "color", "gradient", "solid", t(`preset.${bg.id}`).toLowerCase()],
    action: () => {
      if (bg.kind === "transparent") setBackgroundTransparent();
      else if (bg.kind === "solid") setBackgroundSolid(bg.backgroundColor!);
      else setBackgroundGradient(bg.gradientFrom!, bg.gradientTo!);
    },
  }));
}