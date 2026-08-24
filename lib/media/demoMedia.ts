// A self-contained demo image (gradient + label) encoded as an SVG data URI,
// so the editor opens with example content instead of an empty canvas and
// works fully offline without bundling a binary asset.
const DEMO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d4ed8"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <circle cx="940" cy="180" r="220" fill="rgba(255,255,255,0.12)"/>
  <circle cx="260" cy="540" r="160" fill="rgba(255,255,255,0.10)"/>
  <text x="60" y="620" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="700" fill="rgba(255,255,255,0.92)">Mocksy demo</text>
</svg>`;

export const DEMO_MEDIA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DEMO_SVG.trim())}`;
export const DEMO_MEDIA_NAME = "mocksy-demo.svg";
