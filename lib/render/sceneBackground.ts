import type { EditorScene, PatternId } from "@/lib/types/editor";

export interface CssBackground {
  /** CSS `background` value (gradient, pattern image, solid color, or transparent). */
  background: string;
  /** CSS `background-size` value, or undefined when the mode doesn't set one. */
  backgroundSize?: string;
}

function buildGradientBackground(scene: EditorScene): string {
  if (scene.gradientType === "radial") {
    const stops = scene.gradientVia
      ? `${scene.gradientFrom}, ${scene.gradientVia}, ${scene.gradientTo}`
      : `${scene.gradientFrom}, ${scene.gradientTo}`;
    return `radial-gradient(circle at center, ${stops})`;
  }
  const stops = scene.gradientVia
    ? `${scene.gradientFrom}, ${scene.gradientVia}, ${scene.gradientTo}`
    : `${scene.gradientFrom}, ${scene.gradientTo}`;
  return `linear-gradient(${scene.gradientAngle}deg, ${stops})`;
}

function buildPatternBackground(patternId: PatternId): string {
  switch (patternId) {
    case "dots":
      return `radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)`;
    case "grid":
      return `repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 20px)`;
    case "diagonal":
      return `repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 20px)`;
    case "noise": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100" height="100" filter="url(%23n)" opacity="0.15"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    case "plus": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M9 4h2v5h5v2h-5v5h-2v-5h-5v-2h5z" fill="rgba(255,255,255,0.12)"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    case "cross": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M6 6l8 8M14 6l-8 8" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-linecap="round"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    case "triangle": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M5 0L10 20H0zM15 20L10 0h10z" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    default:
      return "transparent";
  }
}

/** The raw SVG tile (no data: wrapping) for each pattern, keyed by id. Used by
 *  the SVG/HTML exporters to render patterns as a repeating `<pattern>` fill,
 *  so all seven patterns match the CSS preview (which uses gradient/data-URL
 *  backgrounds) instead of the SVG export silently dropping them. */
export const PATTERN_TILES: Partial<Record<PatternId, string>> = {
  dots: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="1.5" fill="rgba(255,255,255,0.15)"/></svg>`,
  grid: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/></svg>`,
  diagonal: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M-5 5L5 -5M0 20L20 0M15 25L25 15" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/></svg>`,
  noise: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100" height="100" filter="url(%23n)" opacity="0.15"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M9 4h2v5h5v2h-5v5h-2v-5h-5v-2h5z" fill="rgba(255,255,255,0.12)"/></svg>`,
  cross: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M6 6l8 8M14 6l-8 8" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-linecap="round"/></svg>`,
  triangle: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M5 0L10 20H0zM15 20L10 0h10z" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/></svg>`
};

/** Builds the CSS `background` and `background-size` for a scene's
 *  backgroundMode. Shared by the live CSS preview and any CSS-emitting export
 *  (HTML/SVG) so gradient and pattern rendering never drifts between them. */
export function buildCssBackground(scene: EditorScene): CssBackground {
  if (scene.backgroundMode === "solid") {
    return { background: scene.backgroundColor };
  }
  if (scene.backgroundMode === "gradient") {
    return { background: buildGradientBackground(scene) };
  }
  if (scene.backgroundMode === "image") {
    return { background: "#0a0a0f" };
  }
  if (scene.backgroundMode === "pattern" && scene.patternId) {
    const tiled = scene.patternId === "dots" || scene.patternId === "plus" || scene.patternId === "cross" || scene.patternId === "triangle";
    return {
      background: buildPatternBackground(scene.patternId),
      backgroundSize: tiled ? "20px 20px" : "cover"
    };
  }
  return { background: "transparent" };
}
