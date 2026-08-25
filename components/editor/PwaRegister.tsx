"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** How often a visible tab may ask the server for a newer service worker.
 *  Browsers only re-fetch the SW script on navigations, which a long-lived
 *  editor session never does — this poll is what makes deploys discoverable. */
const UPDATE_POLL_MS = 60_000;

/**
 * Registers the offline service worker and surfaces a "reload to update"
 * banner when a deploy hands control of this page to a newer worker.
 *
 * The SW template calls skipWaiting() + clients.claim(), so after a deploy
 * the new worker activates immediately and fires `controllerchange` — but the
 * page keeps running its old JS until reloaded. That handover is exactly what
 * the banner reacts to. The very first claim (page opened with no controller,
 * e.g. first visit or hard refresh) is suppressed: nothing was updated, the
 * page simply gained its initial controller.
 */
export function PwaRegister() {
  const t = useTranslations("pwa");
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker) return;
    // Read synchronously at mount: null means "no update", just first claim.
    let hadController = navigator.serviceWorker.controller !== null;
    let lastPoll = 0;

    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      setUpdateReady(true);
    };

    let registration: ServiceWorkerRegistration | null = null;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !registration) return;
      const now = Date.now();
      if (now - lastPoll < UPDATE_POLL_MS) return;
      lastPoll = now;
      // A fresh find on visibility makes an already-deployed update show the
      // banner without waiting for the next full page load.
      void registration.update().catch(() => {});
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(
      (reg) => {
        registration = reg;
        onVisible();
      },
      () => {}
    );

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!updateReady) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: "calc(100vw - 32px)",
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid var(--panel-border-strong)",
        background: "var(--panel-solid)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)"
      }}
    >
      <span style={{ color: "var(--text-secondary)", fontSize: 13, whiteSpace: "nowrap" }}>
        {t("updateReady")}
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          border: "none",
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 13,
          fontWeight: 600,
          color: "#fff",
          background: "linear-gradient(180deg, var(--accent), var(--accent-press))",
          cursor: "pointer",
          whiteSpace: "nowrap"
        }}
      >
        {t("reload")}
      </button>
    </div>
  );
}
