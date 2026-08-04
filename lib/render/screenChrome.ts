import type { ScreenChrome } from "@/lib/types/editor";

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
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

/** SVG inner markup (elements only, no <svg> wrapper) for the screen chrome.
 *  `uid` disambiguates gradient ids when the chrome appears multiple times. */
export function screenChromeElements(chrome: ScreenChrome, w: number, h: number, uid = "sc"): string {
  const { fg, fgDim, topFrom, dockBg, indicator, circleBg, circleRing } = chromePalette(chrome);
  const parts: string[] = [];

  parts.push(
    `<defs><linearGradient id="${uid}-top" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${topFrom}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/>` +
      `</linearGradient></defs>`,
    `<rect x="0" y="0" width="${n(w)}" height="${n(h * 0.3)}" fill="url(#${uid}-top)"/>`
  );

  if (chrome.style === "lock") {
    // Flashlight / camera shortcut circles above the home indicator.
    const d = h * 0.095;
    const gap = w * 0.14;
    const cy = h - d - h * 0.05;
    const inner = d * 0.16;
    for (const dir of [-1, 1]) {
      const cx = w / 2 + dir * (d / 2 + gap / 2);
      parts.push(
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(d / 2)}" fill="${circleBg}" stroke="${circleRing}" stroke-width="${n(h * 0.0012)}"/>`,
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(inner)}" fill="${fgDim}"/>`
      );
    }
  }

  if (chrome.style === "home" && chrome.showDock) {
    const dockW = w * 0.92;
    const dockH = h * 0.115;
    const dockX = (w - dockW) / 2;
    const dockY = h * 0.8;
    parts.push(`<rect x="${n(dockX)}" y="${n(dockY)}" width="${n(dockW)}" height="${n(dockH)}" rx="${n(dockH / 2)}" fill="${dockBg}"/>`);
    const size = w * 0.115;
    const gap = (dockW - size * 4) / 5;
    const iconY = dockY + (dockH - size) / 2;
    SCREEN_CHROME_DOCK_COLORS.forEach((color, i) => {
      const iconX = dockX + gap + i * (size + gap);
      parts.push(`<rect x="${n(iconX)}" y="${n(iconY)}" width="${n(size)}" height="${n(size)}" rx="${n(size * 0.24)}" fill="${color}"/>`);
    });
  }

  if (chrome.showStatusBar) {
    const sbTop = h * 0.026;
    const glyphH = h * 0.026;
    const timeSize = h * 0.03;
    parts.push(
      `<text x="${n(w * 0.055)}" y="${n(sbTop)}" font-size="${n(timeSize)}" font-weight="600" fill="${fg}" font-family="${SCREEN_CHROME_FONT}" text-anchor="start" dominant-baseline="hanging">${esc(chrome.time)}</text>`
    );

    // Battery (rightmost).
    const bw = w * 0.062;
    const bh = h * 0.015;
    const right = w * 0.948;
    const bx = right - bw;
    const by = sbTop + (glyphH - bh) / 2;
    const cy = by + bh / 2;
    parts.push(
      `<rect x="${n(bx)}" y="${n(by)}" width="${n(bw)}" height="${n(bh)}" rx="${n(bh / 2.5)}" fill="none" stroke="${fg}" stroke-width="1.3"/>`,
      `<rect x="${n(bx + bw + 1.5)}" y="${n(cy - h * 0.0036)}" width="${n(h * 0.002)}" height="${n(h * 0.0072)}" rx="${n(h * 0.001)}" fill="${fg}"/>`,
      `<rect x="${n(bx + 2)}" y="${n(by + 2)}" width="${n((bw - 4) * 0.55)}" height="${n(bh - 4)}" rx="${n((bh - 4) / 2.5)}" fill="${fg}"/>`
    );

    // Wi-Fi arcs, centered left of the battery.
    const wx = bx - w * 0.046;
    const radii = [w * 0.015, w * 0.0102, w * 0.0056];
    for (const r of radii) {
      parts.push(`<path d="M ${n(wx - r)} ${n(cy)} A ${n(r)} ${n(r)} 0 0 1 ${n(wx + r)} ${n(cy)}" fill="none" stroke="${fg}" stroke-width="1.5" stroke-linecap="round"/>`);
    }
    parts.push(`<circle cx="${n(wx)}" cy="${n(cy + h * 0.0016)}" r="1.2" fill="${fg}"/>`);

    // Signal bars, centered left of the Wi-Fi.
    const sx = wx - w * 0.036;
    const barW = w * 0.0075;
    const barGap = barW + w * 0.0022;
    for (let i = 0; i < 4; i++) {
      const bhBar = glyphH * (0.24 + i * 0.24);
      const barX = sx + i * barGap;
      parts.push(`<rect x="${n(barX)}" y="${n(cy + glyphH / 2 - bhBar)}" width="${n(barW)}" height="${n(bhBar)}" rx="${n(barW / 2)}" fill="${fg}"/>`);
    }
  }

  if (chrome.style === "lock" && (chrome.showClock || chrome.showDate)) {
    const clockSize = h * 0.105;
    const clockY = h * 0.175;
    if (chrome.showClock) {
      parts.push(
        `<text x="${n(w / 2)}" y="${n(clockY)}" font-size="${n(clockSize)}" font-weight="200" fill="${fg}" font-family="${SCREEN_CHROME_FONT}" text-anchor="middle" dominant-baseline="hanging">${esc(chrome.time)}</text>`
      );
    }
    if (chrome.showDate) {
      const dateSize = h * 0.028;
      parts.push(
        `<text x="${n(w / 2)}" y="${n(chrome.showClock ? clockY + clockSize * 0.98 : clockY)}" font-size="${n(dateSize)}" font-weight="600" fill="${fgDim}" font-family="${SCREEN_CHROME_FONT}" text-anchor="middle" dominant-baseline="hanging">${esc(chrome.date)}</text>`
      );
    }
  }

  if (chrome.showHomeIndicator) {
    const iw = w * 0.36;
    const ih = h * 0.009;
    parts.push(
      `<rect x="${n(w / 2 - iw / 2)}" y="${n(h - ih - h * 0.016)}" width="${n(iw)}" height="${n(ih)}" rx="${n(ih / 2)}" fill="${indicator}"/>`
    );
  }

  return parts.join("");
}

/** Full standalone SVG document for the chrome, sized to a w×h viewBox. Used by
 *  the CSS preview and the HTML export. */
export function screenChromeSvg(chrome: ScreenChrome, w: number, h: number, uid = "sc"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${screenChromeElements(chrome, w, h, uid)}</svg>`;
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
  const font = `${SCREEN_CHROME_FONT}`;
  const baseline = "hanging" as const;

  ctx.save();
  ctx.translate(x, y);

  // Top scrim so clock/status bar stay legible over any media.
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.3);
  grad.addColorStop(0, topFrom);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 0.3);

  if (chrome.style === "lock") {
    const d = h * 0.095;
    const gap = w * 0.14;
    const cy = h - d - h * 0.05;
    const inner = d * 0.16;
    for (const dir of [-1, 1]) {
      const cx = w / 2 + dir * (d / 2 + gap / 2);
      ctx.beginPath();
      ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
      ctx.fillStyle = circleBg;
      ctx.fill();
      ctx.lineWidth = h * 0.0012;
      ctx.strokeStyle = circleRing;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx.fillStyle = fgDim;
      ctx.fill();
    }
  }

  if (chrome.style === "home" && chrome.showDock) {
    const dockW = w * 0.92;
    const dockH = h * 0.115;
    const dockX = (w - dockW) / 2;
    const dockY = h * 0.8;
    roundRect(ctx, dockX, dockY, dockW, dockH, dockH / 2);
    ctx.fillStyle = dockBg;
    ctx.fill();
    const size = w * 0.115;
    const gap = (dockW - size * 4) / 5;
    const iconY = dockY + (dockH - size) / 2;
    SCREEN_CHROME_DOCK_COLORS.forEach((color, i) => {
      const iconX = dockX + gap + i * (size + gap);
      roundRect(ctx, iconX, iconY, size, size, size * 0.24);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  if (chrome.showStatusBar) {
    const sbTop = h * 0.026;
    const glyphH = h * 0.026;
    ctx.textAlign = "left";
    ctx.textBaseline = baseline;
    ctx.fillStyle = fg;
    ctx.font = `600 ${h * 0.03}px ${font}`;
    ctx.fillText(chrome.time, w * 0.055, sbTop);

    const bw = w * 0.062;
    const bh = h * 0.015;
    const bx = w * 0.948 - bw;
    const by = sbTop + (glyphH - bh) / 2;
    const cy = by + bh / 2;

    roundRect(ctx, bx, by, bw, bh, bh / 2.5);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.fillRect(bx + 2, by + 2, (bw - 4) * 0.55, bh - 4);
    ctx.fillRect(bx + bw + 1.5, cy - h * 0.0036, h * 0.002, h * 0.0072);

    const wx = bx - w * 0.046;
    const radii = [w * 0.015, w * 0.0102, w * 0.0056];
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (const r of radii) {
      ctx.beginPath();
      ctx.arc(wx, cy, r, Math.PI, 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(wx, cy + h * 0.0016, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = fg;
    ctx.fill();

    const sx = wx - w * 0.036;
    const barW = w * 0.0075;
    const barGap = barW + w * 0.0022;
    ctx.fillStyle = fg;
    for (let i = 0; i < 4; i++) {
      const bhBar = glyphH * (0.24 + i * 0.24);
      ctx.fillRect(sx + i * barGap, cy + glyphH / 2 - bhBar, barW, bhBar);
    }
  }

  if (chrome.style === "lock" && (chrome.showClock || chrome.showDate)) {
    const clockSize = h * 0.105;
    const clockY = h * 0.175;
    ctx.textAlign = "center";
    ctx.textBaseline = baseline;
    if (chrome.showClock) {
      ctx.fillStyle = fg;
      ctx.font = `200 ${clockSize}px ${font}`;
      ctx.fillText(chrome.time, w / 2, clockY);
    }
    if (chrome.showDate) {
      ctx.fillStyle = fgDim;
      ctx.font = `600 ${h * 0.028}px ${font}`;
      ctx.fillText(chrome.date, w / 2, chrome.showClock ? clockY + clockSize * 0.98 : clockY);
    }
  }

  if (chrome.showHomeIndicator) {
    const iw = w * 0.36;
    const ih = h * 0.009;
    roundRect(ctx, w / 2 - iw / 2, h - ih - h * 0.016, iw, ih, ih / 2);
    ctx.fillStyle = indicator;
    ctx.fill();
  }

  ctx.restore();
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
