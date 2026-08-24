import type { Command } from "@/lib/types/editor";

export function createEditCommands(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  callbacks: {
    undo: () => void;
    redo: () => void;
    pastLength: number;
    futureLength: number;
    resetScene: () => void;
  }
): Command[] {
  const { undo, redo, pastLength, futureLength, resetScene } = callbacks;
  return [
    {
      id: "undo",
      category: "edit",
      label: t("commandPalette.undo"),
      description: t("commandPalette.undoDesc"),
      shortcut: "⌘Z",
      keywords: ["undo", "back", "revert"],
      action: undo,
      disabled: pastLength === 0,
    },
    {
      id: "redo",
      category: "edit",
      label: t("commandPalette.redo"),
      description: t("commandPalette.redoDesc"),
      shortcut: "⇧⌘Z",
      keywords: ["redo", "forward", "repeat"],
      action: redo,
      disabled: futureLength === 0,
    },
    {
      id: "reset-scene",
      category: "edit",
      label: t("commandPalette.resetScene"),
      description: t("commandPalette.resetSceneDesc"),
      shortcut: "R",
      keywords: ["reset", "default", "clear", "restart"],
      action: resetScene,
    },
  ];
}