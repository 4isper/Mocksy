"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import { FrameInstanceList } from "@/components/editor/FrameInstanceList";
import { Section } from "@/components/editor/Section";

const layoutPresets = ["grid", "fan", "cascade", "masonry", "stack"] as const;
const alignModes = ["left", "centerX", "right", "top", "centerY", "bottom"] as const;

const ALIGN_GLYPHS: Record<(typeof alignModes)[number], string> = {
  left: "⇤",
  centerX: "↔",
  right: "⇥",
  top: "⇧",
  centerY: "↕",
  bottom: "⇩"
};

/** Tiny schematic preview of each layout preset so the buttons read at a
 *  glance instead of as bare words. */
function LayoutIcon({ layout }: { layout: (typeof layoutPresets)[number] }) {
  const rects: Array<[number, number, number, number]> =
    layout === "grid"
      ? [[1, 1, 9, 6], [12, 1, 9, 6], [1, 9, 9, 6], [12, 9, 9, 6]]
      : layout === "fan"
        ? [[6, 2, 8, 12], [1, 5, 7, 9], [16, 5, 7, 9]]
        : layout === "cascade"
          ? [[1, 1, 9, 7], [7, 6, 9, 7], [13, 11, 9, 7]]
          : layout === "masonry"
            ? [[1, 1, 9, 10], [12, 1, 9, 6], [1, 13, 9, 6], [12, 9, 9, 10]]
            : /* stack */
              [[1, 3, 10, 8], [6, 7, 10, 8], [11, 11, 10, 8]];
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden focusable="false">
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="1" fill="currentColor" opacity={0.85 - i * 0.08} />
      ))}
    </svg>
  );
}

export function ArrangeSection() {
  const t = useTranslations();
  const [expandedFrameId, setExpandedFrameId] = useState<string | null>(null);
  const [layoutCount, setLayoutCount] = useState(2);
  const [countEdited, setCountEdited] = useState(false);
  const {
    scene,
    selectedFrameIds,
    setFrameInstances,
    removeFrameInstance,
    addFrameInstance,
    reorderFrameInstances,
    updateFrameInstance,
    selectFrameInstance,
    selectFrameIds,
    toggleFrameSelected,
    layoutFrameGrid,
    applyFrameLayout,
    alignFrameInstances,
    distributeFrameInstances
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      selectedFrameIds: s.selectedFrameIds,
      setFrameInstances: s.setFrameInstances,
      removeFrameInstance: s.removeFrameInstance,
      addFrameInstance: s.addFrameInstance,
      reorderFrameInstances: s.reorderFrameInstances,
      updateFrameInstance: s.updateFrameInstance,
      selectFrameInstance: s.selectFrameInstance,
      selectFrameIds: s.selectFrameIds,
      toggleFrameSelected: s.toggleFrameSelected,
      layoutFrameGrid: s.layoutFrameGrid,
      applyFrameLayout: s.applyFrameLayout,
      alignFrameInstances: s.alignFrameInstances,
      distributeFrameInstances: s.distributeFrameInstances
    }))
  );

  // Until the user manually edits the count, it tracks the number of frames
  // already on the canvas so "apply layout" rearranges what's there instead of
  // a hardcoded 2 (which previously dropped distinct frames such as "none").
  const effectiveCount = countEdited ? layoutCount : Math.max(1, scene.frameInstances.length || 1);
  const frameCount = scene.frameInstances.length;

  return (
    <Section
      id="arrange"
      title={t("editor.arrange")}
      icon={(
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2"/><rect x="6.5" y="1.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2"/><rect x="1.5" y="6.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2"/><rect x="6.5" y="6.5" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.2"/></svg>
      )}
    >
      <div className="field-group">
        <div className="field field-row">
          <span className="text-dim-sm">{t("editor.frameGrid")}</span>
          <div className="field-row-full">
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
          <div className="field-row-full">
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
        {frameCount >= 1 ? (
          <div className="field field-row">
            <span className="text-dim-sm">{t("editor.layoutLabel")}</span>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              {t("editor.layoutCount")}
              <input
                type="number"
                min={1}
                max={12}
                value={effectiveCount}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setLayoutCount(Number.isFinite(n) ? Math.min(12, Math.max(1, n)) : 1);
                  setCountEdited(true);
                }}
                className="frame-count-input"
                aria-label={t("editor.layoutCount")}
              />
            </label>
            <div className="field-row-full">
              {layoutPresets.map((layout) => {
                const label = t(`editor.layout${layout.charAt(0).toUpperCase() + layout.slice(1)}`);
                return (
                  <button
                    key={layout}
                    type="button"
                    className="btn btn-sm"
                    title={label}
                    aria-label={label}
                    onClick={() => applyFrameLayout(scene.frame, effectiveCount, layout)}
                  >
                    <LayoutIcon layout={layout} />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {frameCount >= 2 ? (
          <div className="field field-row">
            <span className="text-dim-sm">{t("editor.alignLabel")}</span>
            <div className="field-row-full">
              {alignModes.map((mode) => {
                const label = t(`editor.align${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
                return (
                  <button
                    key={mode}
                    type="button"
                    className="btn btn-sm"
                    title={label}
                    aria-label={label}
                    onClick={() => alignFrameInstances(mode)}
                  >
                    {ALIGN_GLYPHS[mode]}
                  </button>
                );
              })}
              {frameCount >= 3 ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm"
                    title={t("editor.distributeHorizontal")}
                    aria-label={t("editor.distributeHorizontal")}
                    onClick={() => distributeFrameInstances("horizontal")}
                  >
                    ⇔
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    title={t("editor.distributeVertical")}
                    aria-label={t("editor.distributeVertical")}
                    onClick={() => distributeFrameInstances("vertical")}
                  >
                    ⇕
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        {frameCount >= 1 ? (
          <FrameInstanceList
            scene={scene}
            expandedFrameId={expandedFrameId}
            setExpandedFrameId={setExpandedFrameId}
            selectFrameInstance={selectFrameInstance}
            selectFrameIds={selectFrameIds}
            toggleFrameSelected={toggleFrameSelected}
            selectedFrameIds={selectedFrameIds}
            setFrameInstances={setFrameInstances}
            updateFrameInstance={updateFrameInstance}
            removeFrameInstance={removeFrameInstance}
            addFrameInstance={addFrameInstance}
            reorderFrameInstances={reorderFrameInstances}
          />
        ) : null}
      </div>
    </Section>
  );
}
