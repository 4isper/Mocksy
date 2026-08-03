"use client";

import { useTranslations } from "next-intl";
import type { EditorScene, FrameInstance, MockupFrame } from "@/lib/types/editor";
import { FRAME_ORDER } from "@/lib/render/frames";

const frames: MockupFrame[] = FRAME_ORDER;

interface FrameInstanceListProps {
  scene: EditorScene;
  expandedFrameId: string | null;
  setExpandedFrameId: (id: string | null) => void;
  selectFrameInstance: (id: string | null) => void;
  setFrameInstances: (instances: FrameInstance[]) => void;
  updateFrameInstance: (id: string, patch: Partial<FrameInstance>) => void;
  removeFrameInstance: (id: string) => void;
}

export function FrameInstanceList({
  scene,
  expandedFrameId,
  setExpandedFrameId,
  selectFrameInstance,
  setFrameInstances,
  updateFrameInstance,
  removeFrameInstance
}: FrameInstanceListProps) {
  const t = useTranslations();

  const frameLabels: Record<MockupFrame, string> = {
    none: t("frame.none"),
    iphone: t("frame.iphone"),
    iphone15: t("frame.iphone15"),
    iphone16pro: t("frame.iphone16pro"),
    pixel8pro: t("frame.pixel8pro"),
    galaxy24: t("frame.galaxy24"),
    iphoneSE: t("frame.iphoneSE"),
    ipad: t("frame.ipad"),
    galaxyTab: t("frame.galaxyTab"),
    desktop: t("frame.desktop"),
    tablet: t("frame.tablet"),
    macbook: t("frame.macbook"),
    imac: t("frame.imac"),
    notebook: t("frame.notebook"),
    watch: t("frame.watch")
  };

  return (
    <>
      {scene.frameInstances.length > 0 && (
        <div className="field" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("editor.frames")}</span>
          {scene.frameInstances.map((inst, i) => {
            const open = expandedFrameId === inst.id;
            const frameLayer = scene.layers.find((l) => l.id === inst.layerId);
            return (
              <div key={inst.id} className="frame-card">
                <div className="frame-card-head">
                  <button
                    type="button"
                    className="btn-icon tooltip"
                    onClick={() => { setExpandedFrameId(open ? null : inst.id); selectFrameInstance(open ? null : inst.id); }}
                    aria-label={open ? t("editor.collapse") : t("editor.expand")}
                    data-tooltip={open ? t("editor.collapse") : t("editor.expand")}
                    style={{ fontSize: 10 }}
                  >
                    {open ? "▾" : "▸"}
                  </button>
                  <div className="frame-thumb">
                    {frameLayer?.mediaUrl ? (
                      <img src={frameLayer.mediaUrl} alt="" />
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <span className="frame-idx">{i + 1}</span>
                  <button
                    type="button"
                    className="btn-icon tooltip"
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...scene.frameInstances];
                      [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                      setFrameInstances(next);
                    }}
                    aria-label={t("editor.moveUp")}
                    data-tooltip={t("editor.moveUp")}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button
                    type="button"
                    className="btn-icon tooltip"
                    disabled={i === scene.frameInstances.length - 1}
                    onClick={() => {
                      const next = [...scene.frameInstances];
                      [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
                      setFrameInstances(next);
                    }}
                    aria-label={t("editor.moveDown")}
                    data-tooltip={t("editor.moveDown")}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M6 10l4-4M6 10l-4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <select
                    className="frame-device"
                    value={inst.frame}
                    onChange={(e) => updateFrameInstance(inst.id, { frame: e.target.value as MockupFrame })}
                    aria-label={t("editor.frame")}
                  >
                    {frames.map((f) => (
                      <option key={f} value={f}>{frameLabels[f]}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => removeFrameInstance(inst.id)}
                    title={t("editor.removeFrame")}
                    aria-label={t("editor.removeFrame")}
                    style={{ color: "var(--text-faint)" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  </button>
                </div>
                {open && (
                  <div className="frame-card-body">
                    <label className="range-wrap">
                      <span className="range-label">{t("editor.frameX")}</span>
                      <input type="range" min={0} max={1} step={0.01} value={inst.x} aria-label={t("editor.frameX")} aria-valuetext={`${Math.round(inst.x * 100)}%`} onChange={(e) => updateFrameInstance(inst.id, { x: Number(e.target.value) })} />
                      <span className="range-val">{Math.round(inst.x * 100)}%</span>
                    </label>
                    <label className="range-wrap">
                      <span className="range-label">{t("editor.frameY")}</span>
                      <input type="range" min={0} max={1} step={0.01} value={inst.y} aria-label={t("editor.frameY")} aria-valuetext={`${Math.round(inst.y * 100)}%`} onChange={(e) => updateFrameInstance(inst.id, { y: Number(e.target.value) })} />
                      <span className="range-val">{Math.round(inst.y * 100)}%</span>
                    </label>
                    <label className="range-wrap">
                      <span className="range-label">{t("editor.frameScale")}</span>
                      <input type="range" min={0.1} max={3} step={0.01} value={inst.scale} aria-label={t("editor.frameScale")} aria-valuetext={`${Math.round(inst.scale * 100)}%`} onChange={(e) => updateFrameInstance(inst.id, { scale: Number(e.target.value) })} />
                      <span className="range-val">{Math.round(inst.scale * 100)}%</span>
                    </label>
                    <label className="range-wrap" style={{ display: "grid", gap: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)" }}>{t("editor.frameLayer")}</span>
                      <select
                        value={inst.layerId ?? ""}
                        onChange={(e) => updateFrameInstance(inst.id, { layerId: e.target.value || null })}
                        style={{ flex: 1, fontSize: 12, padding: "4px 6px" }}
                      >
                        <option value="">—</option>
                        {scene.layers.map((l, li) => (
                          <option key={l.id} value={l.id}>
                            {l.mediaName || t("editor.empty")} #{li + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
