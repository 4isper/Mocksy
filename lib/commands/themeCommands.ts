import type { Command } from "@/lib/types/editor";

export function createThemeCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  callbacks: {
    setThemeMode: (mode: "light" | "dark" | "system") => void;
  }
): Command[] {
  const { setThemeMode } = callbacks;
  return [
    {
      id: "theme-light",
      category: "theme",
      label: t("commandPalette.themeLight"),
      description: t("commandPalette.themeLightDesc"),
      keywords: ["theme", "light", "day", "bright"],
      action: () => setThemeMode("light"),
    },
    {
      id: "theme-dark",
      category: "theme",
      label: t("commandPalette.themeDark"),
      description: t("commandPalette.themeDarkDesc"),
      keywords: ["theme", "dark", "night", "dim"],
      action: () => setThemeMode("dark"),
    },
    {
      id: "theme-system",
      category: "theme",
      label: t("commandPalette.themeSystem"),
      description: t("commandPalette.themeSystemDesc"),
      keywords: ["theme", "system", "auto", "preference"],
      action: () => setThemeMode("system"),
    },
  ];
}