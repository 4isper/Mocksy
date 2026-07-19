"use client";

import { templatePresets } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";

export function TemplatesPanel() {
  const { setFrame, setStylePreset, setAnimationPreset, setZoom } = useEditorStore();

  return (
    <div className="panel" style={{ padding: 16, display: "grid", gap: 8, alignContent: "start" }}>
      <h2 className="panel-title">Templates</h2>
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
          {preset.name}
        </button>
      ))}
    </div>
  );
}
