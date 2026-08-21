"use client";

import { useTranslations } from "next-intl";
import type { ScreenChrome, ScreenChromeStyle, ScreenChromeTheme } from "@/lib/types/editor";
import { Segmented } from "@/components/editor/Segmented";

interface ScreenControlsProps {
  screen: ScreenChrome;
  setScreenChrome: (patch: Partial<ScreenChrome>) => void;
  screenGlare: boolean;
  setScreenGlare: (on: boolean) => void;
}

const STYLES: ScreenChromeStyle[] = ["lock", "home", "statusBar"];
const THEMES: ScreenChromeTheme[] = ["dark", "light"];

export function ScreenControls({ screen, setScreenChrome, screenGlare, setScreenGlare }: ScreenControlsProps) {
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

  const isLock = screen.style === "lock";
  const isHome = screen.style === "home";

  return (
    <div className="field-group">
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
    </div>
  );
}
