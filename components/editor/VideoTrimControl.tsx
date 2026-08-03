"use client";

import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";

interface VideoTrimControlProps {
  duration: number;
}

/**
 * Dual-range trim control. Two overlapping range inputs share one track; the
 * selected window is painted between them so the user sees the kept segment at
 * a glance instead of two disconnected sliders.
 */
export function VideoTrimControl({ duration }: VideoTrimControlProps) {
  const t = useTranslations();
  const { scene, setVideoTrimStart, setVideoTrimEnd } = useEditorStore(
    useShallow((s) => ({ scene: s.scene, setVideoTrimStart: s.setVideoTrimStart, setVideoTrimEnd: s.setVideoTrimEnd }))
  );
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];
  const layer = activeLayer ?? { videoTrimStart: 0, videoTrimEnd: 0 };
  const max = Math.max(duration, 0.1);
  const startPct = (layer.videoTrimStart / max) * 100;
  const endPct = (layer.videoTrimEnd / max) * 100;

  const trackStyle: React.CSSProperties = {
    position: "relative",
    height: 28,
    display: "grid",
    alignItems: "center"
  };
  const railStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)"
  };
  const selectedStyle: React.CSSProperties = {
    position: "absolute",
    left: `${startPct}%`,
    width: `${Math.max(0, endPct - startPct)}%`,
    height: 4,
    borderRadius: 2,
    backgroundColor: "var(--accent)"
  };

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
        <span>{t("videoTrim.trim")}</span>
        <span>
          {layer.videoTrimStart.toFixed(1)}s – {layer.videoTrimEnd.toFixed(1)}s
        </span>
      </div>
      <div style={trackStyle}>
        <div style={railStyle} />
        <div style={selectedStyle} />
        <input
          type="range"
          min={0}
          max={max}
          step={0.01}
          value={layer.videoTrimStart}
          aria-label={t("videoTrim.trimStart")}
          aria-valuetext={`${layer.videoTrimStart.toFixed(1)} seconds`}
          className="trim-range"
          onChange={(e) => setVideoTrimStart(Number(e.target.value))}
          style={{ zIndex: 3 }}
        />
        <input
          type="range"
          min={0}
          max={max}
          step={0.01}
          value={layer.videoTrimEnd}
          aria-label={t("videoTrim.trimEnd")}
          aria-valuetext={`${layer.videoTrimEnd.toFixed(1)} seconds`}
          className="trim-range"
          onChange={(e) => setVideoTrimEnd(Number(e.target.value))}
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
}
