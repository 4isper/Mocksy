"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import type { RightTabId } from "@/lib/state/editorStoreTypes";
import { TemplatesPanel } from "@/components/editor/TemplatesPanel";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { AnnotationsPanel } from "@/components/editor/AnnotationsPanel";
import { HistoryPanel } from "@/components/editor/HistoryPanel";
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
  history: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2.5a4.5 4.5 0 1 1-4.3 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M2.7 3v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7V4.5l-1.6 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
  { id: "history", labelKey: "history.title" },
  { id: "projects", labelKey: "projects.title" },
] as const;

type TabId = RightTabId;

export function RightPanel() {
  const t = useTranslations();
  const rightTab = useEditorStore((s) => s.rightTab);
  const setRightTab = useEditorStore((s) => s.setRightTab);
  const layersCount = useEditorStore((s) => s.scene.layers.length);
  const annotationsCount = useEditorStore((s) => s.scene.annotations.length);
  const [animDir, setAnimDir] = useState<"left" | "right">("right");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const switchTab = (id: TabId) => {
    const idx = tabs.findIndex((t) => t.id === id);
    const cur = tabs.findIndex((t) => t.id === rightTab);
    setAnimDir(idx > cur ? "right" : "left");
    setRightTab(id);
  };

  // ARIA tablist keyboard support: arrows move between tabs (roving
  // tabindex), Home/End jump to the ends, and focus follows selection.
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = tabs.findIndex((tab) => tab.id === rightTab);
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;
    else return;
    e.preventDefault();
    const next = tabs[nextIdx]!.id;
    switchTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="right-panel panel" style={{ padding: 0, display: "grid", gridTemplateRows: "auto 1fr", gridTemplateColumns: "minmax(0, 1fr)", overflow: "hidden" }}>
      <div className="right-panel-tabs" role="tablist" aria-label={t("editor.panels")} onKeyDown={onTabKeyDown}>
        {tabs.map((tab) => {
          const count = tab.id === "layers" ? layersCount : tab.id === "annotations" ? annotationsCount : null;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              type="button"
              role="tab"
              id={`right-tab-${tab.id}`}
              aria-selected={rightTab === tab.id}
              aria-controls="right-panel-content"
              tabIndex={rightTab === tab.id ? 0 : -1}
              className={rightTab === tab.id ? "is-active" : ""}
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
      <div className="right-panel-content" id="right-panel-content" role="tabpanel" aria-labelledby={`right-tab-${rightTab}`} data-dir={animDir} key={rightTab}>
        {rightTab === "templates" && <TemplatesPanel />}
        {rightTab === "layers" && <LayersPanel />}
        {rightTab === "annotations" && <AnnotationsPanel />}
        {rightTab === "history" && <HistoryPanel />}
        {rightTab === "projects" && <ProjectsPanel />}
      </div>
    </div>
  );
}
