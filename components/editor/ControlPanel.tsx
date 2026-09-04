"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import { frameOs } from "@/lib/render/frames";
import { BackgroundControls } from "@/components/editor/BackgroundControls";
import { WatermarkControls } from "@/components/editor/WatermarkControls";
import { ScreenControls } from "@/components/editor/ScreenControls";
import { ForceOpenProvider, Section } from "@/components/editor/Section";
import { MediaSection } from "@/components/editor/sections/MediaSection";
import { TextSection } from "@/components/editor/sections/TextSection";
import { FrameSection } from "@/components/editor/sections/FrameSection";
import { ArrangeSection } from "@/components/editor/sections/ArrangeSection";
import { PositionSection } from "@/components/editor/sections/PositionSection";
import { FiltersSection } from "@/components/editor/sections/FiltersSection";
import { AnimationSection } from "@/components/editor/sections/AnimationSection";

const NO_FORCE_OPEN: ReadonlySet<string> = new Set();

/** Task groups for the control panel: ten undifferentiated accordions scan
 *  poorly, so sections render under four labeled group headings in a fixed
 *  novice-friendly order (what's inside → what device → how it looks →
 *  the canvas around it). Section ids are stable: open/closed prefs,
 *  search keywords and e2e hooks key on them, not on groups. */
const CONTROL_GROUPS = [
  { id: "content", sections: ["media", "text"] },
  { id: "device", sections: ["frame", "arrange", "screen"] },
  { id: "adjust", sections: ["position", "filters", "animation"] },
  { id: "scene", sections: ["background", "watermark"] }
] as const;

type ControlSectionId = (typeof CONTROL_GROUPS)[number]["sections"][number];

const CONTROL_SECTION_IDS: readonly ControlSectionId[] = CONTROL_GROUPS.flatMap((g) => g.sections);

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
    setFrameInstanceFloorReflection,
    setFloorReflection,
    clearFrameInstanceOverrides,
    applyInstanceToAll,
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
      setFrameInstanceFloorReflection: s.setFrameInstanceFloorReflection,
      setFloorReflection: s.setFloorReflection,
      clearFrameInstanceOverrides: s.clearFrameInstanceOverrides,
      applyInstanceToAll: s.applyInstanceToAll,
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
  const floorReflection = editingInstance?.floorReflection ?? scene.floorReflection;
  const onFloorReflection = (on: boolean) =>
    editingInstance ? setFrameInstanceFloorReflection(editingInstance.id, on) : setFloorReflection(on);

  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const isFiltering = normalizedQuery.length > 0;

  const forceOpenIds = useMemo(() => {
    if (!normalizedQuery) return NO_FORCE_OPEN;
    const ids = new Set<string>();
    for (const group of CONTROL_GROUPS) {
      // The group label joins the haystack so a task-level query ("device")
      // opens every member section, not just title/keyword matches.
      const groupLabel = t(`editor.group${group.id.charAt(0).toUpperCase() + group.id.slice(1)}`).toLowerCase();
      for (const id of group.sections) {
        const haystack = `${t(`editor.${id}`)} ${t(`editor.sectionKeywords.${id}`)} ${groupLabel}`.toLowerCase();
        if (haystack.includes(normalizedQuery)) ids.add(id);
      }
    }
    return ids;
  }, [normalizedQuery, t]);

  const sectionNodes: Record<ControlSectionId, ReactNode> = {
    media: <MediaSection />,
    text: <TextSection />,
    frame: <FrameSection />,
    arrange: <ArrangeSection />,
    animation: <AnimationSection />,
    position: <PositionSection />,
    filters: <FiltersSection />,
    background: (
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
    ),
    watermark: (
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
    ),
    screen: (
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
            floorReflection={floorReflection}
            setFloorReflection={onFloorReflection}
            onResetScreen={editingInstance ? () => clearFrameInstanceOverrides(editingInstance.id) : undefined}
            onApplyToAll={editingInstance ? () => applyInstanceToAll(editingInstance.id) : undefined}
          />
        </Section>
    )
  };

  const groupLabel = (groupId: string) =>
    t(`editor.group${groupId.charAt(0).toUpperCase() + groupId.slice(1)}`);

  return (
    <div id="control-panel" className="panel control-panel" style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2 className="panel-title">{t("editor.controls")}</h2>

      <div className="control-search">
        <svg className="control-search-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7.8 7.8l2.7 2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.stopPropagation();
              setQuery("");
            }
          }}
          placeholder={t("editor.searchControls")}
          aria-label={t("editor.searchControlsLabel")}
          autoComplete="off"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            className="control-search-clear"
            onClick={() => setQuery("")}
            title={t("editor.searchControlsClear")}
            aria-label={t("editor.searchControlsClear")}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          </button>
        ) : null}
      </div>

      <ForceOpenProvider ids={isFiltering ? forceOpenIds : NO_FORCE_OPEN}>
        {CONTROL_GROUPS.map((group) => {
          const visible = isFiltering
            ? group.sections.filter((id) => forceOpenIds.has(id))
            : [...group.sections];
          if (visible.length === 0) return null;
          return (
            <div key={group.id} className="control-group" role="group" aria-label={groupLabel(group.id)}>
              <h3 className="control-group-label" aria-hidden="true">{groupLabel(group.id)}</h3>
              {visible.map((id) => (
                <Fragment key={id}>{sectionNodes[id]}</Fragment>
              ))}
            </div>
          );
        })}
      </ForceOpenProvider>

      {isFiltering && forceOpenIds.size === 0 ? (
        <p className="control-search-empty" role="status">{t("editor.noControlsMatch")}</p>
      ) : null}
    </div>
  );
}
