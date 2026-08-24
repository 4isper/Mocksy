import type { PatternId } from "@/lib/types/editor";

/** Builds the CSS `background` value used to preview a pattern preset in the
 *  swatch buttons (and nowhere else). SVG-based patterns are embedded as data
 *  URIs; the gradient/dot variants are inline CSS. */
export function buildPatternSwatchStyle(patternId: PatternId): string {
  switch (patternId) {
    case "dots":
      return `radial-gradient(circle, rgba(255,255,255,0.25) 1.5px, transparent 1.5px)`;
    case "grid":
      return `repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 10px), repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 10px)`;
    case "diagonal":
      return `repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 10px)`;
    case "noise": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="60" height="60" filter="url(%23n)" opacity="0.25"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    case "plus": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M9 4h2v5h5v2h-5v5h-2v-5h-5v-2h5z" fill="rgba(255,255,255,0.25)"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    case "cross": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M6 6l8 8M14 6l-8 8" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-linecap="round"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    case "triangle": {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M5 0L10 20H0zM15 20L10 0h10z" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/></svg>`;
      return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
    }
    default:
      return "transparent";
  }
}
