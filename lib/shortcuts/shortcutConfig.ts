/**
 * Single source of truth for editor keyboard shortcuts. Both the keydown
 * handler (useEditorShortcuts) and the cheat-sheet dialog (ShortcutsDialog)
 * read this list, so they can't drift apart; user rebinding lives in
 * shortcutsStore and overrides `combo` at match time.
 *
 * Combo format: "mod+shift+e" — "mod" means Cmd on macOS / Ctrl elsewhere
 * (the handler accepts either), followed by optional "shift", then a key
 * token: a lowercase letter (matched by PHYSICAL key so non-Latin layouts
 * work), "arrowup"/"arrowdown", "[" or "]".
 */

export type ShortcutSection = "edit" | "export" | "layers" | "scene" | "view";

export interface ShortcutDef {
  id: string;
  /** Default key combination. */
  combo: string;
  /** i18n key under the "shortcuts" namespace. */
  labelKey: string;
  section: ShortcutSection;
  /** Whether the user may rebind this shortcut. Fixed rows are display-only. */
  remappable: boolean;
  /** Mirrors the historical handler: some combos intentionally fire while the
   *  focus is in an input (⌘Z, ⌘S…), others must not hijack typing (R, F…). */
  allowWhileTyping: boolean;
}

/** Remapped, handler-driven shortcuts in match order (first hit wins; combos
 *  are unique so order only matters for readability). */
export const SHORTCUT_DEFS: ShortcutDef[] = [
  { id: "open-command-palette", combo: "mod+k", labelKey: "shortcuts.commandPalette", section: "edit", remappable: false, allowWhileTyping: true },
  { id: "new-project", combo: "mod+n", labelKey: "shortcuts.newProject", section: "edit", remappable: true, allowWhileTyping: true },
  { id: "save-project", combo: "mod+s", labelKey: "shortcuts.saveLocalStorage", section: "edit", remappable: true, allowWhileTyping: true },
  { id: "undo", combo: "mod+z", labelKey: "shortcuts.undo", section: "edit", remappable: true, allowWhileTyping: true },
  { id: "redo", combo: "mod+shift+z", labelKey: "shortcuts.redo", section: "edit", remappable: true, allowWhileTyping: true },
  { id: "paste-media", combo: "mod+v", labelKey: "shortcuts.pasteMedia", section: "edit", remappable: false, allowWhileTyping: false },
  { id: "export-png", combo: "mod+e", labelKey: "shortcuts.exportPng", section: "export", remappable: true, allowWhileTyping: true },
  { id: "copy-png", combo: "mod+shift+c", labelKey: "shortcuts.copyPng", section: "export", remappable: true, allowWhileTyping: true },
  { id: "export-mp4", combo: "mod+shift+e", labelKey: "shortcuts.exportMp4", section: "export", remappable: true, allowWhileTyping: true },
  { id: "export-webm", combo: "mod+shift+w", labelKey: "shortcuts.exportWebm", section: "export", remappable: true, allowWhileTyping: true },
  { id: "export-webp", combo: "mod+shift+p", labelKey: "shortcuts.exportWebp", section: "export", remappable: true, allowWhileTyping: true },
  { id: "export-webp-anim", combo: "mod+shift+a", labelKey: "shortcuts.exportWebpAnim", section: "export", remappable: true, allowWhileTyping: true },
  { id: "export-svg", combo: "mod+shift+s", labelKey: "shortcuts.exportSvg", section: "export", remappable: true, allowWhileTyping: true },
  { id: "export-html", combo: "mod+shift+h", labelKey: "shortcuts.exportHtml", section: "export", remappable: true, allowWhileTyping: true },
  { id: "export-pdf", combo: "mod+shift+f", labelKey: "shortcuts.exportPdf", section: "export", remappable: true, allowWhileTyping: true },
  { id: "export-gif", combo: "mod+shift+g", labelKey: "shortcuts.exportGif", section: "export", remappable: true, allowWhileTyping: true },
  { id: "duplicate-layer", combo: "mod+d", labelKey: "shortcuts.duplicateActiveLayer", section: "layers", remappable: true, allowWhileTyping: false },
  { id: "move-layer-up", combo: "mod+arrowup", labelKey: "shortcuts.moveLayerUp", section: "layers", remappable: true, allowWhileTyping: false },
  { id: "move-layer-down", combo: "mod+arrowdown", labelKey: "shortcuts.moveLayerDown", section: "layers", remappable: true, allowWhileTyping: false },
  { id: "select-prev-layer", combo: "mod+[", labelKey: "shortcuts.selectPrevLayer", section: "layers", remappable: true, allowWhileTyping: false },
  { id: "select-next-layer", combo: "mod+]", labelKey: "shortcuts.selectNextLayer", section: "layers", remappable: true, allowWhileTyping: false },
  { id: "copy-object", combo: "mod+c", labelKey: "shortcuts.copyObject", section: "scene", remappable: true, allowWhileTyping: false },
  { id: "reset-scene", combo: "r", labelKey: "shortcuts.reset", section: "scene", remappable: false, allowWhileTyping: false },
  { id: "fullscreen-preview", combo: "f", labelKey: "shortcuts.fullscreenPreview", section: "scene", remappable: false, allowWhileTyping: false },
  { id: "paste-object", combo: "mod+v", labelKey: "shortcuts.pasteObject", section: "scene", remappable: false, allowWhileTyping: false },
  { id: "nudge-frame", combo: "arrow*", labelKey: "shortcuts.nudgeFrame", section: "scene", remappable: false, allowWhileTyping: false }
];

/** Display-only view shortcuts (handlers hardcode browser-ish combos; no
 *  rebinding in v1 because they shadow native page zoom). */
export const VIEW_SHORTCUTS: ShortcutDef[] = [
  { id: "zoom-in", combo: "mod+plus", labelKey: "shortcuts.zoomIn", section: "view", remappable: false, allowWhileTyping: false },
  { id: "zoom-out", combo: "mod+minus", labelKey: "shortcuts.zoomOut", section: "view", remappable: false, allowWhileTyping: false },
  { id: "zoom-fit", combo: "mod+0", labelKey: "shortcuts.zoomFit", section: "view", remappable: false, allowWhileTyping: false }
];

export interface ParsedCombo {
  mod: boolean;
  shift: boolean;
  /** Lowercase letter, "arrowup"/"arrowdown", "[", "]" or a literal key. */
  key: string;
}

/** Parses a combo string; returns null when malformed (never throws). */
export function parseCombo(combo: string): ParsedCombo | null {
  const parts = combo.split("+").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return null;
  let mod = false;
  let shift = false;
  for (const part of parts.slice(0, -1)) {
    if (part === "mod") mod = true;
    else if (part === "shift") shift = true;
    else return null;
  }
  const key = parts[parts.length - 1]!;
  if (!/^[a-z0-9]$|^arrow(up|down)$|^\[$|^\]$|^\+$|^\-$/.test(key)) return null;
  return { mod, shift, key };
}

/** Serializes a keyboard event into the same combo grammar, using the
 *  precomputed physical letter/bracket from the hook. Returns null when the
 *  event carries no usable primary key. */
export function comboFromEvent(event: KeyboardEvent, letter: string, bracket: string | null): string | null {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("mod");
  if (event.shiftKey) parts.push("shift");
  const lower = event.key.toLowerCase();
  const key = bracket ?? (letter || (lower.length === 1 || lower.startsWith("arrow") || lower === "escape" || /^f\d{1,2}$/.test(lower) ? lower : ""));
  if (!key) return null;
  parts.push(key);
  return parts.join("+");
}

/** True when the event matches the (possibly overridden) combo. Letters are
 *  matched physically first (event.code) so layouts like Cyrillic keep working. */
export function eventMatchesCombo(event: KeyboardEvent, letter: string, bracket: string | null, combo: string): boolean {
  const parsed = parseCombo(combo);
  if (!parsed) return false;
  const mod = event.metaKey || event.ctrlKey;
  if (parsed.mod !== mod) return false;
  if (parsed.shift !== event.shiftKey) return false;
  if (parsed.key === "arrowup" || parsed.key === "arrowdown") return event.key.toLowerCase() === parsed.key;
  if (parsed.key === "[") return bracket === "[";
  if (parsed.key === "]") return bracket === "]";
  if (/^[a-z]$/.test(parsed.key)) return letter === parsed.key;
  return event.key.toLowerCase() === parsed.key;
}

/** Letter for shortcut matching, taken from `event.code` (the physical key) so
 *  shortcuts keep working on non-Latin layouts — ⌘S under a Russian layout
 *  produces key "ы", but still code "KeyS". Falls back to a single-character
 *  `event.key` for synthetic events that carry no code (tests). */
export function eventLetter(event: KeyboardEvent): string {
  const fromCode = /^Key([A-Z])$/.exec(event.code)?.[1]?.toLowerCase();
  if (fromCode) return fromCode;
  const key = event.key.toLowerCase();
  return key.length === 1 ? key : "";
}

/** "[" / "]" for the layer-selection cycle, physical-key first like letters. */
export function eventBracket(event: KeyboardEvent): "[" | "]" | null {
  if (event.code === "BracketLeft" || event.key === "[") return "[";
  if (event.code === "BracketRight" || event.key === "]") return "]";
  return null;
}

/** True while the event is a lone modifier press (nothing to bind yet). */
export function isModifierKey(key: string): boolean {
  return key === "Meta" || key === "Control" || key === "Shift" || key === "Alt" || key === "CapsLock";
}

/** Human-readable kbd tokens for display: ["⇧", "⌘", "E"]. */
export function comboToDisplayTokens(combo: string): string[] {
  const parsed = parseCombo(combo);
  if (!parsed) return [];
  const tokens: string[] = [];
  if (parsed.shift) tokens.push("⇧");
  if (parsed.mod) tokens.push("⌘");
  const keyLabels: Record<string, string> = {
    arrowup: "↑",
    arrowdown: "↓",
    "[": "[",
    "]": "]",
    plus: "+",
    minus: "−"
  };
  tokens.push(/^[a-z0-9]$/.test(parsed.key) ? parsed.key.toUpperCase() : keyLabels[parsed.key] ?? parsed.key);
  return tokens;
}
