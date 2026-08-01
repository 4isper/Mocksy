"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import type { AnimationPreset, MockupFrame, StylePreset } from "@/lib/types/editor";
import { FRAME_ORDER, ANIMATION_PRESETS, ASPECT_RATIOS } from "@/lib/render/frames";
import { loadMediaFromFile, UnsupportedMediaError } from "@/lib/media/loadFile";
import { isVideoLayer } from "@/lib/render/mediaKind";
import { VideoOptions } from "@/components/editor/VideoOptions";
import { Segmented } from "@/components/editor/Segmented";
import { FrameInstanceList } from "@/components/editor/FrameInstanceList";
import { BackgroundControls } from "@/components/editor/BackgroundControls";
import { WatermarkControls } from "@/components/editor/WatermarkControls";

const frames: MockupFrame[] = FRAME_ORDER;
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
    setStylePreset,
    setAnimationPreset,
    setZoom,
    setMediaOffsetX,
    setMediaOffsetY,
    setMediaFit,
    setShadowOpacity,
    setBorderRadius,
    setAnimationDuration,
    setBackgroundSolid,
    setBackgroundGradient,
    setBackgroundTransparent,
    setBackgroundImage,
    setBackgroundBlur,
    setScenePalette,
    toggleWatermark,
    setWatermarkText,
    setWatermarkPosition,
    setWatermarkSize,
    setAspectRatio
  } = useEditorStore();

  const frameLabels: Record<MockupFrame, string> = {
    none: t("frame.none"),
    iphone: t("frame.iphone"),
    iphone15: t("frame.iphone15"),
    iphone16pro: t("frame.iphone16pro"),
    pixel8pro: t("frame.pixel8pro"),
    galaxy24: t("frame.galaxy24"),
    ipad: t("frame.ipad"),
    desktop: t("frame.desktop"),
    tablet: t("frame.tablet"),
    macbook: t("frame.macbook"),
    imac: t("frame.imac"),
    watch: t("frame.watch")
  };
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
    parallax: t("animation.parallax")
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

  const activeLayer = scene.layers.find((l) => l.id === scene.activeLayerId) ?? scene.layers[0];

  return (
    <div className="panel control-panel" style={{ padding: 16, display: "grid", gap: 16 }}>
      <h2 className="panel-title">{t("editor.controls")}</h2>
      <div className="field-group">
        <div className="field">
          <span>{t("editor.media")}</span>
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

      <div className="divider" />

      <div className="field-group">
        <Segmented
          label={t("editor.frame")}
          value={scene.frame}
          options={frames.map((f) => ({ value: f, label: frameLabels[f] }))}
          onChange={setFrame}
        />
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

      <div className="divider" />

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
      </div>

      <div className="divider" />

      <BackgroundControls
        scenePalette={scenePalette}
        backgroundMode={scene.backgroundMode}
        backgroundColor={scene.backgroundColor}
        gradientFrom={scene.gradientFrom}
        gradientTo={scene.gradientTo}
        gradientAngle={scene.gradientAngle}
        backgroundBlur={scene.backgroundBlur}
        setBackgroundSolid={setBackgroundSolid}
        setBackgroundGradient={setBackgroundGradient}
        setBackgroundTransparent={setBackgroundTransparent}
        setBackgroundImage={setBackgroundImage}
        setBackgroundBlur={setBackgroundBlur}
      />

      <div className="divider" />

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
    </div>
  );
}
