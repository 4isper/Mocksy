"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import {
  SHORTCUT_DEFS,
  VIEW_SHORTCUTS,
  comboToDisplayTokens,
  comboFromEvent,
  eventLetter,
  eventBracket,
  isModifierKey
} from "@/lib/shortcuts/shortcutConfig";
import { useShortcutsStore, effectiveCombo, findConflict } from "@/lib/state/shortcutsStore";

type SectionKey = "edit" | "export" | "layers" | "scene" | "view";

const SECTION_ORDER: SectionKey[] = ["edit", "export", "layers", "scene", "view"];
const SECTION_TITLES: Record<SectionKey, string> = {
  edit: "shortcuts.edit",
  export: "shortcuts.export",
  layers: "shortcuts.layers",
  scene: "shortcuts.scene",
  view: "shortcuts.view"
};

/**
 * Keyboard cheat sheet rendered from SHORTCUT_DEFS — the same list the global
 * keydown handler matches against, so the dialog can't drift from behavior.
 * Remappable rows offer click-to-record rebinding; overrides persist in
 * shortcutsStore and take effect immediately.
 */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const overrides = useShortcutsStore((s) => s.overrides);
  const setOverride = useShortcutsStore((s) => s.setOverride);
  const clearOverride = useShortcutsStore((s) => s.clearOverride);
  const resetAll = useShortcutsStore((s) => s.resetAll);

  // Id of the row currently waiting for a key press, plus the last conflict.
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  const trapRef = useFocusTrap(open);

  // Single close path resets transient UI state (no effects needed).
  const handleClose = useCallback(() => {
    setRecordingId(null);
    setConflict(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (recordingId) return; // capture listener below owns the keyboard
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose, recordingId]);

  // While recording, the next keydown becomes the new binding. Escape cancels.
  useEffect(() => {
    // While recording, the next keydown becomes the new binding. Escape cancels.
    if (!open || !recordingId) return;
    const onCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isModifierKey(e.key)) return;
      if (e.key === "Escape") {
        setRecordingId(null);
        setConflict(null);
        return;
      }
      const combo = comboFromEvent(e, eventLetter(e), eventBracket(e));
      if (!combo) return;
      const other = findConflict(combo, recordingId, useShortcutsStore.getState().overrides);
      if (other) {
        const def = SHORTCUT_DEFS.find((d) => d.id === other.otherId);
        setConflict(t("shortcuts.conflict", { label: t(def?.labelKey ?? other.otherId) }));
        return;
      }
      setOverride(recordingId, combo);
      setRecordingId(null);
      setConflict(null);
    };
    window.addEventListener("keydown", onCapture, true);
    return () => window.removeEventListener("keydown", onCapture, true);
  }, [open, recordingId, setOverride, t]);

  if (!open) return null;

  const hasOverrides = Object.keys(overrides).length > 0;
  const sections: Record<SectionKey, typeof SHORTCUT_DEFS> = {
    edit: [],
    export: [],
    layers: [],
    scene: [],
    view: []
  };
  for (const def of [...SHORTCUT_DEFS, ...VIEW_SHORTCUTS]) {
    sections[def.section].push(def);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleClose}>
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
          {SECTION_ORDER.map((section) =>
            sections[section].length === 0 ? null : (
              <section key={section} className="shortcut-group">
                <h4>{t(SECTION_TITLES[section])}</h4>
                <ul>
                  {sections[section].map((def) => {
                    const combo = effectiveCombo(def, overrides);
                    const overridden = combo !== def.combo;
                    const recording = recordingId === def.id;
                    return (
                      <li key={def.id} className="shortcut-row">
                        <span className="shortcut-keys">
                          {recording ? (
                            <kbd className="kbd">{t("shortcuts.recording")}</kbd>
                          ) : (
                            comboToDisplayTokens(combo).map((key, i) => (
                              <kbd key={i} className="kbd" style={overridden ? { color: "var(--accent)" } : undefined}>
                                {key}
                              </kbd>
                            ))
                          )}
                        </span>
                        <span className="shortcut-label">{t(def.labelKey)}</span>
                        {def.remappable ? (
                          <>
                            <button
                              type="button"
                              className="btn-icon"
                              aria-label={t("shortcuts.rebind")}
                              title={t("shortcuts.rebind")}
                              onClick={() => {
                                setRecordingId(recording ? null : def.id);
                                setConflict(null);
                              }}
                            >
                              ✎
                            </button>
                            {overridden ? (
                              <button
                                type="button"
                                className="btn-icon"
                                aria-label={t("shortcuts.rebindReset")}
                                title={t("shortcuts.rebindReset")}
                                onClick={() => {
                                  clearOverride(def.id);
                                  setRecordingId(null);
                                  setConflict(null);
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )
          )}
        </div>
        {recordingId ? <p role="status">{t("shortcuts.recordingHint")}</p> : null}
        {conflict ? (
          <p role="alert" style={{ color: "var(--danger)" }}>
            {conflict}
          </p>
        ) : null}
        <div className="modal-actions">
          {hasOverrides ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                resetAll();
                setRecordingId(null);
                setConflict(null);
              }}
            >
              {t("shortcuts.resetAll")}
            </button>
          ) : null}
          <button type="button" className="btn" onClick={handleClose}>
            {t("shortcuts.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
