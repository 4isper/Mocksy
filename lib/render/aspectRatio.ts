export interface AspectRatio {
  w: number;
  h: number;
}

/** Parses a "W / H" ratio string into numeric components, or null when the
 *  string is malformed or divides by zero. */
export function parseAspectRatio(ratio: string): AspectRatio | null {
  const parts = ratio.split("/").map((n) => Number(n.trim()));
  const w = parts[0];
  const h = parts[1];
  if (w === undefined || h === undefined || !Number.isFinite(w) || !Number.isFinite(h) || h === 0) return null;
  return { w, h };
}

/** Parses a "W / H" ratio string, falling back to the supplied default when the
 *  string is malformed or divides by zero. */
export function parseAspectRatioOr(ratio: string, fallback: AspectRatio = { w: 1, h: 1 }): AspectRatio {
  return parseAspectRatio(ratio) ?? fallback;
}
