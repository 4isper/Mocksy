"use client";

import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import { isTextLayer } from "@/lib/render/layerText";
import type { TextAlign } from "@/lib/types/editor";
import { Section } from "@/components/editor/Section";

/**
 * Controls for the active text layer's content (content, color, size,
 * alignment, weight). Rendered only when the active layer kind is "text" —
 * media layers keep their Media/Filters sections.
 */
export function TextSection() {
  const t = useTranslations();
  const { layer, updateActiveLayer } = useEditorStore(
    useShallow((s) => {
      const active = s.scene.layers.find((l) => l.id === s.activeLayerId) ?? s.scene.layers[0];
      return { layer: active, updateActiveLayer: s.updateActiveLayer };
    })
  );
  if (!layer || !isTextLayer(layer)) return null;
  // A locked layer rejects every edit; the controls say so instead of silently
  // swallowing the input (updateActiveLayer no-ops on locked layers).
  const layerLocked = layer.locked === true;

  const aligns: { value: TextAlign; labelKey: string }[] = [
    { value: "left", labelKey: "text.alignLeft" },
    { value: "center", labelKey: "text.alignCenter" },
    { value: "right", labelKey: "text.alignRight" }
  ];

  return (
    <Section
      id="text"
      title={t("editor.text")}
      icon={
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2.5h8M6 2.5V10M4.5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      }
    >
      <div className="field-group">
        {layerLocked ? <span role="status" style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.layerLockedHint")}</span> : null}
        <label className="field">
          <span>{t("text.content")}</span>
          <textarea
            rows={2}
            value={layer.textContent ?? ""}
            aria-label={t("text.content")}
            disabled={layerLocked}
            onChange={(e) => updateActiveLayer({ textContent: e.target.value })}
            style={{ resize: "vertical" }}
          />
        </label>
        <div className="field">
          <span>{t("text.color")}</span>
          <input
            type="color"
            value={layer.textColor ?? "#ffffff"}
            aria-label={t("text.color")}
            disabled={layerLocked}
            onChange={(e) => updateActiveLayer({ textColor: e.target.value })}
          />
        </div>
        <label className="field">
          <span>{t("text.size")}</span>
          <input
            type="range"
            min={0.02}
            max={0.5}
            step={0.005}
            value={layer.textSize ?? 0.12}
            aria-label={t("text.size")}
            aria-valuetext={`${Math.round((layer.textSize ?? 0.12) * 100)}%`}
            disabled={layerLocked}
            onChange={(e) => updateActiveLayer({ textSize: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>{t("text.align")}</span>
          <div className="segmented" role="group" aria-label={t("text.align")}>
            {aligns.map((a) => (
              <button
                key={a.value}
                type="button"
                aria-pressed={(layer.textAlign ?? "center") === a.value}
                className={(layer.textAlign ?? "center") === a.value ? "is-active" : undefined}
                disabled={layerLocked}
                onClick={() => updateActiveLayer({ textAlign: a.value })}
              >
                {t(a.labelKey)}
              </button>
            ))}
          </div>
        </label>
        <label className="field">
          <span>{t("text.weight")}</span>
          <div className="segmented" role="group" aria-label={t("text.weight")}>
            {(["bold", "normal"] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={(layer.fontWeight ?? "bold") === w}
                className={(layer.fontWeight ?? "bold") === w ? "is-active" : undefined}
                disabled={layerLocked}
                onClick={() => updateActiveLayer({ fontWeight: w })}
              >
                {t(w === "bold" ? "text.bold" : "text.regular")}
              </button>
            ))}
          </div>
        </label>
      </div>
    </Section>
  );
}
