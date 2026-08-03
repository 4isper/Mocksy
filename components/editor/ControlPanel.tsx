"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import type { AnimationPreset, StylePreset } from "@/lib/types/editor";
import { ANIMATION_PRESETS, ASPECT_RATIOS } from "@/lib/render/frames";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { VideoOptions } from "@/components/editor/VideoOptions";
import { Segmented } from "@/components/editor/Segmented";
import { FrameInstanceList } from "@/components/editor/FrameInstanceList";
import { BackgroundControls } from "@/components/editor/BackgroundControls";
import { WatermarkControls } from "@/components/editor/WatermarkControls";
import { Section } from "@/components/editor/Section";
import { FramePicker } from "@/components/editor/FramePicker";

const styles: StylePreset[] = ["default", "glassLight", "glassDark", "outline"];
const animations = ANIMATION_PRESETS;
const aspectRatios = ASPECT_RATIOS;

export function ControlPanel() {
  const t = useTranslations();
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [expandedFrameId, setExpandedFrameId] = useState<string | null>(null);
  const {
    scene,
    scenePalette,
    setMedia,
    setFrame,
    setFrameInstances,
    removeFrameInstance,
    updateFrameInstance,
    selectFrameInstance,
    layoutFrameGrid,
    applyFrameLayout,
    setStylePreset,
    setAnimationPreset,
    setZoom,
    setMediaOffsetX,
    setMediaOffsetY,
    setMediaFit,
    setShadowOpacity,
    setBorderRadius,
    setTiltX,
    setTiltY,
    setAnimationDuration,
    setBackgroundSolid,
    setBackgroundGradient,
    setBackgroundTransparent,
    setBackgroundImage,
    setBackgroundPattern,
    setGradientType,
    setGradientVia,
    setBackgroundBlur,
    setScenePalette,
    toggleWatermark,
    setWatermarkText,
    setWatermarkPosition,
    setWatermarkSize,
    setAspectRatio,
    activeLayerId
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      scenePalette: s.scenePalette,
      activeLayerId: s.activeLayerId,
      setMedia: s.setMedia,
      setFrame: s.setFrame,
      setFrameInstances: s.setFrameInstances,
      removeFrameInstance: s.removeFrameInstance,
      updateFrameInstance: s.updateFrameInstance,
      selectFrameInstance: s.selectFrameInstance,
      layoutFrameGrid: s.layoutFrameGrid,
      applyFrameLayout: s.applyFrameLayout,
      setStylePreset: s.setStylePreset,
      setAnimationPreset: s.setAnimationPreset,
      setZoom: s.setZoom,
      setMediaOffsetX: s.setMediaOffsetX,
      setMediaOffsetY: s.setMediaOffsetY,
      setMediaFit: s.setMediaFit,
      setShadowOpacity: s.setShadowOpacity,
      setBorderRadius: s.setBorderRadius,
      setTiltX: s.setTiltX,
      setTiltY: s.setTiltY,
      setAnimationDuration: s.setAnimationDuration,
      setBackgroundSolid: s.setBackgroundSolid,
      setBackgroundGradient: s.setBackgroundGradient,
      setBackgroundTransparent: s.setBackgroundTransparent,
      setBackgroundImage: s.setBackgroundImage,
      setBackgroundPattern: s.setBackgroundPattern,
      setGradientType: s.setGradientType,
      setGradientVia: s.setGradientVia,
      setBackgroundBlur: s.setBackgroundBlur,
      setScenePalette: s.setScenePalette,
      toggleWatermark: s.toggleWatermark,
      setWatermarkText: s.setWatermarkText,
      setWatermarkPosition: s.setWatermarkPosition,
      setWatermarkSize: s.setWatermarkSize,
      setAspectRatio: s.setAspectRatio
    }))
  );

  const styleLabels: Record<StylePreset, string> = {
    default: t("style.default"),
    glassLight: t("style.glassLight"),
    glassDark: t("style.glassDark"),
    outline: t("style.outline")
  };
  const animLabels: Record<AnimationPreset, string> = {
    none: t("animation.none"),
    zoomIn: t("animation.zoomIn"),
    zoomOut: t("animation.zoomOut"),
    parallax: t("animation.parallax"),
    panLeft: t("animation.panLeft"),
    panRight: t("animation.panRight"),
    breathe: t("animation.breathe")
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const { url, mediaType, mediaName } = await loadMediaFromFile(file);
      setMediaError(null);
      // Drop any palette from the previous media; a fresh one is computed once
      // the new file decodes in the preview.
      setScenePalette(null);
      setMedia(url, mediaType, mediaName);
    } catch (err) {
      if (err instanceof UnsupportedMediaError) setMediaError(err.message);
      else setMediaError(t("editor.uploadError"));
    } finally {
      event.target.value = "";
    }
  };

  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];

  const sectionIcons = {
    media: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="4.2" cy="4.2" r="0.9" fill="currentColor"/><path d="M1.5 8l2.6-2.6L8 9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ),
    frame: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="2.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 2.5v7M1.5 5h9" stroke="currentColor" strokeWidth="0.8" opacity="0.45"/></svg>
    ),
    position: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 2.5h2v2h-2zM7.5 2.5h2v2h-2zM2.5 7.5h2v2h-2zM7.5 7.5h2v2h-2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>
    ),
    background: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 1.5a4.5 4.5 0 010 9z" fill="currentColor" opacity="0.5"/></svg>
    ),
    watermark: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8.5V6a4 4 0 018 0v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="1" y="8.5" width="2.6" height="2" rx="0.8" stroke="currentColor" strokeWidth="1" /></svg>
    )
  };

  return (
    <div className="panel control-panel" style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2 className="panel-title">{t("editor.controls")}</h2>

      <Section id="media" title={t("editor.media")} icon={sectionIcons.media}>
        <div className="field-group">
          <div className="field">
            <label className="file-trigger">
              {t("editor.uploadMediaShort")}
              <input type="file" accept="image/*,video/*" onChange={handleFile} />
            </label>
            {activeLayer?.mediaUrl ? (
              <button
                type="button"
                className="btn btn-sm"
                title={t("editor.clearMedia")}
                onClick={() => setMedia(null, "none", null)}
              >
                {t("editor.clearMedia")}
              </button>
            ) : null}
          </div>
          {mediaError ? (
            <span role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
              {mediaError}
            </span>
          ) : null}
          {activeLayer && isVideoLayer(activeLayer) && <VideoOptions />}
        </div>
      </Section>

      <Section id="frame" title={t("editor.frame")} icon={sectionIcons.frame}>
        <div className="field-group">
          <FramePicker value={scene.frame} onChange={setFrame} />
          <div className="field" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.frameGrid")}</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center", width: "100%" }}>
              <span style={{ fontSize: 13 }}>↔</span>
              {[2, 3, 4].map((n) => (
                <button
                  key={`h-${n}`}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => layoutFrameGrid(scene.frame, n, "horizontal")}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center", width: "100%" }}>
              <span style={{ fontSize: 13 }}>↕</span>
              {[2, 3, 4].map((n) => (
                <button
                  key={`v-${n}`}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => layoutFrameGrid(scene.frame, n, "vertical")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.layoutLabel")}</span>
            <div style={{ display: "flex", gap: 4, width: "100%" }}>
              {(["grid", "fan", "cascade", "masonry", "stack"] as const).map((layout) => (
                <button
                  key={layout}
                  type="button"
                  className="btn btn-sm"
                  title={t(`editor.layout${layout.charAt(0).toUpperCase() + layout.slice(1)}`)}
                  onClick={() => {
                    const count = Math.max(2, scene.frameInstances.length || 2);
                    applyFrameLayout(scene.frame, count, layout);
                  }}
                >
                  {t(`editor.layout${layout.charAt(0).toUpperCase() + layout.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
          <FrameInstanceList
            scene={scene}
            expandedFrameId={expandedFrameId}
            setExpandedFrameId={setExpandedFrameId}
            selectFrameInstance={selectFrameInstance}
            setFrameInstances={setFrameInstances}
            updateFrameInstance={updateFrameInstance}
            removeFrameInstance={removeFrameInstance}
          />
          <Segmented
            label={t("editor.aspectRatio")}
            value={scene.aspectRatio}
            options={aspectRatios.map((r) => ({ value: r, label: r }))}
            onChange={setAspectRatio}
          />
          <Segmented
            label={t("editor.style")}
            value={scene.stylePreset}
            options={styles.map((s) => ({ value: s, label: styleLabels[s] }))}
            onChange={setStylePreset}
          />
          <Segmented
            label={t("editor.animation")}
            value={activeLayer?.animationPreset ?? "none"}
            options={animations.map((a) => ({ value: a, label: animLabels[a] }))}
            onChange={setAnimationPreset}
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
      </Section>

      <Section id="position" title={t("editor.position")} icon={sectionIcons.position}>
        <div className="field-group">
          <Segmented
            label={t("editor.fillFitLabel")}
            value={activeLayer?.mediaFit ?? "cover"}
            options={[
              { value: "cover", label: t("editor.fill") },
              { value: "contain", label: t("editor.fit") }
            ]}
            onChange={setMediaFit}
          />
          <label className="field">
            <span>{t("editor.zoom")}</span>
            <div className="range-wrap">
              <input type="range" min={0.8} max={1.5} step={0.01} value={activeLayer?.zoom ?? 1} aria-label={t("editor.zoom")} aria-valuetext={`${Math.round((activeLayer?.zoom ?? 1) * 100)}%`} onChange={(e) => setZoom(Number(e.target.value))} />
              <span className="range-val">{Math.round((activeLayer?.zoom ?? 1) * 100)}%</span>
            </div>
          </label>
          <label className="field">
            <span>{t("editor.positionX")}</span>
            <div className="range-wrap">
              <input type="range" min={-1} max={1} step={0.01} value={activeLayer?.mediaOffsetX ?? 0} aria-label={t("editor.positionX")} aria-valuetext={`${Math.round((activeLayer?.mediaOffsetX ?? 0) * 100)}%`} onChange={(e) => setMediaOffsetX(Number(e.target.value))} />
              <span className="range-val">{Math.round((activeLayer?.mediaOffsetX ?? 0) * 100)}%</span>
            </div>
          </label>
          <label className="field">
            <span>{t("editor.positionY")}</span>
            <div className="range-wrap">
              <input type="range" min={-1} max={1} step={0.01} value={activeLayer?.mediaOffsetY ?? 0} aria-label={t("editor.positionY")} aria-valuetext={`${Math.round((activeLayer?.mediaOffsetY ?? 0) * 100)}%`} onChange={(e) => setMediaOffsetY(Number(e.target.value))} />
              <span className="range-val">{Math.round((activeLayer?.mediaOffsetY ?? 0) * 100)}%</span>
            </div>
          </label>
          <label className="field">
            <span>{t("editor.shadowOpacity")}</span>
            <div className="range-wrap">
              <input type="range" min={0} max={1} step={0.01} value={scene.shadowOpacity} aria-label={t("editor.shadowOpacity")} aria-valuetext={`${Math.round(scene.shadowOpacity * 100)}%`} onChange={(e) => setShadowOpacity(Number(e.target.value))} />
              <span className="range-val">{Math.round(scene.shadowOpacity * 100)}%</span>
            </div>
          </label>
          <label className="field">
            <span>{t("editor.cornerRadius")}</span>
            <div className="range-wrap">
              <input type="range" min={0} max={48} step={1} value={scene.borderRadius} aria-label={t("editor.cornerRadius")} aria-valuetext={`${scene.borderRadius}px`} onChange={(e) => setBorderRadius(Number(e.target.value))} />
              <span className="range-val">{scene.borderRadius}px</span>
            </div>
          </label>
          <label className="field">
            <span>{t("editor.tiltX")}</span>
            <div className="range-wrap">
              <input type="range" min={-25} max={25} step={1} value={scene.tiltX} aria-label={t("editor.tiltX")} aria-valuetext={`${scene.tiltX}°`} onChange={(e) => setTiltX(Number(e.target.value))} />
              <span className="range-val">{scene.tiltX}°</span>
            </div>
          </label>
          <label className="field">
            <span>{t("editor.tiltY")}</span>
            <div className="range-wrap">
              <input type="range" min={-25} max={25} step={1} value={scene.tiltY} aria-label={t("editor.tiltY")} aria-valuetext={`${scene.tiltY}°`} onChange={(e) => setTiltY(Number(e.target.value))} />
              <span className="range-val">{scene.tiltY}°</span>
            </div>
          </label>
          </div>
      </Section>

      <Section id="background" title={t("editor.background")} icon={sectionIcons.background}>
        <BackgroundControls
          scenePalette={scenePalette}
          backgroundMode={scene.backgroundMode}
          backgroundColor={scene.backgroundColor}
          gradientFrom={scene.gradientFrom}
          gradientTo={scene.gradientTo}
          gradientVia={scene.gradientVia}
          gradientType={scene.gradientType}
          gradientAngle={scene.gradientAngle}
          patternId={scene.patternId}
          backgroundBlur={scene.backgroundBlur}
          backgroundImageUrl={scene.backgroundImageUrl}
          setBackgroundSolid={setBackgroundSolid}
          setBackgroundGradient={setBackgroundGradient}
          setBackgroundTransparent={setBackgroundTransparent}
          setBackgroundImage={setBackgroundImage}
          setBackgroundPattern={setBackgroundPattern}
          setGradientType={setGradientType}
          setGradientVia={setGradientVia}
          setBackgroundBlur={setBackgroundBlur}
        />
      </Section>

      <Section id="watermark" title={t("editor.watermark")} icon={sectionIcons.watermark}>
        <WatermarkControls
          watermarkEnabled={scene.watermarkEnabled}
          watermarkText={scene.watermarkText}
          watermarkPosition={scene.watermarkPosition}
          watermarkSize={scene.watermarkSize}
          toggleWatermark={toggleWatermark}
          setWatermarkText={setWatermarkText}
          setWatermarkPosition={setWatermarkPosition}
          setWatermarkSize={setWatermarkSize}
        />
      </Section>
    </div>
  );
}
