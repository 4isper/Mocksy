"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";
import { describeHistoryStep } from "@/lib/state/historyLabels";

const HISTORY_CAP = 100;

export function HistoryPanel() {
  const t = useTranslations();
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const scene = useEditorStore((s) => s.scene);
  const jumpToHistory = useEditorStore((s) => s.jumpToHistory);

  // Timeline = past (done) + present (current) + future (redoable).
  const states = useMemo(() => [...past, scene, ...future], [past, scene, future]);
  const currentIndex = past.length;
  const atCap = past.length >= HISTORY_CAP;

  const currentRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [states.length]);

  return (
    <div style={{ padding: 10, display: "grid", gap: 8, overflow: "auto", minHeight: 0, minWidth: 0 }}>
      <ol className="history-list" aria-label={t("history.title")} style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
        {states.map((state, i) => {
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;
          const label =
            i === 0 ? t("history.initial") : t(`history.change.${describeHistoryStep(states[i - 1]!, state)}`);
          return (
            <li key={i} style={{ margin: 0 }}>
              <button
                ref={isCurrent ? currentRef : undefined}
                type="button"
                disabled={isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => jumpToHistory(i)}
                className={`history-row${isCurrent ? " is-current" : ""}${isFuture ? " is-future" : ""}`}
              >
                <span className="history-dot" aria-hidden="true" />
                <span className="history-label">{label}</span>
                <span className="history-index">{i}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {states.length === 1 ? (
        <span className="history-empty">{t("history.empty")}</span>
      ) : null}
      {atCap ? (
        <span className="history-empty" style={{ fontSize: 11, color: "var(--text-dim)" }}>{t("history.capReached")}</span>
      ) : null}
    </div>
  );
}
