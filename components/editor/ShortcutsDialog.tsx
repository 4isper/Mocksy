"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

type Shortcut = { keys: string[]; label: string };
type ShortcutGroup = { title: string; items: Shortcut[] };

// Mirror of the handlers registered in EditorShell's keydown listener. ⌘ is
// Cmd on macOS; Ctrl is accepted everywhere (event.metaKey || event.ctrlKey).
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const GROUPS: ShortcutGroup[] = [
    {
      title: t("shortcuts.edit"),
      items: [
        { keys: ["⌘", "N"], label: t("shortcuts.newProject") },
        { keys: ["⌘", "Z"], label: t("shortcuts.undo") },
        { keys: ["⇧", "⌘", "Z"], label: t("shortcuts.redo") },
        { keys: ["⌘", "S"], label: t("shortcuts.saveLocalStorage") }
      ]
    },
    {
      title: t("shortcuts.export"),
      items: [
        { keys: ["⌘", "E"], label: t("shortcuts.exportPng") },
        { keys: ["⇧", "⌘", "C"], label: t("shortcuts.copyPng") },
        { keys: ["⇧", "⌘", "E"], label: t("shortcuts.exportMp4") },
        { keys: ["⇧", "⌘", "W"], label: t("shortcuts.exportWebm") },
        { keys: ["⇧", "⌘", "P"], label: t("shortcuts.exportWebp") },
        { keys: ["⇧", "⌘", "A"], label: t("shortcuts.exportWebpAnim") },
        { keys: ["⇧", "⌘", "S"], label: t("shortcuts.exportSvg") },
        { keys: ["⇧", "⌘", "H"], label: t("shortcuts.exportHtml") },
        { keys: ["⇧", "⌘", "F"], label: t("shortcuts.exportPdf") },
        { keys: ["⇧", "⌘", "G"], label: t("shortcuts.exportGif") }
      ]
    },
    {
      title: t("shortcuts.layers"),
      items: [
        { keys: ["⌘", "D"], label: t("shortcuts.duplicateActiveLayer") },
        { keys: ["⌘", "↑"], label: t("shortcuts.moveLayerUp") },
        { keys: ["⌘", "↓"], label: t("shortcuts.moveLayerDown") },
        { keys: ["⌘", "["], label: t("shortcuts.selectPrevLayer") },
        { keys: ["⌘", "]"], label: t("shortcuts.selectNextLayer") }
      ]
    },
    {
      title: t("shortcuts.scene"),
      items: [
        { keys: ["R"], label: t("shortcuts.reset") },
        { keys: ["F"], label: t("shortcuts.fullscreenPreview") },
        { keys: ["↑", "↓", "←", "→"], label: t("shortcuts.nudgeFrame") }
      ]
    }
  ];

  const trapRef = useFocusTrap(open);

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
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="shortcuts-title">{t("shortcuts.title")}</h3>
        <p>{t("shortcuts.cmdHint")}</p>
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
            {t("shortcuts.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
