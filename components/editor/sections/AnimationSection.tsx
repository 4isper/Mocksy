"use client";

import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import type { AnimationEasing, AnimationPreset, EntranceAnimation } from "@/lib/types/editor";
import { ANIMATION_PRESETS } from "@/lib/render/frames";
import { Segmented } from "@/components/editor/Segmented";
import { Section } from "@/components/editor/Section";

const ENTRANCE_ANIMATIONS: EntranceAnimation[] = ["none", "fadeIn", "slideUp", "slideDown", "slideLeft", "slideRight", "scaleUp"];

export function AnimationSection() {
  const t = useTranslations();
  const {
    scene,
    activeLayerId,
    setAnimationPreset,
    setAnimationEasing,
    setAnimationDuration,
    setEntranceAnimation,
    setEntranceDuration
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      activeLayerId: s.activeLayerId,
      setAnimationPreset: s.setAnimationPreset,
      setAnimationEasing: s.setAnimationEasing,
      setAnimationDuration: s.setAnimationDuration,
      setEntranceAnimation: s.setEntranceAnimation,
      setEntranceDuration: s.setEntranceDuration
    }))
  );

  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];

  const animLabels: Record<AnimationPreset, string> = {
    none: t("animation.none"),
    zoomIn: t("animation.zoomIn"),
    zoomOut: t("animation.zoomOut"),
    parallax: t("animation.parallax"),
    panLeft: t("animation.panLeft"),
    panRight: t("animation.panRight"),
    breathe: t("animation.breathe"),
    float: t("animation.float"),
    sway: t("animation.sway")
  };
  const easingLabels: Record<AnimationEasing, string> = {
    linear: t("animation.easingLinear"),
    easeInOut: t("animation.easingEaseInOut"),
    easeOut: t("animation.easingEaseOut"),
    bounce: t("animation.easingBounce"),
    spring: t("animation.easingSpring")
  };
  const entranceLabels: Record<EntranceAnimation, string> = {
    none: t("animation.none"),
    fadeIn: t("animation.fadeIn"),
    slideUp: t("animation.slideUp"),
    slideDown: t("animation.slideDown"),
    slideLeft: t("animation.slideLeft"),
    slideRight: t("animation.slideRight"),
    scaleUp: t("animation.scaleUp")
  };

  const layerLabel = activeLayer?.mediaName ?? (activeLayer?.mediaType === "video" ? t("editor.videoLabel") : t("editor.imageLabel"));
  const entranceDurationSec = (activeLayer?.entranceDuration ?? 600) / 1000;

  return (
    <Section
      id="animation"
      defaultOpen={false}
      title={t("editor.animation")}
      icon={(
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h2l1-3 2 6 1-3h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      )}
    >
      <div className="field-group">
        <p style={{ color: "var(--text-dim)", fontSize: 12, margin: 0 }}>{t("editor.animationLayerHint", { layer: layerLabel })}</p>
        <Segmented
          label={t("editor.animation")}
          value={activeLayer?.animationPreset ?? "none"}
          options={ANIMATION_PRESETS.map((a) => ({ value: a, label: animLabels[a] }))}
          onChange={setAnimationPreset}
        />
        <Segmented
          label={t("editor.easing")}
          value={activeLayer?.animationEasing ?? "easeInOut"}
          options={(Object.keys(easingLabels) as AnimationEasing[]).map((e) => ({ value: e, label: easingLabels[e] }))}
          onChange={setAnimationEasing}
          disabled={activeLayer?.animationPreset === "none"}
        />
        <label className="field">
          <span>{t("editor.animationDuration", { val: scene.animationDurationMs / 1000 })}</span>
          <div className="range-wrap">
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={scene.animationDurationMs / 1000}
              disabled={activeLayer?.animationPreset === "none"}
              aria-label={t("editor.animationDuration", { val: scene.animationDurationMs / 1000 })}
              aria-valuetext={`${scene.animationDurationMs / 1000}s`}
              onChange={(e) => setAnimationDuration(Math.round(Number(e.target.value) * 1000))}
            />
            <span className="range-val">{scene.animationDurationMs / 1000}s</span>
          </div>
        </label>
      </div>
      <div className="field-group" style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 8 }}>
        <p style={{ color: "var(--text-dim)", fontSize: 12, margin: "0 0 4px" }}>{t("editor.entranceAnimation")}</p>
        <Segmented
          label={t("editor.entranceAnimation")}
          value={activeLayer?.entranceAnimation ?? "none"}
          options={ENTRANCE_ANIMATIONS.map((a) => ({ value: a, label: entranceLabels[a] }))}
          onChange={setEntranceAnimation}
        />
        <label className="field">
          <span>{t("editor.entranceDuration", { val: entranceDurationSec })}</span>
          <div className="range-wrap">
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.1}
              value={entranceDurationSec}
              disabled={!activeLayer?.entranceAnimation || activeLayer.entranceAnimation === "none"}
              aria-label={t("editor.entranceDuration", { val: entranceDurationSec })}
              aria-valuetext={`${entranceDurationSec}s`}
              onChange={(e) => setEntranceDuration(Math.round(Number(e.target.value) * 1000))}
            />
            <span className="range-val">{entranceDurationSec}s</span>
          </div>
        </label>
      </div>
    </Section>
  );
}
