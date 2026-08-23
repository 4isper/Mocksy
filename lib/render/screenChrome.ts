import type { ScreenChrome } from "@/lib/types/editor";
import { escapeMarkup } from "@/lib/export/markupUtils";
import { frameOs } from "@/lib/render/frames";

/**
 * Screen decoration (status bar, lock-screen clock/date, home dock, home
 * indicator) rendered on top of the media. One module feeds every renderer:
 * `screenChromeElements` emits SVG markup (CSS preview, SVG/HTML export) and
 * `drawScreenChrome` paints the same geometry on a 2D canvas (PNG/video export),
 * so the preview matches every export exactly.
 *
 * Geometry is expressed in units of the target rectangle (w × h), typically
 * 390 × 844 for a phone screen; callers scale it to whatever the frame is.
 */

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
    circleRing: dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.2)"
  };
}

export const SCREEN_CHROME_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
export const SCREEN_CHROME_DOCK_COLORS = ["#30d158", "#0a84ff", "#ff9f0a", "#ff375f"];

/** True when any element rendered in the top 30% of the screen (status bar,
 *  lock clock/date) is visible and needs the legibility scrim above the media. */
function showsTopContent(chrome: ScreenChrome): boolean {
  return chrome.showStatusBar || (chrome.style === "lock" && (chrome.showClock || chrome.showDate));
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

/** SVG inner markup (elements only, no <svg> wrapper) for the screen chrome.
 *  `uid` disambiguates gradient ids when the chrome appears multiple times. */
export function screenChromeElements(chrome: ScreenChrome, w: number, h: number, uid = "sc"): string {
  const { fg, fgDim, topFrom, dockBg, indicator, circleBg, circleRing } = chromePalette(chrome);
  const os = chrome.os ?? "ios";
  if (os === "desktop") return "";
  const parts: string[] = [];

  if (showsTopContent(chrome)) {
    parts.push(
      `<defs><linearGradient id="${uid}-top" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${topFrom}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/>` +
        `</linearGradient></defs>`,
      `<rect x="0" y="0" width="${n(w)}" height="${n(h * 0.3)}" fill="url(#${uid}-top)"/>`
    );
  }

  if (chrome.style === "lock" && os === "ios") {
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

  if (chrome.style === "home" && chrome.showDock && os === "ios") {
    // iOS-like dock: rounded rect (not a capsule), 60pt-scale icons, tight gaps.
    const dockW = w * 0.94;
    const dockH = h * 0.112;
    const dockX = (w - dockW) / 2;
    const dockY = h - dockH - h * 0.064;
    parts.push(`<rect x="${n(dockX)}" y="${n(dockY)}" width="${n(dockW)}" height="${n(dockH)}" rx="${n(dockH * 0.4)}" fill="${dockBg}"/>`);
    const size = w * 0.15;
    const gap = (dockW - size * 4) / 5;
    const iconY = dockY + (dockH - size) / 2;
    SCREEN_CHROME_DOCK_COLORS.forEach((color, i) => {
      const iconX = dockX + gap + i * (size + gap);
      parts.push(`<rect x="${n(iconX)}" y="${n(iconY)}" width="${n(size)}" height="${n(size)}" rx="${n(size * 0.225)}" fill="${color}"/>`);
    });
  }

  if (chrome.showStatusBar) {
    // One shared row center keeps the time and the right glyph cluster on the
    // same optical line; sizes mirror iOS at 390×844 and scale with the screen.
    const timeSize = h * 0.021;
    const textTop = h * 0.026;
    const rowCenter = textTop + timeSize * 0.36;
    const glyphH = h * 0.026;
    const px = w / 390;
    parts.push(
      `<text x="${n(w * 0.062)}" y="${n(textTop)}" font-size="${n(timeSize)}" font-weight="600" fill="${fg}" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc(chrome.time)}</text>`
    );

    // Battery (rightmost).
    const bw = w * 0.062;
    const bh = h * 0.015;
    const bx = w * 0.948 - bw;
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
    const k = Math.SQRT1_2;
    const sw = Math.max(1.1, w * 0.0042);
    for (const r of radii) {
      parts.push(
        `<path d="M ${n(wx - r * k)} ${n(wy - r * k)} A ${n(r)} ${n(r)} 0 0 1 ${n(wx + r * k)} ${n(wy - r * k)}" fill="none" stroke="${fg}" stroke-width="${n(sw)}" stroke-linecap="round"/>`
      );
    }
    parts.push(`<circle cx="${n(wx)}" cy="${n(wy - sw * 0.2)}" r="${n(sw * 0.75)}" fill="${fg}"/>`);

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

  if (chrome.style === "lock" && (chrome.showClock || chrome.showDate)) {
    const clockSize = h * 0.105;
    const clockY = h * 0.175;
    const dateSize = h * 0.028;
    // iOS shows the date line above the large clock.
    const dateY = chrome.showClock ? clockY - dateSize * 1.6 : clockY;
    if (chrome.showDate) {
      parts.push(
        `<text x="${n(w / 2)}" y="${n(dateY)}" font-size="${n(dateSize)}" font-weight="600" fill="${fgDim}" font-family="${SCREEN_CHROME_FONT}" text-anchor="middle" dominant-baseline="hanging">${esc(chrome.date)}</text>`
      );
    }
    if (chrome.showClock) {
      parts.push(
        `<text x="${n(w / 2)}" y="${n(clockY)}" font-size="${n(clockSize)}" font-weight="200" fill="${fg}" font-family="${SCREEN_CHROME_FONT}" text-anchor="middle" dominant-baseline="hanging">${esc(chrome.time)}</text>`
      );
    }
  }

  if (chrome.showHomeIndicator && os === "ios") {
    const iw = w * 0.36;
    const ih = h * 0.009;
    parts.push(
      `<rect x="${n(w / 2 - iw / 2)}" y="${n(h - ih - h * 0.016)}" width="${n(iw)}" height="${n(ih)}" rx="${n(ih / 2)}" fill="${indicator}"/>`
    );
  }

  return parts.join("");
}

/** Full standalone SVG document for the chrome, sized to a w×h viewBox. Used by
 *  the CSS preview and the HTML export. `par` defaults to "meet" (overlay
 *  frames, whose cutout defines a screen aspect matching the box); pass "none"
 *  when the target box has a different aspect (CSS-only frames) so the chrome
 *  stretches onto the screen the same way the canvas export draws it. */
export function screenChromeSvg(chrome: ScreenChrome, w: number, h: number, uid = "sc", par = "xMidYMid meet"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="100%" height="100%" preserveAspectRatio="${par}">${screenChromeElements(chrome, w, h, uid)}</svg>`;
}

/** Paints the chrome into the rectangle (x, y, w, h) on a 2D canvas. Mirrors
 *  `screenChromeElements` so the raster exports match the CSS preview. */
export function drawScreenChrome(
  ctx: CanvasRenderingContext2D,
  chrome: ScreenChrome,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const { fg, fgDim, topFrom, dockBg, indicator, circleBg, circleRing } = chromePalette(chrome);
  const os = chrome.os ?? "ios";
  if (os === "desktop") return;
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

  if (chrome.style === "lock" && os === "ios") {
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

  if (chrome.style === "home" && chrome.showDock && os === "ios") {
    // iOS-like dock: rounded rect (not a capsule), 60pt-scale icons, tight gaps.
    const dockW = w * 0.94;
    const dockH = h * 0.112;
    const dockX = (w - dockW) / 2;
    const dockY = h - dockH - h * 0.064;
    roundRect(ctx, dockX, dockY, dockW, dockH, dockH * 0.4);
    ctx.fillStyle = dockBg;
    ctx.fill();
    const size = w * 0.15;
    const gap = (dockW - size * 4) / 5;
    const iconY = dockY + (dockH - size) / 2;
    SCREEN_CHROME_DOCK_COLORS.forEach((color, i) => {
      const iconX = dockX + gap + i * (size + gap);
      roundRect(ctx, iconX, iconY, size, size, size * 0.225);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  if (chrome.showStatusBar) {
    const timeSize = h * 0.021;
    const textTop = h * 0.026;
    const rowCenter = textTop + timeSize * 0.36;
    const glyphH = h * 0.026;
    const px = w / 390;
    ctx.textAlign = "left";
    ctx.textBaseline = baseline;
    ctx.fillStyle = fg;
    ctx.font = `600 ${timeSize}px ${font}`;
    ctx.fillText(chrome.time, w * 0.062, textTop);

    const bw = w * 0.062;
    const bh = h * 0.015;
    const bx = w * 0.948 - bw;
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
    for (const r of radii) {
      ctx.beginPath();
      ctx.arc(wx, wy, r, (-3 * Math.PI) / 4, -Math.PI / 4);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(wx, wy - sw * 0.2, sw * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = fg;
    ctx.fill();

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

  if (chrome.style === "lock" && (chrome.showClock || chrome.showDate)) {
    const clockSize = h * 0.105;
    const clockY = h * 0.175;
    const dateSize = h * 0.028;
    // iOS shows the date line above the large clock.
    const dateY = chrome.showClock ? clockY - dateSize * 1.6 : clockY;
    ctx.textAlign = "center";
    ctx.textBaseline = baseline;
    if (chrome.showDate) {
      ctx.fillStyle = fgDim;
      ctx.font = `600 ${dateSize}px ${font}`;
      ctx.fillText(chrome.date, w / 2, dateY);
    }
    if (chrome.showClock) {
      ctx.fillStyle = fg;
      ctx.font = `200 ${clockSize}px ${font}`;
      ctx.fillText(chrome.time, w / 2, clockY);
    }
  }

  if (chrome.showHomeIndicator && os === "ios") {
    const iw = w * 0.36;
    const ih = h * 0.009;
    roundRect(ctx, w / 2 - iw / 2, h - ih - h * 0.016, iw, ih, ih / 2);
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
