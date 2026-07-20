"use client";

import { sceneStylePresets, applySceneStylePreset } from "@/lib/presets/presets";
import { useEditorStore } from "@/lib/state/editorStore";

export function TemplatesPanel() {
  const setScene = useEditorStore((s) => s.setScene);

  return (
    <div className="panel templates-panel" style={{ padding: 16, display: "grid", gap: 10, alignContent: "start" }}>
      <h2 className="panel-title">Scene presets</h2>
      <div className="templates">
        {sceneStylePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="template-card"
            onClick={() => setScene(applySceneStylePreset(preset), true)}
            title={`Apply ${preset.name}`}
          >
            <div className="t-name">{preset.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
