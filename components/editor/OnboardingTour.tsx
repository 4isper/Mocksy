"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/lib/state/editorStore";

/** localStorage flag marking the tour as seen; survives reloads and projects. */
export const ONBOARDING_SEEN_KEY = "mocksy.onboardingSeen";

interface TourStep {
  /** CSS selector of the element to spotlight, or null for a centered card. */
  target: string | null;
  titleKey: string;
  bodyKey: string;
}

const STEPS: TourStep[] = [
  { target: null, titleKey: "onboarding.welcomeTitle", bodyKey: "onboarding.welcomeBody" },
  { target: "#preview-canvas", titleKey: "onboarding.canvasTitle", bodyKey: "onboarding.canvasBody" },
  { target: ".control-panel", titleKey: "onboarding.controlsTitle", bodyKey: "onboarding.controlsBody" },
  { target: ".right-panel", titleKey: "onboarding.rightTitle", bodyKey: "onboarding.rightBody" },
  { target: null, titleKey: "onboarding.doneTitle", bodyKey: "onboarding.doneBody" }
];

/** Reads the seen-flag (SSR-safe: returns true so the tour stays closed). */
export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(ONBOARDING_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
  } catch {
    // Storage full/blocked — the tour would re-show next visit, which is fine.
  }
}

/**
 * First-run guided tour: a dimmed backdrop with a cutout around the targeted
 * UI area and a step card next to it. Advances with Next/Back, exits via
 * Skip/Done/Escape. Shown automatically on first visit (checked by
 * EditorShell) and reopenable from the command palette.
 */
export function OnboardingTour() {
  const t = useTranslations();
  const open = useEditorStore((s) => s.onboardingOpen);
  const setOpen = useEditorStore((s) => s.setOnboardingOpen);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const step = STEPS[stepIndex]!;

  // Restart from the welcome card whenever the tour transitions closed→open.
  // Adjusting during render (not in an effect) avoids cascading renders.
  const [renderedOpen, setRenderedOpen] = useState(open);
  if (open !== renderedOpen) {
    setRenderedOpen(open);
    if (open) setStepIndex(0);
  }

  // Track the highlighted element's position while the tour is open. Steps
  // without a target simply ignore any stale rect at render time.
  useLayoutEffect(() => {
    if (!open || !step.target) return;
    const measure = () => {
      const el = document.querySelector(step.target!);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step.target]);

  const finish = useCallback(() => {
    markOnboardingSeen();
    setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open) return null;

  const isLast = stepIndex === STEPS.length - 1;
  const pad = 8;
  // Only targeted steps use the measured rect; null-target steps (welcome and
  // done) always render a centered card.
  const measured = step.target ? rect : null;

  const spotlightStyle: CSSProperties | null = measured
    ? {
        position: "fixed",
        left: measured.left - pad,
        top: measured.top - pad,
        width: measured.width + pad * 2,
        height: measured.height + pad * 2,
        borderRadius: 14,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
        outline: "2px solid var(--accent)",
        pointerEvents: "none",
        zIndex: 1090,
        transition: "all 0.25s ease"
      }
    : null;

  // Card placement: below the spotlight, flipped above when there is no room;
  // centered for steps without a target.
  let cardStyle: CSSProperties;
  if (!measured) {
    cardStyle = {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)"
    };
  } else {
    const below = measured.top + measured.height + pad + 16 + 180 < window.innerHeight;
    cardStyle = {
      position: "fixed",
      left: Math.max(16, Math.min(measured.left, window.innerWidth - 340 - 16)),
      top: below ? measured.top + measured.height + pad + 16 : undefined,
      bottom: below ? undefined : `calc(100% - ${measured.top - pad - 16}px)`,
      width: 320
    };
  }

  return (
    <>
      {/* Backdrop click-through is intentional: pointer-events none keeps the
          highlighted UI usable while everything else is dimmed. */}
      {spotlightStyle ? (
        <div aria-hidden="true" style={spotlightStyle} />
      ) : (
        <div
          aria-hidden="true"
          onClick={finish}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 1080 }}
        />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={t(step.titleKey)}
        className="panel"
        style={{ ...cardStyle, zIndex: 1100, padding: 16, display: "grid", gap: 10 }}
      >
        <h3 style={{ margin: 0, fontSize: 15 }}>{t(step.titleKey)}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{t(step.bodyKey)}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true" style={{ display: "flex", gap: 4, marginRight: "auto" }}>
            {STEPS.map((_, i) => (
              <span key={i} style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: i === stepIndex ? "var(--accent)" : "var(--panel-border)"
              }} />
            ))}
          </span>
          <button type="button" className="btn btn-sm" onClick={finish}>
            {t("onboarding.skip")}
          </button>
          {stepIndex > 0 ? (
            <button type="button" className="btn btn-sm" onClick={() => setStepIndex((i) => i - 1)}>
              {t("onboarding.back")}
            </button>
          ) : null}
          <button type="button" className="btn btn-sm btn-primary" onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}>
            {isLast ? t("onboarding.done") : t("onboarding.next")}
          </button>
        </div>
      </div>
    </>
  );
}
