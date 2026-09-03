"use client";

import { useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";

interface VideoTrimControlProps {
  duration: number;
}

const KEY_STEP = 0.1;
const KEY_STEP_BIG = 1;

/**
 * Dual-thumb trim control. Two overlapping native ranges used to share one
 * track, but the top input always stole taps where the thumbs meet — on touch
 * (24px thumbs) the buried start handle became impossible to grab. This
 * version owns the track: a pointerdown picks the thumb nearest the press
 * position, so both handles stay reachable at any value, and the thumbs are
 * real `role="slider"` buttons with full keyboard support.
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
  // videoTrimEnd doubles as an "untrimmed" sentinel (0); display and thumb
  // position must show the effective end (full duration), not the sentinel.
  const endValue = layer.videoTrimEnd > 0 ? Math.min(layer.videoTrimEnd, max) : max;
  const startPct = (layer.videoTrimStart / max) * 100;
  const endPct = (endValue / max) * 100;

  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<"start" | "end" | null>(null);

  const valueAt = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      return ratio * max;
    },
    [max]
  );

  const applyValue = useCallback(
    (which: "start" | "end", value: number) => {
      // The store clamps start <= end and coalesces the drag into one undo
      // step, so no extra guarding is needed here.
      if (which === "start") setVideoTrimStart(value);
      else setVideoTrimEnd(value);
    },
    [setVideoTrimStart, setVideoTrimEnd]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    const value = valueAt(e.clientX);
    activeRef.current = Math.abs(value - layer.videoTrimStart) <= Math.abs(value - endValue) ? "start" : "end";
    track.setPointerCapture(e.pointerId);
    applyValue(activeRef.current, value);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current) return;
    applyValue(activeRef.current, valueAt(e.clientX));
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    activeRef.current = null;
    const track = trackRef.current;
    if (track?.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
  };

  const onThumbKeyDown = (which: "start" | "end") => (e: React.KeyboardEvent) => {
    const current = which === "start" ? layer.videoTrimStart : endValue;
    const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = current - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = current + step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = max;
    if (next === null) return;
    e.preventDefault();
    applyValue(which, Math.max(0, Math.min(max, next)));
  };

  const railStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: "var(--range-track)"
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
      <div className="trim-label-row">
        <span>{t("videoTrim.trim")}</span>
        <span>
          {layer.videoTrimStart.toFixed(1)}s – {endValue.toFixed(1)}s
        </span>
      </div>
      <div
        ref={trackRef}
        className="trim-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div style={railStyle} />
        <div style={selectedStyle} />
        <button
          type="button"
          role="slider"
          className="trim-thumb"
          aria-label={t("videoTrim.trimStart")}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={Math.round(layer.videoTrimStart * 100) / 100}
          aria-valuetext={`${layer.videoTrimStart.toFixed(1)} seconds`}
          style={{ left: `${startPct}%` }}
          onKeyDown={onThumbKeyDown("start")}
        />
        <button
          type="button"
          role="slider"
          className="trim-thumb"
          aria-label={t("videoTrim.trimEnd")}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={Math.round(endValue * 100) / 100}
          aria-valuetext={`${endValue.toFixed(1)} seconds`}
          style={{ left: `${endPct}%` }}
          onKeyDown={onThumbKeyDown("end")}
        />
      </div>
    </div>
  );
}
