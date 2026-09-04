"use client";

import type { EditorScene } from "@/lib/types/editor";
import { RENDER } from "@/lib/render/canvasDrawing";

/** Deterministic PRNG (mulberry32) so pattern fills render identically on
 *  every pass — preview, PNG export and every frame of a video export must
 *  agree, which Math.random() can never guarantee. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fillGradientBackground(ctx: CanvasRenderingContext2D, scene: EditorScene, width: number, height: number) {
  if (scene.gradientType === "radial") {
    // Match the CSS preview's `radial-gradient(circle at center)`: the default
    // extent is farthest-corner, i.e. radius = hypot(w, h) / 2. Math.max used
    // to pick the longer half-axis, painting a visibly different gradient on
    // non-square canvases.
    const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.hypot(width, height) / 2);
    grad.addColorStop(0, scene.gradientFrom);
    if (scene.gradientVia) grad.addColorStop(0.5, scene.gradientVia);
    grad.addColorStop(1, scene.gradientTo);
    ctx.fillStyle = grad;
  } else {
    const rad = ((scene.gradientAngle ?? RENDER.gradientAngleDeg) * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const lineLen = Math.abs(width * dx) + Math.abs(height * dy);
    const cx = width / 2;
    const cy = height / 2;
    const grad = ctx.createLinearGradient(
      cx - (dx * lineLen) / 2,
      cy - (dy * lineLen) / 2,
      cx + (dx * lineLen) / 2,
      cy + (dy * lineLen) / 2
    );
    grad.addColorStop(0, scene.gradientFrom);
    if (scene.gradientVia) grad.addColorStop(0.5, scene.gradientVia);
    grad.addColorStop(1, scene.gradientTo);
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, 0, width, height);
}

/** Cover-fits the background image to the canvas with the configured blur.
 *  Returns true when an image was actually painted. */
export function fillBackgroundImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
  dpiScale: number,
  blurPx: number
): boolean {
  const img = image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const iw = img.naturalWidth || img.width || width;
  const ih = img.naturalHeight || img.height || height;
  const scale = Math.max(width / iw, height / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const blur = blurPx * dpiScale;
  const pad = blur * 2;
  ctx.save();
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(image, (width - dw) / 2 - pad, (height - dh) / 2 - pad, dw + pad * 2, dh + pad * 2);
  ctx.restore();
  return true;
}

export function fillPatternBackground(ctx: CanvasRenderingContext2D, scene: EditorScene, width: number, height: number) {
  const patternId = scene.patternId;
  if (!patternId) {
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  switch (patternId) {
    case "dots": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (let x = 0; x < width; x += 20) {
        for (let y = 0; y < height; y += 20) {
          ctx.beginPath();
          ctx.arc(x + 10, y + 10, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "grid": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      break;
    }
    case "diagonal": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      const step = RENDER.shadowOffsetY;
      for (let i = -height; i < width + height; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + height, height);
        ctx.stroke();
      }
      break;
    }
    case "noise": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      // Deterministic noise: Math.random() would make every rendered frame
      // differ, so video exports flicker and a PNG never matches the preview.
      // The seed is derived from the canvas size so the pattern stays stable
      // across renders (and across export + preview) of the same canvas.
      const rand = mulberry32((width * 374761393 + height * 668265263) >>> 0);
      for (let i = 0; i < data.length; i += 4) {
        const d0 = data[i] ?? 0;
        const d1 = data[i + 1] ?? 0;
        const d2 = data[i + 2] ?? 0;
        const noise = (rand() - 0.5) * 30;
        data[i] = Math.max(0, Math.min(255, d0 + noise));
        data[i + 1] = Math.max(0, Math.min(255, d1 + noise));
        data[i + 2] = Math.max(0, Math.min(255, d2 + noise));
      }
      ctx.putImageData(imageData, 0, 0);
      break;
    }
    case "plus": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      for (let x = 0; x < width; x += 20) {
        for (let y = 0; y < height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(x + 10, y + 6);
          ctx.lineTo(x + 10, y + 14);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 10);
          ctx.lineTo(x + 14, y + 10);
          ctx.stroke();
        }
      }
      break;
    }
    case "cross": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (let x = 0; x < width; x += 20) {
        for (let y = 0; y < height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(x + 7, y + 7);
          ctx.lineTo(x + 13, y + 13);
          ctx.moveTo(x + 13, y + 7);
          ctx.lineTo(x + 7, y + 13);
          ctx.stroke();
        }
      }
      break;
    }
    case "triangle": {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 20) {
        for (let y = 0; y < height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(x + 5, y);
          ctx.lineTo(x + 10, y + 20);
          ctx.lineTo(x, y + 20);
          ctx.closePath();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 15, y + 20);
          ctx.lineTo(x + 10, y);
          ctx.lineTo(x + 20, y);
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;
    }
    default:
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, width, height);
  }
}

/** Paints the scene's configured background onto the canvas. Handles every
 *  backgroundMode; `backgroundFill` (non-alpha video export) and a preloaded
 *  `backgroundImage` are optional inputs resolved by the caller. The fallback
 *  color is a parameter because multi-frame mode and single-frame mode paint
 *  different neutrals for an unsupported/empty combo. */
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  scene: EditorScene,
  width: number,
  height: number,
  dpiScale: number,
  backgroundFill?: string,
  backgroundImage?: CanvasImageSource | null,
  emptyColor = "rgba(255,255,255,0.04)"
) {
  if (scene.backgroundMode === "image" && backgroundImage) {
    fillBackgroundImage(ctx, backgroundImage, width, height, dpiScale, scene.backgroundBlur);
    return;
  }
  if (scene.backgroundMode === "gradient") {
    fillGradientBackground(ctx, scene, width, height);
    return;
  }
  if (scene.backgroundMode === "pattern") {
    fillPatternBackground(ctx, scene, width, height);
    return;
  }
  if (scene.backgroundMode === "solid") {
    ctx.fillStyle = scene.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (scene.backgroundMode === "transparent" && backgroundFill) {
    ctx.fillStyle = backgroundFill;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  ctx.fillStyle = emptyColor;
  ctx.fillRect(0, 0, width, height);
}
