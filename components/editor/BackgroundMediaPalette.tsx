"use client";

import { useTranslations } from "next-intl";
import { pickBestSolid, pickGradientPair } from "@/lib/media/palette";

interface BackgroundMediaPaletteProps {
  scenePalette: string[] | null;
  gradientAngle: number;
  backgroundMode: "solid" | "gradient" | "pattern" | "image" | "transparent";
  backgroundColor: string;
  setBackgroundSolid: (color: string) => void;
  setBackgroundGradient: (from: string, to: string, angle?: number) => void;
}

/** Auto-background helpers driven by the active media's extracted palette: a
 *  derived gradient/solid plus the raw palette swatches. */
export function BackgroundMediaPalette({
  scenePalette,
  gradientAngle,
  backgroundMode,
  backgroundColor,
  setBackgroundSolid,
  setBackgroundGradient
}: BackgroundMediaPaletteProps) {
  const t = useTranslations();
  const hasPalette = scenePalette != null && scenePalette.length > 0;

  // Cycle through a fixed set of angles so repeated clicks are predictable
  // instead of jumping to a random angle each time.
  const nextAngle = () => {
    const angles = [0, 45, 90, 135, 180];
    const currentIndex = angles.indexOf(gradientAngle);
    return angles[(currentIndex + 1) % angles.length]!;
  };

  return (
    <div className="bg-media-group">
      <span className="field-label">{t("editor.bgFromMedia")}</span>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="auto-bg-btn"
          disabled={!hasPalette}
          title={hasPalette ? t("editor.autoBgTooltip") : t("editor.autoBgDisabled")}
          onClick={() => {
            if (!hasPalette) return;
            const [from, to] = pickGradientPair(scenePalette!);
            setBackgroundGradient(from, to, nextAngle());
          }}
        >
          {t("editor.autoBackground")}
        </button>
        <button
          type="button"
          className="auto-bg-btn"
          disabled={!hasPalette}
          title={t("editor.autoSolidTooltip")}
          onClick={() => {
            if (!hasPalette) return;
            setBackgroundSolid(pickBestSolid(scenePalette!));
          }}
        >
          {t("editor.autoSolid")}
        </button>
      </div>
      {hasPalette ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {scenePalette!.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={backgroundMode === "solid" && backgroundColor === color}
              title={color}
              onClick={() => setBackgroundSolid(color)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                cursor: "pointer",
                border: backgroundMode === "solid" && backgroundColor === color ? "2px solid var(--accent)" : "1px solid var(--panel-border)",
                background: color
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
