"use client";

import { useTranslations } from "next-intl";
import { backgroundPresets } from "@/lib/presets/presets";
import { buildPatternSwatchStyle } from "@/lib/render/patternSwatch";
import type { BackgroundMode, PatternId } from "@/lib/types/editor";

interface BackgroundPresetGridProps {
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  gradientVia: string | null;
  gradientType: "linear" | "radial";
  patternId: PatternId | null;
  setBackgroundSolid: (color: string) => void;
  setBackgroundGradient: (from: string, to: string, angle?: number, gradientVia?: string | null) => void;
  setBackgroundPattern: (patternId: PatternId) => void;
}

/** The swatch grid of canned solid/gradient/pattern presets, shown only for the
 *  matching mode. Highlights the currently-applied preset. */
export function BackgroundPresetGrid({
  backgroundMode,
  backgroundColor,
  gradientFrom,
  gradientTo,
  gradientAngle,
  gradientVia,
  gradientType,
  patternId,
  setBackgroundSolid,
  setBackgroundGradient,
  setBackgroundPattern
}: BackgroundPresetGridProps) {
  const t = useTranslations();
  return (
    <div className="bg-preset-group">
      <span className="field-label">{t("editor.bgPresets")}</span>
      <div className="bg-swatches">
        {backgroundPresets
          .filter((preset) => preset.kind === backgroundMode)
          .map((preset) => {
            // Gradient presets are two-stop linear gradients, so only an exact
            // match on both stops (and no middle color / radial override)
            // counts as applied.
            const active =
              (preset.kind === "solid" && backgroundColor === preset.backgroundColor) ||
              (preset.kind === "gradient" &&
                gradientType === "linear" &&
                gradientVia == null &&
                gradientFrom === preset.gradientFrom &&
                gradientTo === preset.gradientTo) ||
              (preset.kind === "pattern" && patternId === preset.patternId);
            return (
              <button
                key={preset.id}
                type="button"
                className="swatch-btn"
                title={t(`preset.${preset.id}`)}
                aria-label={t(`preset.${preset.id}`)}
                aria-pressed={active}
                onClick={() => {
                  if (preset.kind === "solid" && preset.backgroundColor) setBackgroundSolid(preset.backgroundColor);
                  else if (preset.kind === "gradient" && preset.gradientFrom && preset.gradientTo)
                    setBackgroundGradient(preset.gradientFrom, preset.gradientTo, gradientAngle, null);
                  else if (preset.kind === "pattern" && preset.patternId) setBackgroundPattern(preset.patternId);
                }}
                style={{
                  background:
                    preset.kind === "gradient"
                      ? `linear-gradient(135deg, ${preset.gradientFrom}, ${preset.gradientTo})`
                      : preset.kind === "pattern"
                        ? buildPatternSwatchStyle(preset.patternId!)
                        : preset.swatch,
                  border: active ? "2px solid var(--accent)" : undefined
                }}
              />
            );
          })}
      </div>
    </div>
  );
}
