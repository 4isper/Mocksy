/**
 * Small string helpers shared by the HTML and SVG exporters so the two
 * generators produce identically-escaped, identically-rounded markup and
 * can't drift apart (a past pain point when the two copies diverged).
 */

/** Rounds to 2 decimals so generated markup stays compact but accurate. */
export function round2(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Escapes text for safe inlining inside markup (tags, attributes, CDATA). */
export function escapeMarkup(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Escapes a value for safe use inside an XML/SVG attribute (double-quoted). */
export function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
