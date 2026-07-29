"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { AnnotationsPanel } from "@/components/editor/AnnotationsPanel";
import { ProjectsPanel } from "@/components/editor/ProjectsPanel";

const icons = {
  templates: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  layers: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5l5 2.5-5 2.5-5-2.5L7 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2 7.5l5 2.5 5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2 10.5l5 2.5 5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  annotations: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 11l-1 2 2-1 7-7a1.4 1.4 0 0 0-2-2L3 11z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  projects: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h2.2l1.4 1.5H11a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 10V3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
} as const;

const tabs = [
  { id: "templates", labelKey: "templates.title" },
  { id: "layers", labelKey: "editor.layers" },
  { id: "annotations", labelKey: "editor.annotations" },
  { id: "projects", labelKey: "projects.title" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function RightPanel() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<TabId>("layers");
  const layersCount = useEditorStore((s) => s.scene.layers.length);
  const annotationsCount = useEditorStore((s) => s.scene.annotations.length);
  const [animDir, setAnimDir] = useState<"left" | "right">("right");

  const switchTab = (id: TabId) => {
    const idx = tabs.findIndex((t) => t.id === id);
    const cur = tabs.findIndex((t) => t.id === activeTab);
    setAnimDir(idx > cur ? "right" : "left");
    setActiveTab(id);
  };

  return (
    <div className="right-panel panel" style={{ padding: 0, display: "grid", gridTemplateRows: "auto 1fr", gridTemplateColumns: "minmax(0, 1fr)", overflow: "hidden" }}>
      <div className="right-panel-tabs" role="tablist">
        {tabs.map((tab) => {
          const count = tab.id === "layers" ? layersCount : tab.id === "annotations" ? annotationsCount : null;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "is-active" : ""}
              onClick={() => switchTab(tab.id)}
            >
              <span className="tab-icon">{icons[tab.id as TabId]}</span>
              <span className="tab-label">{t(tab.labelKey)}</span>
              {count != null && count > 0 ? (
                <span className="tab-badge">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="right-panel-content" role="tabpanel" data-dir={animDir} key={activeTab}>
        {activeTab === "templates" && <TemplatesPanel />}
        {activeTab === "layers" && <LayersPanel />}
        {activeTab === "annotations" && <AnnotationsPanel />}
        {activeTab === "projects" && <ProjectsPanel />}
      </div>
    </div>
  );
}
