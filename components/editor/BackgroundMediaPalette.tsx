"use client";

import { useTranslations } from "next-intl";
import { gradientMiddleStop, pickBestSolid, pickHarmonicPair, type HueScheme } from "@/lib/media/palette";

/** Color-harmony schemes cycled through on each "auto gradient" click. */
const SCHEMES: HueScheme[] = ["complementary", "analogous", "triadic"];

interface BackgroundMediaPaletteProps {
  scenePalette: string[] | null;
  gradientAngle: number;
  backgroundMode: "solid" | "gradient" | "pattern" | "image" | "transparent";
  backgroundColor: string;
  setBackgroundSolid: (color: string) => void;
  setBackgroundGradient: (from: string, to: string, angle?: number, gradientVia?: string | null) => void;
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
  // instead of jumping to a random angle each time. An angle outside the list
  // (e.g. the 120° default) advances to the next listed angle above it.
  const nextAngle = () => {
    const angles = [0, 45, 90, 135, 180];
    return angles.find((a) => a > gradientAngle) ?? angles[0]!;
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
            const [from, to] = pickHarmonicPair(scenePalette!, SCHEMES[Math.floor(Math.random() * SCHEMES.length)]!);
            const via = gradientMiddleStop(from, to);
            setBackgroundGradient(from, to, nextAngle(), via);
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
