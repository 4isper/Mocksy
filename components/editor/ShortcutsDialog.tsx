"use client";

import { useEffect } from "react";

type Shortcut = { keys: string[]; label: string };
type ShortcutGroup = { title: string; items: Shortcut[] };

// Mirror of the handlers registered in EditorShell's keydown listener. ⌘ is
// Cmd on macOS; Ctrl is accepted everywhere (event.metaKey || event.ctrlKey).
const GROUPS: ShortcutGroup[] = [
  {
    title: "Edit",
    items: [
      { keys: ["⌘", "Z"], label: "Undo" },
      { keys: ["⇧", "⌘", "Z"], label: "Redo" },
      { keys: ["⌘", "S"], label: "Save to localStorage" }
    ]
  },
  {
    title: "Export",
    items: [
      { keys: ["⌘", "E"], label: "Export PNG" },
      { keys: ["⇧", "⌘", "C"], label: "Copy PNG to clipboard" },
      { keys: ["⇧", "⌘", "E"], label: "Export MP4" },
      { keys: ["⇧", "⌘", "G"], label: "Export GIF" }
    ]
  },
  {
    title: "Layers",
    items: [
      { keys: ["⌘", "D"], label: "Duplicate active layer" },
      { keys: ["⌘", "↑"], label: "Move layer up" },
      { keys: ["⌘", "↓"], label: "Move layer down" },
      { keys: ["⌘", "["], label: "Select previous layer" },
      { keys: ["⌘", "]"], label: "Select next layer" }
    ]
  },
  {
    title: "Scene",
    items: [{ keys: ["R"], label: "Reset to defaults" }]
  }
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal shortcuts"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="shortcuts-title">Keyboard shortcuts</h3>
        <p>⌘ = Cmd on macOS, Ctrl on Windows and Linux. Layer shortcuts are ignored while typing in a field.</p>
        <div className="shortcut-list">
          {GROUPS.map((group) => (
            <section key={group.title} className="shortcut-group">
              <h4>{group.title}</h4>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label} className="shortcut-row">
                    <span className="shortcut-keys">
                      {item.keys.map((key, i) => (
                        <kbd key={i} className="kbd">
                          {key}
                        </kbd>
                      ))}
                    </span>
                    <span className="shortcut-label">{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
