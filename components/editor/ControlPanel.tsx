"use client";

import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import { frameOs } from "@/lib/render/frames";
import { BackgroundControls } from "@/components/editor/BackgroundControls";
import { WatermarkControls } from "@/components/editor/WatermarkControls";
import { ScreenControls } from "@/components/editor/ScreenControls";
import { Section } from "@/components/editor/Section";
import { MediaSection } from "@/components/editor/sections/MediaSection";
import { TextSection } from "@/components/editor/sections/TextSection";
import { FrameSection } from "@/components/editor/sections/FrameSection";
import { PositionSection } from "@/components/editor/sections/PositionSection";
import { FiltersSection } from "@/components/editor/sections/FiltersSection";
import { AnimationSection } from "@/components/editor/sections/AnimationSection";

export function ControlPanel() {
  const t = useTranslations();
  const {
    scene,
    scenePalette,
    setBackgroundSolid,
    setBackgroundGradient,
    setBackgroundTransparent,
    setBackgroundImage,
    setBackgroundPattern,
    setGradientType,
    setGradientVia,
    setBackgroundBlur,
    toggleWatermark,
    setWatermarkText,
    setWatermarkPosition,
    setWatermarkSize,
    setWatermarkImage,
    setScreenChrome,
    setFrameInstanceScreen,
    clearFrameInstanceScreen,
    applyInstanceScreenToAll,
    activeFrameInstanceId
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      scenePalette: s.scenePalette,
      setBackgroundSolid: s.setBackgroundSolid,
      setBackgroundGradient: s.setBackgroundGradient,
      setBackgroundTransparent: s.setBackgroundTransparent,
      setBackgroundImage: s.setBackgroundImage,
      setBackgroundPattern: s.setBackgroundPattern,
      setGradientType: s.setGradientType,
      setGradientVia: s.setGradientVia,
      setBackgroundBlur: s.setBackgroundBlur,
      toggleWatermark: s.toggleWatermark,
      setWatermarkText: s.setWatermarkText,
      setWatermarkPosition: s.setWatermarkPosition,
      setWatermarkSize: s.setWatermarkSize,
      setWatermarkImage: s.setWatermarkImage,
      setScreenChrome: s.setScreenChrome,
      setFrameInstanceScreen: s.setFrameInstanceScreen,
      clearFrameInstanceScreen: s.clearFrameInstanceScreen,
      applyInstanceScreenToAll: s.applyInstanceScreenToAll,
      activeFrameInstanceId: s.activeFrameInstanceId
    }))
  );

  // When a specific device is selected in a multi-frame scene, the Screen
  // controls edit that device's own chrome; otherwise they edit the scene
  // default that every instance without an override inherits.
  const editingInstance = scene.frameInstances.find((i) => i.id === activeFrameInstanceId) ?? null;
  const onScreenPatch = editingInstance
    ? (patch: Partial<import("@/lib/types/editor").ScreenChrome>) => setFrameInstanceScreen(editingInstance.id, patch)
    : setScreenChrome;

  return (
    <div id="control-panel" className="panel control-panel" style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2 className="panel-title">{t("editor.controls")}</h2>

      <MediaSection />
      <TextSection />
      <FrameSection />
      <AnimationSection />
      <PositionSection />
      <FiltersSection />

      <Section
        id="background"
        title={t("editor.background")}
        icon={(
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 1.5a4.5 4.5 0 010 9z" fill="currentColor" opacity="0.5"/></svg>
        )}
      >
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

      <Section
        id="watermark"
        defaultOpen={false}
        title={t("editor.watermark")}
        icon={(
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8.5V6a4 4 0 018 0v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="1" y="8.5" width="2.6" height="2" rx="0.8" stroke="currentColor" strokeWidth="1" /></svg>
        )}
      >
        <WatermarkControls
          watermarkEnabled={scene.watermarkEnabled}
          watermarkText={scene.watermarkText}
          watermarkPosition={scene.watermarkPosition}
          watermarkSize={scene.watermarkSize}
          watermarkImageUrl={scene.watermarkImageUrl}
          toggleWatermark={toggleWatermark}
          setWatermarkText={setWatermarkText}
          setWatermarkPosition={setWatermarkPosition}
          setWatermarkSize={setWatermarkSize}
          setWatermarkImage={setWatermarkImage}
        />
      </Section>

      <Section
        id="screen"
        defaultOpen={false}
        title={t("editor.screen")}
        icon={(
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="3" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.2"/><path d="M2 3.5h8M2 5h8" stroke="currentColor" strokeWidth="0.8" opacity="0.45"/></svg>
        )}
      >
        <ScreenControls
          screen={editingInstance?.screen ?? scene.screen}
          setScreenChrome={onScreenPatch}
          screenGlare={scene.screenGlare}
          setScreenGlare={(on) => useEditorStore.getState().setScreenGlare(on)}
          scopeHint={editingInstance ? t("editor.screenScopeSelected") : t("editor.screenScopeAll")}
          resolvedOs={(editingInstance?.screen ?? scene.screen).os ?? frameOs(editingInstance?.frame ?? scene.frame)}
          floorReflection={scene.floorReflection}
          setFloorReflection={(on) => useEditorStore.getState().setFloorReflection(on)}
          onResetScreen={editingInstance ? () => clearFrameInstanceScreen(editingInstance.id) : undefined}
          onApplyToAll={editingInstance ? () => applyInstanceScreenToAll(editingInstance.id) : undefined}
        />
      </Section>
    </div>
  );
}
