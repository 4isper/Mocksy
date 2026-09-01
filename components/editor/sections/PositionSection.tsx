"use client";

import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/lib/state/editorStore";
import { Segmented } from "@/components/editor/Segmented";
import { Section } from "@/components/editor/Section";

export function PositionSection() {
  const t = useTranslations();
  const {
    scene,
    activeLayerId,
    setMediaFit,
    setZoom,
    setMediaOffsetX,
    setMediaOffsetY,
    setRotation,
    setShadowOpacity,
    setBorderRadius,
    setTiltX,
    setTiltY
  } = useEditorStore(
    useShallow((s) => ({
      scene: s.scene,
      activeLayerId: s.activeLayerId,
      setMediaFit: s.setMediaFit,
      setZoom: s.setZoom,
      setMediaOffsetX: s.setMediaOffsetX,
      setMediaOffsetY: s.setMediaOffsetY,
      setRotation: s.setRotation,
      setShadowOpacity: s.setShadowOpacity,
      setBorderRadius: s.setBorderRadius,
      setTiltX: s.setTiltX,
      setTiltY: s.setTiltY
    }))
  );

  const activeLayer = scene.layers.find((l) => l.id === activeLayerId) ?? scene.layers[0];

  return (
    <Section
      id="position"
      title={t("editor.position")}
      icon={(
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 2.5h2v2h-2zM7.5 2.5h2v2h-2zM2.5 7.5h2v2h-2zM7.5 7.5h2v2h-2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>
      )}
    >
      <div className="field-group">
        <span className="field-label scope-label">{t("editor.positionLayerScope")}</span>
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
          <span>{t("editor.rotation")}</span>
          <div className="range-wrap">
            <input type="range" min={-180} max={180} step={1} value={activeLayer?.rotation ?? 0} aria-label={t("editor.rotation")} aria-valuetext={`${Math.round(activeLayer?.rotation ?? 0)}°`} onChange={(e) => setRotation(Number(e.target.value))} />
            <span className="range-val">{Math.round(activeLayer?.rotation ?? 0)}°</span>
          </div>
        </label>
        <span className="field-label scope-label">{t("editor.positionSceneScope")}</span>
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
  );
}
