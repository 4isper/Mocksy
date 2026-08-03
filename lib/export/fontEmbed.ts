"use client";

import type { EditorScene } from "@/lib/types/editor";

/**
 * Google-hosted fonts that can be embedded into SVG/HTML exports. Each entry
 * is a variable woff2 per unicode subset (bundled in public/fonts/), so one
 * file covers the 400-600 weight range used by text annotations and the
 * watermark. Fonts bundled here are OFL/Apache-licensed (see public/fonts/).
 */
export interface EmbeddedFontSpec {
  /** Family name as it appears in font-family stacks. */
  family: string;
  /** Weight range the variable font covers, declared in @font-face. */
  weight: string;
  /** Subset name -> bundled asset path on the app origin. */
  subsets: Record<string, string>;
}

export const EMBEDDED_FONTS: EmbeddedFontSpec[] = [
  {
    family: "Inter",
    weight: "400 700",
    subsets: {
      latin: "/fonts/inter-latin.woff2",
      "latin-ext": "/fonts/inter-latin-ext.woff2",
      cyrillic: "/fonts/inter-cyrillic.woff2",
      "cyrillic-ext": "/fonts/inter-cyrillic-ext.woff2"
    }
  },
  {
    family: "Roboto",
    weight: "400 700",
    subsets: {
      latin: "/fonts/roboto-latin.woff2",
      "latin-ext": "/fonts/roboto-latin-ext.woff2",
      cyrillic: "/fonts/roboto-cyrillic.woff2",
      "cyrillic-ext": "/fonts/roboto-cyrillic-ext.woff2"
    }
  },
  {
    family: "Montserrat",
    weight: "400 700",
    subsets: {
      latin: "/fonts/montserrat-latin.woff2",
      "latin-ext": "/fonts/montserrat-latin-ext.woff2",
      cyrillic: "/fonts/montserrat-cyrillic.woff2",
      "cyrillic-ext": "/fonts/montserrat-cyrillic-ext.woff2"
    }
  },
  {
    family: "Lora",
    weight: "400 700",
    subsets: {
      latin: "/fonts/lora-latin.woff2",
      "latin-ext": "/fonts/lora-latin-ext.woff2",
      cyrillic: "/fonts/lora-cyrillic.woff2",
      "cyrillic-ext": "/fonts/lora-cyrillic-ext.woff2"
    }
  },
  {
    family: "Caveat",
    weight: "400 700",
    subsets: {
      latin: "/fonts/caveat-latin.woff2",
      "latin-ext": "/fonts/caveat-latin-ext.woff2",
      cyrillic: "/fonts/caveat-cyrillic.woff2",
      "cyrillic-ext": "/fonts/caveat-cyrillic-ext.woff2"
    }
  }
];

/** Standard Google Fonts unicode-ranges for the bundled subsets. Kept in the
 * exported CSS so glyphs outside a subset fall back to the rest of the stack
 * instead of rendering as tofu with a partial data-URI font. */
export const UNICODE_RANGES: Record<string, string> = {
  "cyrillic-ext": "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F",
  cyrillic: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116",
  "latin-ext":
    "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
  latin: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
};

/** Extracts the primary family name from a CSS font-family stack. */
export function primaryFontFamily(stack: string): string {
  const first = stack.split(",")[0]?.trim() ?? "";
  return first.replace(/^['"]|['"]$/g, "");
}

/** Font stacks actually used by a scene: text annotations plus the watermark
 * (which always renders in Inter). */
export function collectFontStacks(scene: EditorScene): string[] {
  const stacks: string[] = [];
  for (const a of scene.annotations) {
    if (a.type === "text" && a.fontFamily) stacks.push(a.fontFamily);
  }
  if (scene.watermarkEnabled && scene.watermarkText) {
    stacks.push("Inter, system-ui, sans-serif");
  }
  return stacks;
}

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Fetches a bundled font file and re-encodes it as a data: URL. Returns null
 * when the asset can't be fetched, so exports still succeed without fonts. */
export async function fontAssetToDataUrl(asset: string): Promise<string | null> {
  try {
    const res = await fetch(asset);
    if (!res.ok) return null;
    return `data:font/woff2;base64,${bytesToBase64(await res.arrayBuffer())}`;
  } catch {
    return null;
  }
}

/**
 * Builds the `@font-face` CSS block that embeds every bundled font referenced
 * by the given stacks. Each used family contributes one rule per subset with
 * its font file inlined as a data: URL, making the export self-contained.
 */
export async function buildEmbeddedFontCss(stacks: string[]): Promise<string> {
  const wanted = new Set<string>();
  for (const stack of stacks) {
    const family = primaryFontFamily(stack);
    if (EMBEDDED_FONTS.some((f) => f.family === family)) wanted.add(family);
  }

  const blocks: string[] = [];
  for (const spec of EMBEDDED_FONTS) {
    if (!wanted.has(spec.family)) continue;
    for (const [subset, asset] of Object.entries(spec.subsets)) {
      const href = await fontAssetToDataUrl(asset);
      if (!href) continue;
      const range = UNICODE_RANGES[subset];
      blocks.push(
        `@font-face { font-family: "${spec.family}"; font-style: normal; font-weight: ${spec.weight}; font-display: swap; src: url(${href}) format("woff2");${range ? ` unicode-range: ${range};` : ""} }`
      );
    }
  }
  return blocks.join("\n");
}
