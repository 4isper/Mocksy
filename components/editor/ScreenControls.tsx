"use client";

import { useTranslations } from "next-intl";
import type { ScreenChrome, ScreenChromeStyle, ScreenChromeTheme } from "@/lib/types/editor";
import type { DeviceOS } from "@/lib/render/frames";
import { Segmented } from "@/components/editor/Segmented";

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
          checked={screen.showDock}
          disabled={!screen.enabled || !isHome}
          onChange={(e) => setScreenChrome({ showDock: e.target.checked })}
        />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screenShowDock")}</span>
      </label>
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
