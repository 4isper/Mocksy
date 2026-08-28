"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/editor/Segmented";
import { loadMediaFromFile } from "@/lib/media/loadFile";
import { BackgroundPresetGrid } from "@/components/editor/BackgroundPresetGrid";
import { BackgroundSolidControls, BackgroundGradientControls, BackgroundImageControls } from "@/components/editor/BackgroundModeControls";
import { BackgroundMediaPalette } from "@/components/editor/BackgroundMediaPalette";
import type { BackgroundMode, PatternId } from "@/lib/types/editor";

const MODE_ORDER: BackgroundMode[] = ["solid", "gradient", "pattern", "image", "transparent"];

interface BackgroundControlsProps {
  scenePalette: string[] | null;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientVia: string | null;
  gradientType: "linear" | "radial";
  gradientAngle: number;
  patternId: PatternId | null;
  backgroundBlur: number;
  backgroundImageUrl: string | null;
  setBackgroundSolid: (color: string, coalesce?: boolean) => void;
  setBackgroundGradient: (from: string, to: string, angle?: number, gradientVia?: string | null, gradientType?: "linear" | "radial", coalesce?: boolean) => void;
  setBackgroundTransparent: () => void;
  setBackgroundImage: (url: string) => void;
  setBackgroundPattern: (patternId: PatternId) => void;
  setGradientType: (gradientType: "linear" | "radial") => void;
  setGradientVia: (gradientVia: string | null, coalesce?: boolean) => void;
  setBackgroundBlur: (blur: number) => void;
}

export function BackgroundControls({
  scenePalette,
  backgroundMode,
  backgroundColor,
  gradientFrom,
  gradientTo,
  gradientVia,
  gradientType,
  gradientAngle,
  patternId,
  backgroundBlur,
  backgroundImageUrl,
  setBackgroundSolid,
  setBackgroundGradient,
  setBackgroundTransparent,
  setBackgroundImage,
  setBackgroundPattern,
  setGradientType,
  setGradientVia,
  setBackgroundBlur
}: BackgroundControlsProps) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);

  const handleBgFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await loadMediaFromFile(file);
      setError(null);
      setBackgroundImage(url);
    } catch {
      setError(t("editor.bgUploadError"));
    } finally {
      event.target.value = "";
    }
  };

  const modeLabels: Record<BackgroundMode, string> = {
    solid: t("editor.bgModeSolid"),
    gradient: t("editor.bgModeGradient"),
    pattern: t("editor.bgModePattern"),
    image: t("editor.bgModeImage"),
    transparent: t("editor.bgModeTransparent")
  };

  const handleModeChange = (mode: BackgroundMode) => {
    if (mode === backgroundMode) return;
    // Any successful mode switch invalidates a stale hint (e.g. one left over
    // from clicking the image tab before uploading anything).
    setError(null);
    switch (mode) {
      case "solid":
        setBackgroundSolid(backgroundColor);
        break;
      case "gradient":
        setBackgroundGradient(gradientFrom, gradientTo, gradientAngle, gradientVia, gradientType);
        break;
      case "pattern":
        setBackgroundPattern(patternId ?? "dots");
        break;
      case "image":
        // Without an uploaded image there is nothing to switch to; surface a
        // hint instead of silently doing nothing.
        if (backgroundImageUrl) setBackgroundImage(backgroundImageUrl);
        else setError(t("editor.bgNeedImage"));
        break;
      case "transparent":
        setBackgroundTransparent();
        break;
    }
  };

  const showPresetGrid = backgroundMode === "solid" || backgroundMode === "gradient" || backgroundMode === "pattern";

  return (
    <div className="field-group">
      <Segmented
        value={backgroundMode}
        // The image tab is pointless until an image exists — disable it
        // instead of letting it produce a no-op + error message.
        options={MODE_ORDER.map((m) => ({ value: m, label: modeLabels[m], disabled: m === "image" && !backgroundImageUrl }))}
        onChange={handleModeChange}
      />

      {showPresetGrid ? (
        <BackgroundPresetGrid
          backgroundMode={backgroundMode}
          backgroundColor={backgroundColor}
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
          gradientAngle={gradientAngle}
          gradientVia={gradientVia}
          gradientType={gradientType}
          patternId={patternId}
          setBackgroundSolid={setBackgroundSolid}
          setBackgroundGradient={setBackgroundGradient}
          setBackgroundPattern={setBackgroundPattern}
        />
      ) : null}

      {backgroundMode === "solid" ? <BackgroundSolidControls backgroundColor={backgroundColor} setBackgroundSolid={setBackgroundSolid} /> : null}

      {backgroundMode === "gradient" ? (
        <BackgroundGradientControls
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
          gradientVia={gradientVia}
          gradientType={gradientType}
          gradientAngle={gradientAngle}
          setBackgroundGradient={setBackgroundGradient}
          setGradientType={setGradientType}
          setGradientVia={setGradientVia}
        />
      ) : null}

      {backgroundMode === "image" ? (
        <BackgroundImageControls backgroundBlur={backgroundBlur} setBackgroundBlur={setBackgroundBlur} setBackgroundTransparent={setBackgroundTransparent} />
      ) : null}

      <BackgroundMediaPalette
        scenePalette={scenePalette}
        gradientAngle={gradientAngle}
        backgroundMode={backgroundMode}
        backgroundColor={backgroundColor}
        setBackgroundSolid={setBackgroundSolid}
        setBackgroundGradient={setBackgroundGradient}
      />

      <label className="file-trigger">
        {t("editor.uploadBgImage")}
        <input type="file" accept="image/*" onChange={handleBgFile} />
      </label>
      {error ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
