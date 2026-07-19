"use client";

import { templatePresets } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";

export function TemplatesPanel() {
  const { setFrame, setStylePreset, setAnimationPreset, setZoom } = useEditorStore();

  return (
    <div className="panel" style={{ padding: 16, display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0 }}>Templates</h3>
      {templatePresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
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
