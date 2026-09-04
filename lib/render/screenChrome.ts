import type { MockupFrame, ScreenChrome } from "@/lib/types/editor";
import { escapeMarkup } from "@/lib/export/markupUtils";
import { frameOs } from "@/lib/render/frames";
import { getChromeSpec, type ChromeSpec } from "@/lib/render/deviceChrome";

/**
 * Screen decoration (status bar, lock-screen clock/date, notification cards,
 * home dock, home indicator) is rendered on top of the media. One module feeds
 * every renderer: `screenChromeElements` emits SVG markup (CSS preview, SVG/HTML
 * export) and `drawScreenChrome` paints the same geometry on a 2D canvas
 * (PNG/video export), so the preview matches every export exactly.
 *
 * Geometry is expressed in units of the target rectangle (w × h), typically
 * 390 × 844 for a phone screen; callers scale it to whatever the frame is.
 * Per-frame layout (status bar metrics, dock sizing) comes from
 * `getChromeSpec(frame)` so every device gets chrome that matches its real
 * screen.
 */

/** Exponent of the superellipse used for iOS-style squircle icons
 *  (|x/a|ⁿ + |y/b|ⁿ = 1 with n = 5 approximates Apple's continuous corners). */
const SUPERELLIPSE_EXPONENT = 5;
const SUPERELLIPSE_SAMPLES = 32;

/** Lock-screen notification cards (app icon + title + subtitle), rendered when
 *  chrome.showNotifications is enabled. Colors mirror the real app icons. */
/** Lock-screen notification cards (app icon + title + subtitle), rendered when
 *  chrome.showNotifications is enabled. Colors mirror the real app icons. Also
 *  the default value surfaced to the state layer (editorScene) so both the
 *  editor defaults and the renderers share a single source of truth. */
export const NOTIFICATION_APPS: Array<{ app: string; subtitle: string; color: string }> = [
  { app: "Messages", subtitle: "John: The new mockup looks great", color: "#30d158" },
  { app: "Calendar", subtitle: "9:30 AM Team design review", color: "#0a84ff" }
];

function n(v: number): string {
  return String(Math.round(v * 10) / 10);
}

function esc(s: string): string {
  return escapeMarkup(s);
}

/** Palette derived from the chrome theme. */
function chromePalette(chrome: ScreenChrome) {
  const dark = chrome.theme === "dark";
  return {
    dark,
    fg: dark ? "#ffffff" : "#0a0a0a",
    fgDim: dark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.6)",
    topFrom: dark ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.42)",
    dockBg: dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)",
    indicator: dark ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.88)",
    circleBg: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.07)",
    circleRing: dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.2)",
    notifBg: dark ? "rgba(60,60,67,0.62)" : "rgba(255,255,255,0.72)"
  };
}

export const SCREEN_CHROME_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
export const SCREEN_CHROME_DOCK_COLORS = ["#30d158", "#0a84ff", "#ff9f0a", "#ff375f"];

/** Default Android home-screen app grid: 20 labeled app icons + 4 dock icons.
 *  Colors approximate Material app icon tiles. Shared as the editor default. */
export const ANDROID_GRID_APPS: Array<{ label: string; color: string; emoji?: string }> = [
  { label: "Phone", color: "#1a73e8", emoji: "📞" },
  { label: "Messages", color: "#0f9d58", emoji: "💬" },
  { label: "Photos", color: "#f4b400", emoji: "🖼️" },
  { label: "Camera", color: "#ea4335", emoji: "📷" },
  { label: "Play Store", color: "#fbbc04", emoji: "▶️" },
  { label: "YouTube", color: "#e91e63", emoji: "▶️" },
  { label: "Gmail", color: "#00bcd4", emoji: "✉️" },
  { label: "Maps", color: "#8e24aa", emoji: "🗺️" },
  { label: "Calendar", color: "#3949ab", emoji: "📅" },
  { label: "Drive", color: "#f4511e", emoji: "🗂️" },
  { label: "Notes", color: "#00897b", emoji: "🗒️" },
  { label: "Clock", color: "#c0ca33", emoji: "⏰" },
  { label: "Weather", color: "#7cb342", emoji: "⛅" },
  { label: "Calculator", color: "#fb8c00", emoji: "🧮" },
  { label: "Settings", color: "#d81b60", emoji: "⚙️" },
  { label: "Browser", color: "#039be5", emoji: "🌐" },
  { label: "Music", color: "#6d4c41", emoji: "🎵" },
  { label: "Files", color: "#5e35b1", emoji: "📁" },
  { label: "Contacts", color: "#43a047", emoji: "👤" },
  { label: "Web Store", color: "#ef6c00", emoji: "🛒" }
];
const ANDROID_DOCK_COLORS = ["#1a73e8", "#0f9d58", "#f4b400", "#ea4335"];

/** Named one-click Android home-grid icon sets. Each is a full 20-icon grid so
 *  the editor can swap to a curated look in a single click; "google" matches the
 *  default ANDROID_GRID_APPS used when the chrome has no custom icons. */
export const GRID_ICON_PRESETS: Array<{
  id: string;
  label: string;
  icons: Array<{ label: string; color: string; emoji?: string }>;
}> = [
  { id: "google", label: "Google", icons: ANDROID_GRID_APPS },
  {
    id: "classic",
    label: "Classic",
    icons: [
      { label: "Phone", color: "#e53935", emoji: "📞" },
      { label: "Mail", color: "#1e88e5", emoji: "✉️" },
      { label: "Music", color: "#fb8c00", emoji: "🎵" },
      { label: "Gallery", color: "#43a047", emoji: "🖼️" },
      { label: "Camera", color: "#8e24aa", emoji: "📷" },
      { label: "Browser", color: "#00838f", emoji: "🌐" },
      { label: "Maps", color: "#00acc1", emoji: "🗺️" },
      { label: "Clock", color: "#283593", emoji: "⏰" },
      { label: "Calendar", color: "#c62828", emoji: "📅" },
      { label: "Notes", color: "#f9a825", emoji: "🗒️" },
      { label: "Weather", color: "#0277bd", emoji: "⛅" },
      { label: "Calculator", color: "#6d4c41", emoji: "🧮" },
      { label: "Settings", color: "#37474f", emoji: "⚙️" },
      { label: "Contacts", color: "#00a152", emoji: "👤" },
      { label: "Tasks", color: "#d81b60", emoji: "✅" },
      { label: "Files", color: "#00695c", emoji: "📁" },
      { label: "Videos", color: "#e53935", emoji: "🎬" },
      { label: "News", color: "#3949ab", emoji: "📰" },
      { label: "Store", color: "#f4511e", emoji: "🛒" },
      { label: "Wallet", color: "#0091ea", emoji: "💳" }
    ]
  },
  {
    id: "minimal",
    label: "Minimal",
    icons: [
      { label: "Phone", color: "#2f3e46", emoji: "📞" },
      { label: "Mail", color: "#3a4a5a", emoji: "✉️" },
      { label: "Music", color: "#4a5a66", emoji: "🎵" },
      { label: "Photos", color: "#5a6a74", emoji: "🖼️" },
      { label: "Camera", color: "#6a7a84", emoji: "📷" },
      { label: "Browser", color: "#2f3e46", emoji: "🌐" },
      { label: "Maps", color: "#3a4a5a", emoji: "🗺️" },
      { label: "Clock", color: "#4a5a66", emoji: "⏰" },
      { label: "Calendar", color: "#5a6a74", emoji: "📅" },
      { label: "Notes", color: "#6a7a84", emoji: "🗒️" },
      { label: "Weather", color: "#2f3e46", emoji: "⛅" },
      { label: "Settings", color: "#3a4a5a", emoji: "⚙️" },
      { label: "Contacts", color: "#4a5a66", emoji: "👤" },
      { label: "Files", color: "#5a6a74", emoji: "📁" },
      { label: "News", color: "#6a7a84", emoji: "📰" },
      { label: "Store", color: "#2f3e46", emoji: "🛒" },
      { label: "Videos", color: "#3a4a5a", emoji: "🎬" },
      { label: "Tasks", color: "#4a5a66", emoji: "✅" },
      { label: "Wallet", color: "#5a6a74", emoji: "💳" },
      { label: "Books", color: "#6a7a84", emoji: "📚" }
    ]
  },
  {
    id: "none",
    label: "None",
    icons: [
      { label: "Phone", color: "#e0e0e0" },
      { label: "Mail", color: "#e0e0e0" },
      { label: "Music", color: "#e0e0e0" },
      { label: "Photos", color: "#e0e0e0" },
      { label: "Camera", color: "#e0e0e0" },
      { label: "Browser", color: "#e0e0e0" },
      { label: "Maps", color: "#e0e0e0" },
      { label: "Clock", color: "#e0e0e0" },
      { label: "Calendar", color: "#e0e0e0" },
      { label: "Notes", color: "#e0e0e0" },
      { label: "Weather", color: "#e0e0e0" },
      { label: "Settings", color: "#e0e0e0" },
      { label: "Contacts", color: "#e0e0e0" },
      { label: "Files", color: "#e0e0e0" },
      { label: "News", color: "#e0e0e0" },
      { label: "Store", color: "#e0e0e0" },
      { label: "Videos", color: "#e0e0e0" },
      { label: "Tasks", color: "#e0e0e0" },
      { label: "Wallet", color: "#e0e0e0" },
      { label: "Books", color: "#e0e0e0" }
    ]
  }
];

/** True when the chrome draws the Android home screen (os "android" + "home"):
 *  a Google search bar, a 4×5 app grid and a dock over the media wallpaper. */
function isAndroidHome(chrome: ScreenChrome): boolean {
  return chrome.os === "android" && chrome.style === "home";
}

/** Android home-grid app icons to render: the chrome's custom list when present
 *  (first 20), otherwise the default labeled grid. */
function androidGridApps(chrome: ScreenChrome): Array<{ label: string; color: string; emoji?: string }> {
  return chrome.androidGridIcons?.length ? chrome.androidGridIcons.slice(0, 20) : ANDROID_GRID_APPS;
}

export interface AndroidGridGeom {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  gridTop: number;
  /** Vertical screen-space reserved per widget row above the app grid. */
  widgetRowHeight: number;
  iconSize: number;
  labelSize: number;
  /** Row/column center for a 0-based icon index. */
  center(i: number): { cx: number; cy: number };
  /** Y just under an icon for its text label. */
  labelY(cy: number): number;
  /** False when the screen is too short to host the grid. */
  fits: boolean;
}

export function androidGridGeom(
  w: number,
  h: number,
  barY: number,
  barH: number,
  dockHeightFactor: number,
  dockBottomOffset: number,
  cols = 4,
  rows = 5,
  widgetRows = 0
): AndroidGridGeom {
  const dockReserve = h * dockHeightFactor + h * dockBottomOffset + h * 0.03;
  const cellW = w / cols;
  const widgetRowHeight = h * 0.09;
  const gridTop = barY + barH + h * 0.03 + widgetRows * widgetRowHeight;
  const gridBottom = h - dockReserve;
  const cellH = (gridBottom - gridTop) / rows;
  const iconSize = Math.max(0, Math.min(cellW * 0.52, cellH * 0.56));
  const labelSize = h * 0.017;
  return {
    cols,
    rows,
    cellW,
    cellH,
    gridTop,
    widgetRowHeight,
    iconSize,
    labelSize,
    center: (i: number) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return { cx: cellW * col + cellW / 2, cy: gridTop + cellH * row + cellH / 2 };
    },
    labelY: (cy: number) => cy + iconSize / 2 + labelSize * 0.55,
    fits: iconSize > 0 && cellH > 0
  };
}

/** Notification cards to render: the chrome's custom list when present,
 *  otherwise the default Messages/Calendar pair. */
function notificationApps(chrome: ScreenChrome): Array<{ name: string; subtitle: string; color: string }> {
  if (chrome.notifications?.length) {
    return chrome.notifications.slice(0, 4).map((n) => ({ name: n.app, subtitle: n.subtitle, color: n.color }));
  }
  return NOTIFICATION_APPS.map((n) => ({ name: n.app, subtitle: n.subtitle, color: n.color }));
}

/** Android home-screen folder tile: a rounded square with offset mini-app dots
 *  (a recognizable folder stub) plus the folder's label underneath. */
function androidFolderSvg(cx: number, cy: number, iconSize: number, color: string, label: string, labelSize: number, fg: string): string {
  const s = iconSize * 0.7;
  const r = s * 0.24;
  const x = cx - s / 2;
  const y = cy - s / 2;
  const dot = s * 0.16;
  const dx = s * 0.42;
  const parts: string[] = [];
  parts.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(s)}" height="${n(s)}" rx="${n(r)}" fill="${escapeMarkup(color)}" opacity="0.92"/>`);
  // Three mini-app dots (two top, one bottom-left) suggesting a nested stack.
  parts.push(`<circle cx="${n(cx - dx)}" cy="${n(cy - dx)}" r="${n(dot)}" fill="${fg}" opacity="0.28"/>`);
  parts.push(`<circle cx="${n(cx + dx)}" cy="${n(cy - dx)}" r="${n(dot)}" fill="${fg}" opacity="0.28"/>`);
  parts.push(`<circle cx="${n(cx - dx)}" cy="${n(cy + dx)}" r="${n(dot)}" fill="${fg}" opacity="0.28"/>`);
  const labelY = cy + iconSize / 2 + labelSize * 0.55;
  parts.push(
    `<text x="${n(cx)}" y="${n(labelY)}" font-size="${n(labelSize)}" font-weight="500" fill="${fg}" font-family="${SCREEN_CHROME_FONT}" text-anchor="middle" dominant-baseline="hanging">${esc(label || "Folder")}</text>`
  );
  return parts.join("");
}

/** Canvas twin of androidFolderSvg: rounded folder tile with mini-app dots. */
function drawAndroidFolder(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  iconSize: number,
  color: string,
  label: string,
  labelSize: number,
  fg: string,
  font: string
): void {
  const s = iconSize * 0.7;
  const r = s * 0.24;
  const dot = s * 0.16;
  const dx = s * 0.42;
  roundRect(ctx, cx - s / 2, cy - s / 2, s, s, r);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.arc(cx - dx, cy - dx, dot, 0, Math.PI * 2);
  ctx.arc(cx + dx, cy - dx, dot, 0, Math.PI * 2);
  ctx.arc(cx - dx, cy + dx, dot, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "hanging";
  ctx.font = `500 ${labelSize}px ${font}`;
  ctx.fillText(label || "Folder", cx, cy + iconSize / 2 + labelSize * 0.55);
}

/** Android home widget cards rendered in the reserved band above the app grid.
 *  Each widget occupies one full-width row. Clock: large time + date. Weather:
 *  city, large temperature and a condition icon. */
function androidWidgetsSvg(widgets: Array<{ type: "clock" | "weather" }>, w: number, top: number, rowH: number, h: number, fg: string): string {
  const parts: string[] = [];
  widgets.forEach((widget, i) => {
    const y = top + i * rowH;
    const pad = w * 0.02;
    const cardX = pad;
    const cardY = y + rowH * 0.08;
    const cardW = w - pad * 2;
    const cardH = rowH * 0.84;
    parts.push(`<rect x="${n(cardX)}" y="${n(cardY)}" width="${n(cardW)}" height="${n(cardH)}" rx="${n(cardH * 0.22)}" fill="rgba(255,255,255,0.92)"/>`);
    if (widget.type === "clock") {
      const timeSize = cardH * 0.5;
      const dateSize = h * 0.018;
      parts.push(
        `<text x="${n(cardX + cardH * 0.55)}" y="${n(cardY + cardH * 0.16)}" font-size="${n(timeSize)}" font-weight="600" fill="#0a0a0a" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc("9:41")}</text>`,
        `<text x="${n(cardX + cardH * 0.55)}" y="${n(cardY + cardH * 0.62)}" font-size="${n(dateSize)}" font-weight="500" fill="#6b7280" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc("Tuesday, Sep 2")}</text>`
      );
    } else {
      const tempSize = cardH * 0.5;
      const citySize = h * 0.018;
      parts.push(
        `<text x="${n(cardX + cardH * 0.52)}" y="${n(cardY + cardH * 0.2)}" font-size="${n(citySize)}" font-weight="500" fill="#6b7280" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc("San Francisco")}</text>`,
        `<text x="${n(cardX + cardH * 0.52)}" y="${n(cardY + cardH * 0.4)}" font-size="${n(tempSize)}" font-weight="600" fill="#0a0a0a" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc("72°")}</text>`
      );
    }
  });
  return parts.join("");
}

/** Canvas twin of androidWidgetsSvg: draws the widget cards. */
function drawAndroidWidgets(
  ctx: CanvasRenderingContext2D,
  widgets: Array<{ type: "clock" | "weather" }>,
  w: number,
  top: number,
  rowH: number,
  h: number,
  fg: string,
  font: string
): void {
  widgets.forEach((widget, i) => {
    const y = top + i * rowH;
    const pad = w * 0.02;
    const cardX = pad;
    const cardY = y + rowH * 0.08;
    const cardW = w - pad * 2;
    const cardH = rowH * 0.84;
    roundRect(ctx, cardX, cardY, cardW, cardH, cardH * 0.22);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    ctx.textAlign = "start";
    ctx.textBaseline = "hanging";
    if (widget.type === "clock") {
      const timeSize = cardH * 0.5;
      ctx.font = `600 ${timeSize}px ${font}`;
      ctx.fillText("9:41", cardX + cardH * 0.55, cardY + cardH * 0.16);
      ctx.fillStyle = "#6b7280";
      ctx.font = `500 ${h * 0.018}px ${font}`;
      ctx.fillText("Tuesday, Sep 2", cardX + cardH * 0.55, cardY + cardH * 0.62);
    } else {
      ctx.fillStyle = "#6b7280";
      ctx.font = `500 ${h * 0.018}px ${font}`;
      ctx.fillText("San Francisco", cardX + cardH * 0.52, cardY + cardH * 0.2);
      ctx.fillStyle = "#0a0a0a";
      ctx.font = `600 ${cardH * 0.5}px ${font}`;
      ctx.fillText("72°", cardX + cardH * 0.52, cardY + cardH * 0.4);
    }
  });
}

/** True when any element rendered in the top 30% of the screen (status bar,
 *  lock clock/date) is visible and needs the legibility scrim above the media. */
function showsTopContent(chrome: ScreenChrome): boolean {
  return chrome.showStatusBar || (chrome.style === "lock" && (chrome.showClock || chrome.showDate));
}

/** Smooth-corner squircle outline (superellipse) for iOS-style icons. */
function superellipseSvg(x: number, y: number, w: number, h: number): string {
  const a = w / 2;
  const b = h / 2;
  const cx = x + a;
  const cy = y + b;
  const pts: string[] = [];
  for (let i = 0; i < SUPERELLIPSE_SAMPLES; i++) {
    const t = (i / SUPERELLIPSE_SAMPLES) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const px = cx + Math.sign(c) * Math.pow(Math.abs(c), 2 / SUPERELLIPSE_EXPONENT) * a;
    const py = cy + Math.sign(s) * Math.pow(Math.abs(s), 2 / SUPERELLIPSE_EXPONENT) * b;
    pts.push(`${n(px)} ${n(py)}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(" L ")} Z`;
}

/** Flashlight glyph inside the lock-screen shortcut circle, centered at (cx, cy). */
function flashlightGlyphSvg(cx: number, cy: number, g: number, fg: string): string {
  const hw = g * 0.31;
  return [
    `<path d="M ${n(cx - hw)} ${n(cy - g * 0.62)} L ${n(cx + hw)} ${n(cy - g * 0.62)} L ${n(cx + g * 0.2)} ${n(cy - g * 0.28)} L ${n(cx - g * 0.2)} ${n(cy - g * 0.28)} Z" fill="${fg}"/>`,
    `<rect x="${n(cx - g * 0.11)}" y="${n(cy - g * 0.28)}" width="${n(g * 0.22)}" height="${n(g * 0.78)}" rx="${n(g * 0.07)}" fill="${fg}"/>`
  ].join("");
}

/** Camera glyph inside the lock-screen shortcut circle, centered at (cx, cy). */
function cameraGlyphSvg(cx: number, cy: number, g: number, fg: string): string {
  return [
    `<rect x="${n(cx - g * 0.16)}" y="${n(cy - g * 0.44)}" width="${n(g * 0.32)}" height="${n(g * 0.14)}" rx="${n(g * 0.05)}" fill="${fg}"/>`,
    `<rect x="${n(cx - g * 0.5)}" y="${n(cy - g * 0.32)}" width="${n(g)}" height="${n(g * 0.68)}" rx="${n(g * 0.14)}" fill="${fg}"/>`,
    `<circle cx="${n(cx)}" cy="${n(cy + g * 0.02)}" r="${n(g * 0.19)}" fill="none" stroke="${fg}" stroke-width="${n(g * 0.09)}"/>`
  ].join("");
}

/** Multicolor Google "G" glyph centered at (cx, cy) with overall height g. */
function androidGoogleGlyphSvg(cx: number, cy: number, g: number): string {
  const r = g * 0.5;
  const sw = g * 0.18;
  // Blue outer ring.
  return (
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="#4285f4" stroke-width="${n(sw)}"/>` +
    // Green crossbar.
    `<path d="M ${n(cx - r * 0.5)} ${n(cy)} H ${n(cx + r * 0.36)}" stroke="#34a853" stroke-width="${n(sw * 0.9)}" stroke-linecap="round" fill="none"/>` +
    // Yellow positive hook (bottom-right).
    `<path d="M ${n(cx + r * 0.36)} ${n(cy)} A ${n(r * 0.62)} ${n(r * 0.62)} 0 0 1 ${n(cx)} ${n(cy + r * 0.62)}" stroke="#fbbc05" stroke-width="${n(sw * 0.9)}" stroke-linecap="round" fill="none"/>`
  );
}

/** SVG inner markup (elements only, no <svg> wrapper) for the screen chrome.
 *  `uid` disambiguates gradient ids when the chrome appears multiple times.
 *  `frame` drives the per-device geometry (island, status bar metrics, dock). */
export function screenChromeElements(chrome: ScreenChrome, w: number, h: number, uid = "sc", frame?: MockupFrame): string {
  const { fg, fgDim, topFrom, dockBg, indicator, circleBg, circleRing, notifBg } = chromePalette(chrome);
  const spec = getChromeSpec(frame);
  const os = chrome.os ?? "ios";
  // Effective overrides: a per-chrome color beats the theme-derived default.
  const clockColor = chrome.clockColor ?? fg;
  const clockDim = chrome.clockColor ?? fgDim;
  const dockBackground = chrome.dockBackground ?? dockBg;
  const dockColors = chrome.dockColors?.length ? chrome.dockColors : SCREEN_CHROME_DOCK_COLORS;
  // Lock clock geometry: per-chrome factors override the frame's defaults.
  const clockSizeFactor = chrome.clockSizeFactor ?? spec.clockSizeFactor;
  const clockYFactor = chrome.clockYFactor ?? spec.clockYFactor;
  const parts: string[] = [];

  if (showsTopContent(chrome)) {
    parts.push(
      `<defs><linearGradient id="${uid}-top" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${topFrom}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/>` +
        `</linearGradient></defs>`,
      `<rect x="0" y="0" width="${n(w)}" height="${n(h * 0.3)}" fill="url(#${uid}-top)"/>`
    );
  }

  if (chrome.style === "lock" && os === "ios" && chrome.showLockShortcuts && spec.lockShortcuts) {
    // Flashlight / camera shortcuts near the bottom edges, like iOS.
    const d = w * 0.13;
    const cy = h - d / 2 - h * 0.055;
    const g = d * 0.44;
    for (const dir of [-1, 1]) {
      const cx = w / 2 + dir * w * 0.346;
      parts.push(
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(d / 2)}" fill="${circleBg}" stroke="${circleRing}" stroke-width="${n(h * 0.0012)}"/>`,
        dir < 0 ? flashlightGlyphSvg(cx, cy, g, fg) : cameraGlyphSvg(cx, cy, g, fg)
      );
    }
  }

  if (chrome.style === "home" && chrome.showDock && isAndroidHome(chrome)) {
    // Android home screen: Google search bar + 4×5 app grid + dock over the
    // media wallpaper. Only the status-bar scrim is drawn above the search bar.
    const statusH = h * (spec.statusBarTimeY + spec.statusBarFontSize * 1.2);
    // Google search pill: a white rounded bar with the multicolor "G".
    const barW = w * 0.86;
    const barH = h * 0.05;
    const barX = (w - barW) / 2;
    const barY = statusH + h * 0.018;
    parts.push(`<rect x="${n(barX)}" y="${n(barY)}" width="${n(barW)}" height="${n(barH)}" rx="${n(barH / 2)}" fill="rgba(255,255,255,0.94)"/>`);
    const gY = barY + barH / 2;
    const gScale = barH * 0.5;
    parts.push(androidGoogleGlyphSvg((barX + barH * 0.8), gY, gScale));
    parts.push(
      `<text x="${n(barX + barH * 1.7)}" y="${n(barY + barH * 0.36)}" font-size="${n(barH * 0.42)}" font-weight="400" fill="#9aa0a6" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc("Search")}</text>`
    );

    // App grid: 4 columns, 5 rows of circular Material icons with labels.
    const widgetRows = Math.min(chrome.widgets?.length ?? 0, 2);
    const grid = androidGridGeom(w, h, barY, barH, spec.dock.height, spec.dock.bottomOffset, chrome.gridCols ?? 4, chrome.gridRows ?? 5, widgetRows);
    // Android home widgets in the reserved band above the app grid.
    if (widgetRows > 0) {
      const widgetTop = barY + barH + h * 0.03;
      const widgetH = grid.widgetRowHeight;
      const widgets = (chrome.widgets ?? []).slice(0, 2);
      parts.push(androidWidgetsSvg(widgets, w, widgetTop, widgetH, h, fg));
    }
    if (grid.fits) {
      const folders = chrome.folders ?? [];
      const cellCount = grid.cols * grid.rows;
      const folderCount = Math.min(folders.length, cellCount);
      const apps = androidGridApps(chrome).slice(0, cellCount - folderCount);
      const totalCells = apps.length + folderCount;
      for (let i = 0; i < totalCells; i++) {
        const { cx, cy } = grid.center(i);
        if (i < apps.length) {
          const app = apps[i]!;
          const labelY = grid.labelY(cy);
          parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(grid.iconSize / 2)}" fill="${escapeMarkup(app.color)}"/>`);
          if (app.emoji) {
            parts.push(`<text x="${n(cx)}" y="${n(cy - grid.iconSize * 0.12)}" font-size="${n(grid.iconSize * 0.78)}" text-anchor="middle" dominant-baseline="hanging">${escapeMarkup(app.emoji)}</text>`);
          }
          parts.push(
            `<text x="${n(cx)}" y="${n(labelY)}" font-size="${n(grid.labelSize)}" font-weight="500" fill="${fg}" font-family="${SCREEN_CHROME_FONT}" text-anchor="middle" dominant-baseline="hanging">${esc(app.label || "App")}</text>`
          );
        } else {
          const folder = folders[i - apps.length]!;
          parts.push(androidFolderSvg(cx, cy, grid.iconSize, folder.color, folder.label, grid.labelSize, fg));
        }
      }
    }

    // Android dock: a subtle translucent pill with 4 circular icons.
    const dockW = w * 0.9;
    const dockIcons = 4;
    const dockHPx = h * spec.dock.height;
    const dockX = (w - dockW) / 2;
    const dockY = h - dockHPx - h * spec.dock.bottomOffset;
    const dockBar = dockHPx * 0.9;
    const dockBarY = dockY + (dockHPx - dockBar) / 2;
    parts.push(`<rect x="${n(dockX)}" y="${n(dockBarY)}" width="${n(dockW)}" height="${n(dockBar)}" rx="${n(dockBar / 2)}" fill="${dockBackground}"/>`);
    const dsize = dockHPx * 0.72;
    const dgap = (dockW - dsize * dockIcons) / (dockIcons + 1);
    const diconY = dockBarY + (dockBar - dsize) / 2;
    const aCustomIcons = chrome.dockIcons?.length ? chrome.dockIcons : null;
    ANDROID_DOCK_COLORS.forEach((color, i) => {
      const diconX = dockX + dgap + i * (dsize + dgap);
      const tile = aCustomIcons?.[i];
      parts.push(
        tile
          ? `<circle cx="${n(diconX + dsize / 2)}" cy="${n(diconY + dsize / 2)}" r="${n(dsize / 2)}" fill="${escapeMarkup(tile.color)}"/>` +
            (tile.emoji
              ? `<text x="${n(diconX + dsize / 2)}" y="${n(diconY + dsize * 0.12)}" font-size="${n(dsize * 0.72)}" text-anchor="middle" dominant-baseline="hanging">${escapeMarkup(tile.emoji)}</text>`
              : "")
          : `<circle cx="${n(diconX + dsize / 2)}" cy="${n(diconY + dsize / 2)}" r="${n(dsize / 2)}" fill="${color}"/>`
      );
    });
  } else if (chrome.style === "home" && chrome.showDock && os !== "desktop" && !isAndroidHome(chrome)) {
    // iOS dock: rounded rect with colored app icons.
    const dockW = w * 0.94;
    const dockH = h * spec.dock.height;
    const dockX = (w - dockW) / 2;
    const dockY = h - dockH - h * spec.dock.bottomOffset;
    parts.push(`<rect x="${n(dockX)}" y="${n(dockY)}" width="${n(dockW)}" height="${n(dockH)}" rx="${n(dockH * 0.4)}" fill="${dockBackground}"/>`);
    const size = w * spec.dock.iconSize;
    const gap = (dockW - size * 4) / 5;
    const iconY = dockY + (dockH - size) / 2;
    const customIcons = chrome.dockIcons?.length ? chrome.dockIcons : null;
    dockColors.forEach((color, i) => {
      const iconX = dockX + gap + i * (size + gap);
      const tile = customIcons?.[i];
      if (tile) {
        // Custom launcher tile: colored rounded square + optional emoji glyph.
        parts.push(`<path d="${superellipseSvg(iconX, iconY, size, size)}" fill="${escapeMarkup(tile.color)}"/>`);
        if (tile.emoji) {
          parts.push(
            `<text x="${n(iconX + size / 2)}" y="${n(iconY + size * 0.15)}" font-size="${n(size * 0.72)}" text-anchor="middle" dominant-baseline="hanging">${escapeMarkup(tile.emoji)}</text>`
          );
        }
      } else {
        parts.push(`<path d="${superellipseSvg(iconX, iconY, size, size)}" fill="${color}"/>`);
      }
    });
    if (customIcons) {
      const labelH = h * 0.02;
      customIcons.forEach((tile, i) => {
        if (tile.label) {
          const iconX = dockX + gap + i * (size + gap);
          parts.push(
            `<text x="${n(iconX + size / 2)}" y="${n(iconY + size + labelH * 0.35)}" font-size="${n(labelH)}" font-weight="500" fill="${fg}" font-family="${SCREEN_CHROME_FONT}" text-anchor="middle" dominant-baseline="hanging">${escapeMarkup(tile.label)}</text>`
          );
        }
      });
    }
  }

  if (chrome.showStatusBar) {
    // One shared row center keeps the time and the right glyph cluster on the
    // same optical line; sizes come from the frame spec.
    const timeSize = h * spec.statusBarFontSize;
    const textTop = h * spec.statusBarTimeY;
    const textX = w * spec.statusBarTimeX;
    const rowCenter = textTop + timeSize * 0.36;
    const glyphH = h * spec.statusBarFontSize * (0.026 / 0.021);
    const px = w / 390;
    parts.push(
      `<text x="${n(textX)}" y="${n(textTop)}" font-size="${n(timeSize)}" font-weight="600" fill="${fg}" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc(chrome.time)}</text>`
    );

    // Battery (rightmost), inset from the frame's right edge.
    const bw = w * 0.062;
    const bh = h * 0.015;
    const bx = w * (1 - spec.statusBarRightInset) - bw;
    const by = rowCenter - bh / 2;
    const cy = rowCenter;
    parts.push(
      `<rect x="${n(bx)}" y="${n(by)}" width="${n(bw)}" height="${n(bh)}" rx="${n(bh / 2.5)}" fill="none" stroke="${fg}" stroke-width="${n(1.3 * px)}"/>`,
      `<rect x="${n(bx + bw + 1.5 * px)}" y="${n(cy - h * 0.0036)}" width="${n(h * 0.002)}" height="${n(h * 0.0072)}" rx="${n(h * 0.001)}" fill="${fg}"/>`,
      `<rect x="${n(bx + 2 * px)}" y="${n(by + 2 * px)}" width="${n((bw - 4 * px) * 0.55)}" height="${n(bh - 4 * px)}" rx="${n((bh - 4 * px) / 2.5)}" fill="${fg}"/>`
    );

    // Wi-Fi fan: three ~90° arcs opening upward from a vertex dot,
    // bottom-aligned with the battery like the real status bar row.
    const wx = bx - w * 0.046;
    const wy = by + bh;
    const radii = [w * 0.0272, w * 0.0187, w * 0.0103];
    const sw = Math.max(1.1, w * 0.0042);
    if (os === "android") {
      // Android (Material-style) Wi-Fi: the same 90° arcs but drawn dotted
      // (the classic Material wave markup), with a smaller vertex dot.
      const dash = Math.max(0.6, sw * 0.5);
      const gap = Math.max(0.6, sw * 0.6);
      for (const r of radii) {
        parts.push(
          `<path d="M ${n(wx - r * Math.SQRT1_2)} ${n(wy - r * Math.SQRT1_2)} A ${n(r)} ${n(r)} 0 0 1 ${n(wx + r * Math.SQRT1_2)} ${n(wy - r * Math.SQRT1_2)}" fill="none" stroke="${fg}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-dasharray="${n(dash)} ${n(gap)}"/>`
        );
      }
      parts.push(`<circle cx="${n(wx)}" cy="${n(wy - sw * 0.1)}" r="${n(sw * 0.6)}" fill="${fg}"/>`);
    } else {
      // iOS: solid arcs with a clear vertex dot.
      const k = Math.SQRT1_2;
      for (const r of radii) {
        parts.push(
          `<path d="M ${n(wx - r * k)} ${n(wy - r * k)} A ${n(r)} ${n(r)} 0 0 1 ${n(wx + r * k)} ${n(wy - r * k)}" fill="none" stroke="${fg}" stroke-width="${n(sw)}" stroke-linecap="round"/>`
        );
      }
      parts.push(`<circle cx="${n(wx)}" cy="${n(wy - sw * 0.2)}" r="${n(sw * 0.75)}" fill="${fg}"/>`);
    }

    // Signal icon left of the Wi-Fi with a clear gap; bar heights stay within
    // the battery's vertical extent so the cluster reads as one row.
    const glyphBottom = cy + bh / 2;
    const barW = w * 0.0075;
    const barGap = barW + w * 0.0049;
    const sx = wx - w * 0.042 - (barW * 4 + barGap * 3);
    if (os === "android") {
      // Android-style cellular signal: a filled right triangle.
      const triW = w * 0.028;
      const triH = glyphH * 0.48;
      parts.push(
        `<path d="M ${n(sx)} ${n(glyphBottom)} L ${n(sx + triW)} ${n(glyphBottom)} L ${n(sx + triW)} ${n(glyphBottom - triH)} Z" fill="${fg}"/>`
      );
    } else {
      // iOS 4-bar signal, tallest bar kept below the battery height.
      const barScale = [0.18, 0.28, 0.38, 0.48];
      barScale.forEach((scale, i) => {
        const bhBar = glyphH * scale;
        const barX = sx + i * barGap;
        parts.push(`<rect x="${n(barX)}" y="${n(glyphBottom - bhBar)}" width="${n(barW)}" height="${n(bhBar)}" rx="${n(barW / 2)}" fill="${fg}"/>`);
      });
    }
  }

  // Lock-screen clock/date geometry, computed for both the clock block and the
  // notification cards that stack underneath it.
  let clockSize = 0;
  let clockY = 0;
  let dateY = 0;
  let dateSize = 0;
  if (chrome.style === "lock") {
    clockSize = h * clockSizeFactor;
    clockY = h * clockYFactor;
    dateSize = h * 0.028;
    // iOS shows the date line above the large clock.
    dateY = chrome.showClock ? clockY - Math.max(dateSize, clockSize * 0.22) * 1.6 : clockY;
  }

  if (chrome.style === "lock" && os !== "desktop" && (chrome.showClock || chrome.showDate)) {
    if (chrome.showDate) {
      parts.push(
        `<text x="${n(w / 2)}" y="${n(dateY)}" font-size="${n(dateSize)}" font-weight="600" fill="${clockDim}" font-family="${SCREEN_CHROME_FONT}" text-anchor="middle" dominant-baseline="hanging">${esc(chrome.date)}</text>`
      );
    }
    if (chrome.showClock) {
      parts.push(
        `<text x="${n(w / 2)}" y="${n(clockY)}" font-size="${n(clockSize)}" font-weight="200" fill="${clockColor}" font-family="${SCREEN_CHROME_FONT}" text-anchor="middle" dominant-baseline="hanging">${esc(chrome.time)}</text>`
      );
    }
  }

  if (chrome.style === "lock" && os !== "desktop" && chrome.showNotifications === true) {
    // Lock-screen notification cards stack under the clock.
    const cardW = w * 0.86;
    const cardH = h * 0.082;
    const cardX = (w - cardW) / 2;
    const cardR = h * 0.015;
    const gap = h * 0.018;
    const clockBottom = chrome.showClock ? clockY + clockSize : chrome.showDate ? dateY + dateSize * 1.2 : 0;
    const cardTop = clockBottom ? clockBottom + h * 0.02 : h * 0.32;
    notificationApps(chrome).forEach((app, i) => {
      const cyTop = cardTop + i * (cardH + gap);
      parts.push(`<rect x="${n(cardX)}" y="${n(cyTop)}" width="${n(cardW)}" height="${n(cardH)}" rx="${n(cardR)}" fill="${notifBg}"/>`);
      const icon = cardH * 0.6;
      const ix = cardX + cardH * 0.18;
      const iy = cyTop + (cardH - icon) / 2;
      parts.push(`<path d="${superellipseSvg(ix, iy, icon, icon)}" fill="${app.color}"/>`);
      const titleX = ix + icon + cardH * 0.18;
      const titleSize = cardH * 0.24;
      const subSize = cardH * 0.2;
      parts.push(
        `<text x="${n(titleX)}" y="${n(cyTop + cardH * 0.34)}" font-size="${n(titleSize)}" font-weight="600" fill="${fg}" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc(app.name)}</text>`,
        `<text x="${n(titleX)}" y="${n(cyTop + cardH * 0.72)}" font-size="${n(subSize)}" font-weight="400" fill="${fgDim}" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc(app.subtitle)}</text>`
      );
    });
  }

  if (chrome.showHomeIndicator && os === "ios" && spec.homeIndicator) {
    const { bottomOffset, width, height } = spec.homeIndicator;
    const ih = h * height;
    const iw = w * width;
    parts.push(
      `<rect x="${n(w / 2 - iw / 2)}" y="${n(h - ih - h * bottomOffset)}" width="${n(iw)}" height="${n(ih)}" rx="${n(ih / 2)}" fill="${indicator}"/>`
    );
  }

  return parts.join("");
}

/** Full standalone SVG document for the chrome, sized to a w×h viewBox. Used by
 *  the CSS preview and the HTML export. `par` defaults to "meet" (overlay
 *  frames, whose cutout defines a screen aspect matching the box); pass "none"
 *  when the target box has a different aspect (CSS-only frames) so the chrome
 *  stretches onto the screen the same way the canvas export draws it.
 *  `frame` drives the per-device geometry. */
export function screenChromeSvg(chrome: ScreenChrome, w: number, h: number, uid = "sc", par = "xMidYMid meet", frame?: MockupFrame): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="100%" height="100%" preserveAspectRatio="${par}">${screenChromeElements(chrome, w, h, uid, frame)}</svg>`;
}

/** Superellipse squircle path on the canvas, mirroring `superellipseSvg`. */
function traceSuperellipse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const a = w / 2;
  const b = h / 2;
  const cx = x + a;
  const cy = y + b;
  ctx.beginPath();
  for (let i = 0; i < SUPERELLIPSE_SAMPLES; i++) {
    const t = (i / SUPERELLIPSE_SAMPLES) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const px = cx + Math.sign(c) * Math.pow(Math.abs(c), 2 / SUPERELLIPSE_EXPONENT) * a;
    const py = cy + Math.sign(s) * Math.pow(Math.abs(s), 2 / SUPERELLIPSE_EXPONENT) * b;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

/** Paints the chrome into the rectangle (x, y, w, h) on a 2D canvas. Mirrors
 *  `screenChromeElements` so the raster exports match the CSS preview. */
export function drawScreenChrome(
  ctx: CanvasRenderingContext2D,
  chrome: ScreenChrome,
  x: number,
  y: number,
  w: number,
  h: number,
  frame?: MockupFrame
): void {
  const { fg, fgDim, topFrom, dockBg, indicator, circleBg, circleRing, notifBg } = chromePalette(chrome);
  const spec = getChromeSpec(frame);
  const os = chrome.os ?? "ios";
  const clockColor = chrome.clockColor ?? fg;
  const clockDim = chrome.clockColor ?? fgDim;
  const dockBackground = chrome.dockBackground ?? dockBg;
  const dockColors = chrome.dockColors?.length ? chrome.dockColors : SCREEN_CHROME_DOCK_COLORS;
  const clockSizeFactor = chrome.clockSizeFactor ?? spec.clockSizeFactor;
  const clockYFactor = chrome.clockYFactor ?? spec.clockYFactor;
  const font = `${SCREEN_CHROME_FONT}`;
  const baseline = "hanging" as const;

  ctx.save();
  ctx.translate(x, y);

  // Top scrim so clock/status bar stay legible over any media.
  if (showsTopContent(chrome)) {
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.3);
    grad.addColorStop(0, topFrom);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h * 0.3);
  }

  if (chrome.style === "lock" && os === "ios" && chrome.showLockShortcuts && spec.lockShortcuts) {
    // Flashlight / camera shortcuts near the bottom edges, like iOS.
    const d = w * 0.13;
    const cy = h - d / 2 - h * 0.055;
    const g = d * 0.44;
    for (const dir of [-1, 1]) {
      const cx = w / 2 + dir * w * 0.346;
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
      ctx.fillStyle = circleBg;
      ctx.fill();
      ctx.lineWidth = h * 0.0012;
      ctx.strokeStyle = circleRing;
      ctx.stroke();
      if (dir < 0) {
        drawFlashlightGlyph(ctx, cx, cy, g, fg);
      } else {
        drawCameraGlyph(ctx, cx, cy, g, fg);
      }
    }
  }

  if (chrome.style === "home" && chrome.showDock && isAndroidHome(chrome)) {
    // Android home screen: Google search bar + 4×5 app grid + dock over the
    // media wallpaper. Mirrors the SVG branch exactly.
    const statusH = h * (spec.statusBarTimeY + spec.statusBarFontSize * 1.2);
    const barW = w * 0.86;
    const barH = h * 0.05;
    const barX = (w - barW) / 2;
    const barY = statusH + h * 0.018;
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fill();
    drawAndroidGoogleGlyph(ctx, barX + barH * 0.8, barY + barH / 2, barH * 0.5);
    ctx.fillStyle = "#9aa0a6";
    ctx.font = `400 ${barH * 0.42}px ${font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "hanging";
    ctx.fillText("Search", barX + barH * 1.7, barY + barH * 0.36);

    const widgetRows = Math.min(chrome.widgets?.length ?? 0, 2);
    const grid = androidGridGeom(w, h, barY, barH, spec.dock.height, spec.dock.bottomOffset, chrome.gridCols ?? 4, chrome.gridRows ?? 5, widgetRows);
    // Android home widgets in the reserved band above the app grid.
    if (widgetRows > 0) {
      const widgetTop = barY + barH + h * 0.03;
      const widgets = (chrome.widgets ?? []).slice(0, 2);
      drawAndroidWidgets(ctx, widgets, w, widgetTop, grid.widgetRowHeight, h, fg, font);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = fg;
    // Skip the grid if the screen is too short (negative radius would throw).
    if (grid.fits) {
      const folders = chrome.folders ?? [];
      const cellCount = grid.cols * grid.rows;
      const folderCount = Math.min(folders.length, cellCount);
      const apps = androidGridApps(chrome).slice(0, cellCount - folderCount);
      const totalCells = apps.length + folderCount;
      for (let i = 0; i < totalCells; i++) {
        const { cx, cy } = grid.center(i);
        if (i < apps.length) {
          const app = apps[i]!;
          const labelY = grid.labelY(cy);
          ctx.beginPath();
          ctx.arc(cx, cy, grid.iconSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = app.color;
          ctx.fill();
          if (app.emoji) {
            ctx.textAlign = "center";
            ctx.textBaseline = "hanging";
            ctx.font = `${grid.iconSize * 0.78}px system emoji`;
            ctx.fillText(app.emoji, cx, cy - grid.iconSize * 0.12);
          }
          ctx.fillStyle = fg;
          ctx.font = `500 ${grid.labelSize}px ${font}`;
          ctx.fillText(app.label || "App", cx, labelY);
        } else {
          const folder = folders[i - apps.length]!;
          drawAndroidFolder(ctx, cx, cy, grid.iconSize, folder.color, folder.label, grid.labelSize, fg, font);
        }
      }
    }

    const dockW = w * 0.9;
    const dockIcons = 4;
    const dockHPx = h * spec.dock.height;
    const dockX = (w - dockW) / 2;
    const dockY = h - dockHPx - h * spec.dock.bottomOffset;
    const dockBar = dockHPx * 0.9;
    const dockBarY = dockY + (dockHPx - dockBar) / 2;
    roundRect(ctx, dockX, dockBarY, dockW, dockBar, dockBar / 2);
    ctx.fillStyle = dockBackground;
    ctx.fill();
    const dsize = dockHPx * 0.72;
    const dgap = (dockW - dsize * dockIcons) / (dockIcons + 1);
    const diconY = dockBarY + (dockBar - dsize) / 2;
    const aCustomIcons = chrome.dockIcons?.length ? chrome.dockIcons : null;
    ANDROID_DOCK_COLORS.forEach((color, i) => {
      const diconX = dockX + dgap + i * (dsize + dgap) + dsize / 2;
      const tile = aCustomIcons?.[i];
      const cx = diconX;
      const cy = diconY + dsize / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, dsize / 2, 0, Math.PI * 2);
      ctx.fillStyle = tile ? tile.color : color;
      ctx.fill();
      if (tile?.emoji) {
        ctx.textAlign = "center";
        ctx.textBaseline = "hanging";
        ctx.font = `${dsize * 0.72}px system emoji`;
        ctx.fillText(tile.emoji, cx, diconY + dsize * 0.12);
      }
    });
  } else if (chrome.style === "home" && chrome.showDock && os !== "desktop" && !isAndroidHome(chrome)) {
    // iOS dock: rounded rect with colored app icons.
    const dockW = w * 0.94;
    const dockH = h * spec.dock.height;
    const dockX = (w - dockW) / 2;
    const dockY = h - dockH - h * spec.dock.bottomOffset;
    roundRect(ctx, dockX, dockY, dockW, dockH, dockH * 0.4);
    ctx.fillStyle = dockBackground;
    ctx.fill();
    const size = w * spec.dock.iconSize;
    const gap = (dockW - size * 4) / 5;
    const iconY = dockY + (dockH - size) / 2;
    const customIcons = chrome.dockIcons?.length ? chrome.dockIcons : null;
    dockColors.forEach((color, i) => {
      const iconX = dockX + gap + i * (size + gap);
      const tile = customIcons?.[i];
      traceSuperellipse(ctx, iconX, iconY, size, size);
      ctx.fillStyle = tile ? tile.color : color;
      ctx.fill();
      if (tile?.emoji) {
        ctx.textAlign = "center";
        ctx.textBaseline = "hanging";
        ctx.font = `${size * 0.72}px system emoji`;
        ctx.fillText(tile.emoji, iconX + size / 2, iconY + size * 0.15);
      }
    });
    if (customIcons) {
      const labelH = h * 0.02;
      ctx.textAlign = "center";
      ctx.textBaseline = "hanging";
      ctx.fillStyle = fg;
      ctx.font = `500 ${labelH}px ${font}`;
      customIcons.forEach((tile, i) => {
        if (tile.label) {
          const iconX = dockX + gap + i * (size + gap);
          ctx.fillText(tile.label, iconX + size / 2, iconY + size + labelH * 0.35);
        }
      });
    }
  }

  if (chrome.showStatusBar) {
    const timeSize = h * spec.statusBarFontSize;
    const textTop = h * spec.statusBarTimeY;
    const textX = w * spec.statusBarTimeX;
    const rowCenter = textTop + timeSize * 0.36;
    const glyphH = h * spec.statusBarFontSize * (0.026 / 0.021);
    const px = w / 390;
    ctx.textAlign = "left";
    ctx.textBaseline = baseline;
    ctx.fillStyle = fg;
    ctx.font = `600 ${timeSize}px ${font}`;
    ctx.fillText(chrome.time, textX, textTop);

    const bw = w * 0.062;
    const bh = h * 0.015;
    const bx = w * (1 - spec.statusBarRightInset) - bw;
    const by = rowCenter - bh / 2;
    const cy = rowCenter;

    roundRect(ctx, bx, by, bw, bh, bh / 2.5);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.3 * px;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.fillRect(bx + 2 * px, by + 2 * px, (bw - 4 * px) * 0.55, bh - 4 * px);
    ctx.fillRect(bx + bw + 1.5 * px, cy - h * 0.0036, h * 0.002, h * 0.0072);

    // Wi-Fi fan: three ~90° arcs opening upward from a vertex dot,
    // bottom-aligned with the battery like the real status bar row.
    const wx = bx - w * 0.046;
    const wy = by + bh;
    const radii = [w * 0.0272, w * 0.0187, w * 0.0103];
    const sw = Math.max(1.1, w * 0.0042);
    ctx.strokeStyle = fg;
    ctx.lineWidth = sw;
    ctx.lineCap = "round";
    if (os === "android") {
      // Android (Material-style) Wi-Fi: dotted arcs (the classic wave markup)
      // with a smaller vertex dot.
      ctx.setLineDash([Math.max(0.6, sw * 0.5), Math.max(0.6, sw * 0.6)]);
      for (const r of radii) {
        ctx.beginPath();
        ctx.arc(wx, wy, r, (-3 * Math.PI) / 4, -Math.PI / 4);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(wx, wy - sw * 0.1, sw * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = fg;
      ctx.fill();
    } else {
      // iOS: solid arcs with a clear vertex dot.
      for (const r of radii) {
        ctx.beginPath();
        ctx.arc(wx, wy, r, (-3 * Math.PI) / 4, -Math.PI / 4);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(wx, wy - sw * 0.2, sw * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = fg;
      ctx.fill();
    }

    const glyphBottom = cy + bh / 2;
    const barW = w * 0.0075;
    const barGap = barW + w * 0.0049;
    const sx = wx - w * 0.042 - (barW * 4 + barGap * 3);
    ctx.fillStyle = fg;
    if (os === "android") {
      // Android-style cellular signal: a filled right triangle.
      const triW = w * 0.028;
      const triH = glyphH * 0.48;
      ctx.beginPath();
      ctx.moveTo(sx, glyphBottom);
      ctx.lineTo(sx + triW, glyphBottom);
      ctx.lineTo(sx + triW, glyphBottom - triH);
      ctx.closePath();
      ctx.fill();
    } else {
      // iOS 4-bar signal, tallest bar kept below the battery height.
      const barScale = [0.18, 0.28, 0.38, 0.48];
      barScale.forEach((scale, i) => {
        const bhBar = glyphH * scale;
        ctx.fillRect(sx + i * barGap, glyphBottom - bhBar, barW, bhBar);
      });
    }
  }

  let clockSize = 0;
  let clockY = 0;
  let dateY = 0;
  let dateSize = 0;
  if (chrome.style === "lock") {
    clockSize = h * clockSizeFactor;
    clockY = h * clockYFactor;
    dateSize = h * 0.028;
    // iOS shows the date line above the large clock.
    dateY = chrome.showClock ? clockY - Math.max(dateSize, clockSize * 0.22) * 1.6 : clockY;
  }

  if (chrome.style === "lock" && os !== "desktop" && (chrome.showClock || chrome.showDate)) {
    ctx.textAlign = "center";
    ctx.textBaseline = baseline;
    if (chrome.showDate) {
      ctx.fillStyle = clockDim;
      ctx.font = `600 ${dateSize}px ${font}`;
      ctx.fillText(chrome.date, w / 2, dateY);
    }
    if (chrome.showClock) {
      ctx.fillStyle = clockColor;
      ctx.font = `200 ${clockSize}px ${font}`;
      ctx.fillText(chrome.time, w / 2, clockY);
    }
  }

  if (chrome.style === "lock" && os !== "desktop" && chrome.showNotifications === true) {
    // Lock-screen notification cards stack under the clock.
    const cardW = w * 0.86;
    const cardH = h * 0.082;
    const cardX = (w - cardW) / 2;
    const cardR = h * 0.015;
    const gap = h * 0.018;
    const clockBottom = chrome.showClock ? clockY + clockSize : chrome.showDate ? dateY + dateSize * 1.2 : 0;
    const cardTop = clockBottom ? clockBottom + h * 0.02 : h * 0.32;
    ctx.textBaseline = baseline;
    notificationApps(chrome).forEach((app, i) => {
      const cyTop = cardTop + i * (cardH + gap);
      roundRect(ctx, cardX, cyTop, cardW, cardH, cardR);
      ctx.fillStyle = notifBg;
      ctx.fill();
      const icon = cardH * 0.6;
      const ix = cardX + cardH * 0.18;
      const iy = cyTop + (cardH - icon) / 2;
      traceSuperellipse(ctx, ix, iy, icon, icon);
      ctx.fillStyle = app.color;
      ctx.fill();
      const titleX = ix + icon + cardH * 0.18;
      const titleSize = cardH * 0.24;
      const subSize = cardH * 0.2;
      ctx.textAlign = "left";
      ctx.fillStyle = fg;
      ctx.font = `600 ${titleSize}px ${font}`;
      ctx.fillText(app.name, titleX, cyTop + cardH * 0.34);
      ctx.fillStyle = fgDim;
      ctx.font = `400 ${subSize}px ${font}`;
      ctx.fillText(app.subtitle, titleX, cyTop + cardH * 0.72);
    });
  }

  if (chrome.showHomeIndicator && os === "ios" && spec.homeIndicator) {
    const { bottomOffset, width, height } = spec.homeIndicator;
    const ih = h * height;
    const iw = w * width;
    roundRect(ctx, w / 2 - iw / 2, h - ih - h * bottomOffset, iw, ih, ih / 2);
    ctx.fillStyle = indicator;
    ctx.fill();
  }

  ctx.restore();
}

/** Flashlight glyph inside the lock-screen shortcut circle, centered at (cx, cy). */
function drawFlashlightGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, g: number, fg: string): void {
  const hw = g * 0.31;
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy - g * 0.62);
  ctx.lineTo(cx + hw, cy - g * 0.62);
  ctx.lineTo(cx + g * 0.2, cy - g * 0.28);
  ctx.lineTo(cx - g * 0.2, cy - g * 0.28);
  ctx.closePath();
  ctx.fill();
  roundRect(ctx, cx - g * 0.11, cy - g * 0.28, g * 0.22, g * 0.78, g * 0.07);
  ctx.fill();
}

/** Camera glyph inside the lock-screen shortcut circle, centered at (cx, cy). */
function drawCameraGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, g: number, fg: string): void {
  ctx.fillStyle = fg;
  roundRect(ctx, cx - g * 0.16, cy - g * 0.44, g * 0.32, g * 0.14, g * 0.05);
  ctx.fill();
  roundRect(ctx, cx - g * 0.5, cy - g * 0.32, g, g * 0.68, g * 0.14);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + g * 0.02, g * 0.19, 0, Math.PI * 2);
  ctx.strokeStyle = fg;
  ctx.lineWidth = g * 0.09;
  ctx.stroke();
}

/** Multicolor Google "G" glyph on the canvas, mirroring `androidGoogleGlyphSvg`. */
function drawAndroidGoogleGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, g: number): void {
  const r = g * 0.5;
  const sw = g * 0.18;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#4285f4";
  ctx.lineWidth = sw;
  ctx.stroke();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy);
  ctx.lineTo(cx + r * 0.36, cy);
  ctx.strokeStyle = "#34a853";
  ctx.lineWidth = sw * 0.9;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI / 2);
  ctx.strokeStyle = "#fbbc05";
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}