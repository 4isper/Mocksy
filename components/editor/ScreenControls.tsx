"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ScreenChrome, ScreenChromeStyle, ScreenChromeTheme } from "@/lib/types/editor";
import type { DeviceOS } from "@/lib/render/frames";
import { ANDROID_GRID_APPS, GRID_ICON_PRESETS, NOTIFICATION_APPS } from "@/lib/render/screenChrome";
import { Section } from "@/components/editor/Section";
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

/** 12×12 glyph icons for the collapsible groups (matches ControlPanel style). */
const SECTION_ICONS = {
  notifications: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="2" width="9" height="2.4" rx="1.2" stroke="currentColor" strokeWidth="1.1"/><rect x="1.5" y="7.6" width="6.5" height="2.4" rx="1.2" stroke="currentColor" strokeWidth="1.1"/></svg>
  ),
  clock: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 3.6V6l1.8 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  dock: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="8" width="9" height="2.5" rx="1.25" stroke="currentColor" strokeWidth="1.1"/><circle cx="4" cy="9.25" r="0.7" fill="currentColor"/><circle cx="6" cy="9.25" r="0.7" fill="currentColor"/><circle cx="8" cy="9.25" r="0.7" fill="currentColor"/></svg>
  ),
  grid: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="3.4" height="3.4" rx="0.9" stroke="currentColor" strokeWidth="1.1"/><rect x="7.1" y="1.5" width="3.4" height="3.4" rx="0.9" stroke="currentColor" strokeWidth="1.1"/><rect x="1.5" y="7.1" width="3.4" height="3.4" rx="0.9" stroke="currentColor" strokeWidth="1.1"/><rect x="7.1" y="7.1" width="3.4" height="3.4" rx="0.9" stroke="currentColor" strokeWidth="1.1"/></svg>
  ),
  widgets: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="9" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.1"/><rect x="1.5" y="7" width="4" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/><rect x="6.8" y="7" width="3.7" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1.1"/></svg>
  ),
  folders: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3.2c0-.66.54-1.2 1.2-1.2h2.1l1.2 1.5h3.3c.66 0 1.2.54 1.2 1.2v4.1c0 .66-.54 1.2-1.2 1.2H2.7c-.66 0-1.2-.54-1.2-1.2V3.2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>
  )
} as const;

/** Format a lock-clock factor (0..1) as a readable percentage for aria. */
function clockFactorPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** True when at least one screen-chrome value was customized away from its
 *  default (i.e. the single "Reset all" affordance is worth showing). */
function screenChromeCustomized(screen: ScreenChrome): boolean {
  return (
    notificationsCustomized(screen.notifications) ||
    screen.clockColor !== null ||
    factorCustomized(screen.clockSizeFactor, 0.105) ||
    factorCustomized(screen.clockYFactor, 0.175) ||
    screen.dockBackground !== null ||
    screen.dockColors !== null ||
    screen.dockIcons !== null ||
    screen.androidGridIcons !== null ||
    screen.gridCols !== null ||
    screen.gridRows !== null ||
    screen.folders !== null ||
    screen.widgets !== null
  );
}

/** Clock factors default to concrete numbers (0.105 / 0.175); a value counts
 *  as customized only when it deviates from that default. */
function factorCustomized(value: number | null | undefined, fallback: number): boolean {
  return value !== null && value !== undefined && Math.abs(value - fallback) > 1e-9;
}

/** Notifications count as customized only when they differ in content from the
 *  built-in default pair (normalization recreates arrays, so reference
 *  equality can't be used). */
function notificationsCustomized(list: ScreenChrome["notifications"]): boolean {
  if (!list) return false;
  if (list.length !== NOTIFICATION_APPS.length) return true;
  return list.some((n, i) => {
    const d = NOTIFICATION_APPS[i]!;
    return n.app !== d.app || n.subtitle !== d.subtitle || n.color !== d.color;
  });
}

/** Clears every optional screen-chrome customization back to its default. */
const RESET_ALL_CHROME: Partial<ScreenChrome> = {
  notifications: null,
  clockColor: null,
  clockSizeFactor: null,
  clockYFactor: null,
  dockBackground: null,
  dockColors: null,
  dockIcons: null,
  androidGridIcons: null,
  gridCols: null,
  gridRows: null,
  folders: null,
  widgets: null
};

/** Which grid-icon preset (if any) matches the current custom icons. A null
 *  custom list renders the built-in grid, which is the "google" preset. */
function activeGridPresetId(icons: ScreenChrome["androidGridIcons"]): string | null {
  if (!icons?.length) return "google";
  for (const preset of GRID_ICON_PRESETS) {
    const p = preset.icons.slice(0, 20);
    if (
      icons.length === p.length &&
      icons.every((ic, i) => {
        const ref = p[i]!;
        return ic.label === ref.label && ic.color === ref.color && ic.emoji === ref.emoji;
      })
    ) {
      return preset.id;
    }
  }
  return null;
}

export function ScreenControls({ screen, setScreenChrome, screenGlare, setScreenGlare, scopeHint, resolvedOs, floorReflection, setFloorReflection, onResetScreen, onApplyToAll }: ScreenControlsProps) {
  const t = useTranslations();
  // The 20-row grid editor is overwhelming by default — show the first 4 rows
  // and reveal the rest on demand.
  const [showAllGridIcons, setShowAllGridIcons] = useState(false);

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

  const updateNotification = (index: number, next: { app: string; subtitle: string; color: string }) => {
    const current = screen.notifications ?? NOTIFICATION_APPS;
    const list = current.slice(0, 4);
    list[index] = next;
    setScreenChrome({ notifications: list });
  };

  const updateDockIcon = (index: number, next: { label: string; color: string; emoji?: string }) => {
    const current = screen.dockIcons ?? [
      { label: "Message", color: "#30d158", emoji: "💬" },
      { label: "Music", color: "#0a84ff", emoji: "🎵" },
      { label: "Camera", color: "#ff9f0a", emoji: "📷" },
      { label: "Photos", color: "#ff375f", emoji: "🖼️" }
    ];
    const list = current.slice(0, 4);
    list[index] = next;
    setScreenChrome({ dockIcons: list });
  };

  const updateGridIcon = (index: number, next: { label: string; color: string; emoji?: string }) => {
    const current = screen.androidGridIcons ?? ANDROID_GRID_APPS;
    const list = current.slice(0, 20);
    list[index] = next;
    setScreenChrome({ androidGridIcons: list });
  };

  const applyGridPreset = (presetId: string) => {
    const preset = GRID_ICON_PRESETS.find((p) => p.id === presetId);
    if (preset) setScreenChrome({ androidGridIcons: preset.icons.slice(0, 20) });
  };

  const DEFAULT_FOLDERS: { label: string; color: string }[] = [
    { label: "Social", color: "#5e35b1" },
    { label: "Games", color: "#00acc1" }
  ];

  const updateFolder = (index: number, next: { label: string; color: string }) => {
    const current = screen.folders ?? [];
    const list = current.slice(0, 8);
    list[index] = next;
    setScreenChrome({ folders: list });
  };

  const addFolder = () => {
    const current = screen.folders ?? [];
    if (current.length >= 8) return;
    setScreenChrome({ folders: [...current, { label: `Folder ${current.length + 1}`, color: "#3a4a5a" }] });
  };

  const toggleWidget = (type: "clock" | "weather") => {
    const current = screen.widgets ?? [];
    const has = current.some((w) => w.type === type);
    const next = has
      ? current.filter((w) => w.type !== type)
      : [...current, { type }];
    setScreenChrome({ widgets: next.length ? next : null });
  };

  const widgetEnabled = (type: "clock" | "weather") =>
    (screen.widgets ?? []).some((w) => w.type === type);

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
      <label className="toggle">
        <input
          type="checkbox"
          checked={screen.showLockShortcuts}
          disabled={!screen.enabled || !isLock || resolvedOs !== "ios"}
          onChange={(e) => setScreenChrome({ showLockShortcuts: e.target.checked })}
        />
        <span className="track" aria-hidden="true" />
        <span>{t("editor.screenShowLockShortcuts")}</span>
      </label>

      {/* Lock-screen: notification cards editor */}
      {isLock && screen.showNotifications ? (
        <Section id="screen-notifications" title={t("editor.screenSectionNotifications")} icon={SECTION_ICONS.notifications} defaultOpen={false}>
          <div className="screen-notifications">
            <p className="field-hint">{t("editor.screenNotificationsHint")}</p>
            {(screen.notifications ?? NOTIFICATION_APPS).slice(0, 4).map((notif, i) => (
              <div key={i} className="screen-notification-row">
                <input
                  type="color"
                  className="color-input"
                  disabled={!screen.enabled}
                  value={notif.color}
                  aria-label={`${t("editor.screenNotificationsColor")} ${i + 1}`}
                  onChange={(e) => updateNotification(i, { ...notif, color: e.target.value })}
                />
                <input
                  type="text"
                  disabled={!screen.enabled}
                  value={notif.app}
                  aria-label={`${t("editor.screenNotificationsApp")} ${i + 1}`}
                  onChange={(e) => updateNotification(i, { ...notif, app: e.target.value })}
                />
                <input
                  type="text"
                  disabled={!screen.enabled}
                  value={notif.subtitle}
                  aria-label={`${t("editor.screenNotificationsSubtitle")} ${i + 1}`}
                  onChange={(e) => updateNotification(i, { ...notif, subtitle: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Lock-screen: clock size + position + color */}
      {isLock ? (
        <Section id="screen-clock" title={t("editor.screenSectionClock")} icon={SECTION_ICONS.clock} defaultOpen={false}>
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
            <div className="color-input-row">
              <input
                type="color"
                className="color-input"
                disabled={!screen.enabled}
                value={screen.clockColor ?? (screen.theme === "dark" ? "#ffffff" : "#0a0a0a")}
                onChange={(e) => setScreenChrome({ clockColor: e.target.value })}
              />
            </div>
          </label>
        </Section>
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
          <Section id="screen-dock" title={t("editor.screenSectionDock")} icon={SECTION_ICONS.dock} defaultOpen={false}>
            <label className="field">
              <span>{t("editor.screenDockBackground")}</span>
              <div className="color-input-row">
                <input
                  type="color"
                  className="color-input"
                  disabled={!screen.enabled}
                  value={screen.dockBackground ?? (screen.theme === "dark" ? "#5a5a5a" : "#505050")}
                  onChange={(e) => setScreenChrome({ dockBackground: e.target.value })}
                />
            </div>
          </label>
            <label className="field">
              <span>{t("editor.screenDockColors")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                {(screen.dockColors ?? ["#30d158", "#0a84ff", "#ff9f0a", "#ff375f"]).slice(0, 4).map((color, i) => (
                  <input
                    key={i}
                    type="color"
                    className="color-input"
                    disabled={!screen.enabled}
                    value={color}
                    onChange={(e) => {
                      const next = [...(screen.dockColors ?? ["#30d158", "#0a84ff", "#ff9f0a", "#ff375f"])];
                      next[i] = e.target.value;
                      setScreenChrome({ dockColors: next });
                    }}
                  />
              ))}
            </div>
          </label>

            {/* Custom dock icons: label + color (+ emoji). */}
            <div className="dock-icons-editor">
              <p className="field-hint">{t("editor.screenDockIconsHint")}</p>
              {(screen.dockIcons ?? [
                { label: "Message", color: "#30d158", emoji: "💬" },
                { label: "Music", color: "#0a84ff", emoji: "🎵" },
                { label: "Camera", color: "#ff9f0a", emoji: "📷" },
                { label: "Photos", color: "#ff375f", emoji: "🖼️" }
              ]).slice(0, 4).map((icon, i) => (
                <div key={i} className="screen-notification-row">
                  <input
                    type="color"
                    className="color-input"
                    disabled={!screen.enabled}
                    value={icon.color}
                    aria-label={`${t("editor.screenDockIconColor")} ${i + 1}`}
                    onChange={(e) => updateDockIcon(i, { ...icon, color: e.target.value })}
                  />
                  <input
                    type="text"
                    disabled={!screen.enabled}
                    value={icon.label}
                    aria-label={`${t("editor.screenDockIconLabel")} ${i + 1}`}
                    onChange={(e) => updateDockIcon(i, { ...icon, label: e.target.value })}
                  />
                  <input
                    type="text"
                    disabled={!screen.enabled}
                    value={icon.emoji ?? ""}
                    aria-label={`${t("editor.screenDockIconEmoji")} ${i + 1}`}
                    onChange={(e) => updateDockIcon(i, { ...icon, emoji: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* Custom Android home grid icons: label + color (+ emoji). */}
          <Section id="screen-grid" title={t("editor.screenSectionGrid")} icon={SECTION_ICONS.grid} defaultOpen={false}>
            <div className="dock-icons-editor">
              <p className="field-hint">{t("editor.screenGridIconsHint")}</p>
              <div className="grid-dims-row">
                <label className="field">
                  <span>{t("editor.screenGridCols")}</span>
                  <input
                    type="range"
                    min={3}
                    max={5}
                    step={1}
                    disabled={!screen.enabled}
                    value={screen.gridCols ?? 4}
                    aria-label={t("editor.screenGridCols")}
                    aria-valuetext={String(screen.gridCols ?? 4)}
                    onChange={(e) => setScreenChrome({ gridCols: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>{t("editor.screenGridRows")}</span>
                  <input
                    type="range"
                    min={4}
                    max={6}
                    step={1}
                    disabled={!screen.enabled}
                    value={screen.gridRows ?? 5}
                    aria-label={t("editor.screenGridRows")}
                    aria-valuetext={String(screen.gridRows ?? 5)}
                    onChange={(e) => setScreenChrome({ gridRows: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="grid-preset-row">
                {GRID_ICON_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="preset-chip"
                    aria-pressed={preset.id === activeGridPresetId(screen.androidGridIcons)}
                    disabled={!screen.enabled}
                    onClick={() => applyGridPreset(preset.id)}
                  >
                    {t(`editor.screenGridPreset.${preset.id}`)}
                  </button>
                ))}
              </div>
              {(screen.androidGridIcons ?? ANDROID_GRID_APPS).slice(0, showAllGridIcons ? 20 : 4).map((icon, i) => (
                <div key={i} className="screen-notification-row">
                  <input
                    type="color"
                    className="color-input"
                    disabled={!screen.enabled}
                    value={icon.color}
                    aria-label={`${t("editor.screenGridIcon")} ${i + 1} ${t("editor.screenGridColor")}`}
                    onChange={(e) => updateGridIcon(i, { ...icon, color: e.target.value })}
                  />
                  <input
                    type="text"
                    disabled={!screen.enabled}
                    value={icon.label}
                    aria-label={`${t("editor.screenGridIcon")} ${i + 1} ${t("editor.screenGridLabel")}`}
                    onChange={(e) => updateGridIcon(i, { ...icon, label: e.target.value })}
                  />
                  <input
                    type="text"
                    disabled={!screen.enabled}
                    value={icon.emoji ?? ""}
                    aria-label={`${t("editor.screenGridIcon")} ${i + 1} ${t("editor.screenGridEmoji")}`}
                    onChange={(e) => updateGridIcon(i, { ...icon, emoji: e.target.value })}
                  />
                </div>
              ))}
              {showAllGridIcons ? null : (
                <button
                  type="button"
                  className="btn-link"
                  disabled={!screen.enabled}
                  onClick={() => setShowAllGridIcons(true)}
                >
                  {t("editor.screenShowAllIcons", { count: 20 })}
                </button>
              )}
            </div>
          </Section>

          {/* Android home widgets: clock + weather, rendered above the grid. */}
          <Section id="screen-widgets" title={t("editor.screenSectionWidgets")} icon={SECTION_ICONS.widgets} defaultOpen={false}>
            <div className="dock-icons-editor">
              <p className="field-hint">{t("editor.screenWidgetsHint")}</p>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={widgetEnabled("clock")}
                  disabled={!screen.enabled}
                  onChange={() => toggleWidget("clock")}
                />
                <span className="track" aria-hidden="true" />
                <span>{t("editor.screenWidgetClock")}</span>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={widgetEnabled("weather")}
                  disabled={!screen.enabled}
                  onChange={() => toggleWidget("weather")}
                />
                <span className="track" aria-hidden="true" />
                <span>{t("editor.screenWidgetWeather")}</span>
              </label>
            </div>
          </Section>

          {/* Android folder cells: label + color. */}
          <Section id="screen-folders" title={t("editor.screenSectionFolders")} icon={SECTION_ICONS.folders} defaultOpen={false}>
            <div className="dock-icons-editor">
              <p className="field-hint">{t("editor.screenFoldersHint")}</p>
              {(screen.folders ?? DEFAULT_FOLDERS).slice(0, 8).map((folder, i) => (
                <div key={i} className="screen-notification-row">
                  <input
                    type="color"
                    className="color-input"
                    disabled={!screen.enabled}
                    value={folder.color}
                    aria-label={`${t("editor.screenFolder")} ${i + 1} ${t("editor.screenGridColor")}`}
                    onChange={(e) => updateFolder(i, { ...folder, color: e.target.value })}
                  />
                  <input
                    type="text"
                    disabled={!screen.enabled}
                    value={folder.label}
                    aria-label={`${t("editor.screenFolder")} ${i + 1} ${t("editor.screenGridLabel")}`}
                    onChange={(e) => updateFolder(i, { ...folder, label: e.target.value })}
                  />
                </div>
              ))}
              <div className="dock-actions">
                <button
                  type="button"
                  className="btn-sm"
                  disabled={!screen.enabled}
                  onClick={addFolder}
                >
                  {t("editor.screenAddFolder")}
                </button>
              </div>
            </div>
          </Section>
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

      {screenChromeCustomized(screen) ? (
        <button
          type="button"
          className="btn-link"
          disabled={!screen.enabled}
          onClick={() => setScreenChrome(RESET_ALL_CHROME)}
        >
          {t("editor.screenResetAll")}
        </button>
      ) : null}

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
