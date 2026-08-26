"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";

type SheetId = "controls" | "right";

const icons = {
  controls: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2.5 5h8m3 0h2M2.5 13h2m3 0h9M12.5 3v4M5.5 11v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  layers: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2.5 16 6l-7 3.5L2 6l7-3.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m4 8.5-2 1L9 13l7-3.5-2-1" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  export: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2.5v8m0 0 3-3m-3 3-3-3M3.5 12v2a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 14.5 14v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
} as const;

/** Fixed bottom navigation shown at the <=768px breakpoint, where the side
 *  panels live off-flow as bottom sheets. Each tab toggles its sheet; Export
 *  opens the shared export dialog instead of a sheet. */
export function MobileTabBar({ onExport }: { onExport: () => void }) {
  const t = useTranslations();
  const sheet = useEditorStore((s) => s.mobileSheet);
  const setSheet = useEditorStore((s) => s.setMobileSheet);

  // Escape closes whichever sheet is open — mirrors the modal dialogs' Esc
  // behaviour without routing through the global shortcut table.
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, setSheet]);

  const toggle = (id: SheetId) => setSheet(sheet === id ? null : id);

  return (
    <nav className="mobile-tabbar" aria-label={t("editor.panels")}>
      <button
        type="button"
        className={sheet === "controls" ? "mtab is-active" : "mtab"}
        aria-expanded={sheet === "controls"}
        aria-controls="control-panel"
        onClick={() => toggle("controls")}
      >
        {icons.controls}
        <span>{t("editor.controls")}</span>
      </button>
      <button
        type="button"
        className={sheet === "right" ? "mtab is-active" : "mtab"}
        aria-expanded={sheet === "right"}
        aria-controls="right-panel"
        onClick={() => toggle("right")}
      >
        {icons.layers}
        <span>{t("editor.panelsTab")}</span>
      </button>
      <button
        type="button"
        className="mtab"
        onClick={onExport}
      >
        {icons.export}
        <span>{t("editor.exportTab")}</span>
      </button>
    </nav>
  );
}
