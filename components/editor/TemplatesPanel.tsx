"use client";

import { templatePresets } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";

export function TemplatesPanel() {
  const { setFrame, setStylePreset, setAnimationPreset, setZoom } = useEditorStore();

  return (
    <div className="panel templates-panel" style={{ padding: 16, display: "grid", gap: 10, alignContent: "start" }}>
      <h2 className="panel-title">Templates</h2>
      <div className="templates">
        {templatePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="template-card"
            onClick={() => {
              setFrame(preset.frame);
              setStylePreset(preset.stylePreset);
              setAnimationPreset(preset.animationPreset);
              setZoom(preset.zoom);
            }}
          >
            <div className="t-name">{preset.name}</div>
            <div className="t-desc">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
