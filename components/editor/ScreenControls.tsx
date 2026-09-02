"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import type { ScreenChrome, ScreenChromeStyle, ScreenChromeTheme } from "@/lib/types/editor";
import type { DeviceOS } from "@/lib/render/frames";
import { Segmented } from "@/components/editor/Segmented";

const COLOR_INPUT_STYLE: CSSProperties = {
  width: 32,
  height: 28,
  padding: 0,
  border: "1px solid var(--panel-border)",
  borderRadius: 6,
  cursor: "pointer",
  background: "none"
};

interface ScreenControlsProps {
  screen: ScreenChrome;
  setScreenChrome: (patch: Partial<ScreenChrome>) => void;
  screenGlare: boolean;
  setScreenGlare: (on: boolean) => void;
  /** Caption telling the user whether edits apply to all devices or just the
   *  selected one (per-device override mode). */
  scopeHint?: string;
  /** Resolved device OS (explicit choice, else derived from the frame). */
  resolvedOs: DeviceOS;
  /** Global floor-reflection toggle (moved here from the Position section). */
  floorReflection: boolean;
  setFloorReflection: (on: boolean) => void;
  /** Clears the selected device's override (instance mode only). */
  onResetScreen?: () => void;
  /** Copies the selected device's chrome to all devices (instance mode only). */
  onApplyToAll?: () => void;
}

const STYLES: ScreenChromeStyle[] = ["lock", "home", "statusBar"];
const THEMES: ScreenChromeTheme[] = ["dark", "light"];
const OSES: DeviceOS[] = ["ios", "android", "desktop"];

/** Format a lock-clock factor (0..1) as a readable percentage for aria. */
function clockFactorPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function ScreenControls({ screen, setScreenChrome, screenGlare, setScreenGlare, scopeHint, resolvedOs, floorReflection, setFloorReflection, onResetScreen, onApplyToAll }: ScreenControlsProps) {
  const t = useTranslations();

  const styleLabels: Record<ScreenChromeStyle, string> = {
    lock: t("editor.screenStyleLock"),
    home: t("editor.screenStyleHome"),
    statusBar: t("editor.screenStyleStatusBar")
  };
  const themeLabels: Record<ScreenChromeTheme, string> = {
    dark: t("editor.screenThemeDark"),
    light: t("editor.screenThemeLight")
  };
  const osLabels: Record<DeviceOS, string> = {
    ios: t("editor.screenOsIos"),
    android: t("editor.screenOsAndroid"),
    desktop: t("editor.screenOsDesktop")
  };

  const isLock = screen.style === "lock";
  const isHome = screen.style === "home";

  return (
    <div className="field-group">
      {scopeHint ? <p className="field-hint">{scopeHint}</p> : null}
      <label className="toggle">
        <input type="checkbox" checked={screen.enabled} onChange={(e) => setScreenChrome({ enabled: e.target.checked })} />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screen")}</span>
      </label>

      <Segmented
        label={t("editor.screenStyle")}
        value={screen.style}
        options={STYLES.map((s) => ({ value: s, label: styleLabels[s] }))}
        onChange={(style) => setScreenChrome({ style })}
        disabled={!screen.enabled}
      />
      <Segmented
        label={t("editor.screenTheme")}
        value={screen.theme}
        options={THEMES.map((th) => ({ value: th, label: themeLabels[th] }))}
        onChange={(theme) => setScreenChrome({ theme })}
        disabled={!screen.enabled}
      />
      <Segmented
        label={t("editor.screenOs")}
        value={resolvedOs}
        options={OSES.map((os) => ({ value: os, label: osLabels[os] }))}
        onChange={(os) => setScreenChrome({ os })}
        disabled={!screen.enabled}
      />

      <label className="toggle">
        <input
          type="checkbox"
          checked={screen.showStatusBar}
          disabled={!screen.enabled}
          onChange={(e) => setScreenChrome({ showStatusBar: e.target.checked })}
        />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screenShowStatusBar")}</span>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={screen.showClock}
          disabled={!screen.enabled || !isLock}
          onChange={(e) => setScreenChrome({ showClock: e.target.checked })}
        />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screenShowClock")}</span>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={screen.showDate}
          disabled={!screen.enabled || !isLock}
          onChange={(e) => setScreenChrome({ showDate: e.target.checked })}
        />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screenShowDate")}</span>
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={screen.showNotifications}
          disabled={!screen.enabled || !isLock}
          onChange={(e) => setScreenChrome({ showNotifications: e.target.checked })}
        />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screenShowNotifications")}</span>
      </label>

      {/* Lock-screen: clock size + position + color */}
      {isLock ? (
        <>
          <label className="field">
            <span>{t("editor.screenClockSize")}</span>
            <input
              type="range"
              min={0.04}
              max={0.25}
              step={0.005}
              disabled={!screen.enabled}
              value={screen.clockSizeFactor ?? 0.105}
              aria-label={t("editor.screenClockSize")}
              aria-valuetext={clockFactorPct(screen.clockSizeFactor ?? 0.105)}
              onChange={(e) => setScreenChrome({ clockSizeFactor: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>{t("editor.screenClockPosition")}</span>
            <input
              type="range"
              min={0.08}
              max={0.5}
              step={0.005}
              disabled={!screen.enabled}
              value={screen.clockYFactor ?? 0.175}
              aria-label={t("editor.screenClockPosition")}
              aria-valuetext={clockFactorPct(screen.clockYFactor ?? 0.175)}
              onChange={(e) => setScreenChrome({ clockYFactor: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>{t("editor.screenClockColor")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="color"
                style={COLOR_INPUT_STYLE}
                disabled={!screen.enabled}
                value={screen.clockColor ?? (screen.theme === "dark" ? "#ffffff" : "#0a0a0a")}
                onChange={(e) => setScreenChrome({ clockColor: e.target.value })}
              />
              {screen.clockColor ? (
                <button
                  type="button"
                  className="btn-link"
                  disabled={!screen.enabled}
                  onClick={() => setScreenChrome({ clockColor: null })}
                >
                  {t("editor.screenResetDefault")}
                </button>
              ) : null}
            </div>
          </label>
        </>
      ) : null}

      <label className="toggle">
        <input
          type="checkbox"
          checked={screen.showDock}
          disabled={!screen.enabled || !isHome}
          onChange={(e) => setScreenChrome({ showDock: e.target.checked })}
        />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screenShowDock")}</span>
      </label>

      {/* Home-screen: dock background + dock icon colors */}
      {isHome ? (
        <>
          <label className="field">
            <span>{t("editor.screenDockBackground")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="color"
                style={COLOR_INPUT_STYLE}
                disabled={!screen.enabled}
                value={screen.dockBackground ?? (screen.theme === "dark" ? "#5a5a5a" : "#505050")}
                onChange={(e) => setScreenChrome({ dockBackground: e.target.value })}
              />
              {screen.dockBackground ? (
                <button
                  type="button"
                  className="btn-link"
                  disabled={!screen.enabled}
                  onClick={() => setScreenChrome({ dockBackground: null })}
                >
                  {t("editor.screenResetDefault")}
                </button>
              ) : null}
            </div>
          </label>
          <label className="field">
            <span>{t("editor.screenDockColors")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              {(screen.dockColors ?? ["#30d158", "#0a84ff", "#ff9f0a", "#ff375f"]).slice(0, 4).map((color, i) => (
                <input
                  key={i}
                  type="color"
                  style={COLOR_INPUT_STYLE}
                  disabled={!screen.enabled}
                  value={color}
                  onChange={(e) => {
                    const next = [...(screen.dockColors ?? ["#30d158", "#0a84ff", "#ff9f0a", "#ff375f"])];
                    next[i] = e.target.value;
                    setScreenChrome({ dockColors: next });
                  }}
                />
              ))}
              {screen.dockColors ? (
                <button
                  type="button"
                  className="btn-link"
                  disabled={!screen.enabled}
                  onClick={() => setScreenChrome({ dockColors: null })}
                >
                  {t("editor.screenResetDefault")}
                </button>
              ) : null}
            </div>
          </label>
        </>
      ) : null}
      <label className="toggle">
        <input
          type="checkbox"
          checked={screen.showHomeIndicator}
          disabled={!screen.enabled}
          onChange={(e) => setScreenChrome({ showHomeIndicator: e.target.checked })}
        />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screenShowHomeIndicator")}</span>
      </label>

      <label className="field">
        <span>{t("editor.screenTime")}</span>
        <input value={screen.time} disabled={!screen.enabled} onChange={(e) => setScreenChrome({ time: e.target.value })} />
      </label>
      <label className="field">
        <span>{t("editor.screenDateText")}</span>
        <input value={screen.date} disabled={!screen.enabled} onChange={(e) => setScreenChrome({ date: e.target.value })} />
      </label>

      <label className="toggle">
        <input type="checkbox" checked={screenGlare} onChange={(e) => setScreenGlare(e.target.checked)} />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screenGlare")}</span>
      </label>

      <label className="toggle">
        <input type="checkbox" checked={floorReflection} onChange={(e) => setFloorReflection(e.target.checked)} />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.floorReflection")}</span>
      </label>

      {onResetScreen || onApplyToAll ? (
        <div className="screen-actions">
          {onResetScreen ? (
            <button type="button" className="btn-link" onClick={onResetScreen}>
              {t("editor.screenResetDefault")}
            </button>
          ) : null}
          {onApplyToAll ? (
            <button type="button" className="btn-link" onClick={onApplyToAll}>
              {t("editor.screenApplyToAll")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
