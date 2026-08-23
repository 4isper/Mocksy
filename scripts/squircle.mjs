import fs from "fs";

// Superellipse corner exponent power = 2/n (n=4 → Apple-ish squircle).
const P = 0.5;
const STEPS = 24;

function parseAttrs(tag) {
  const attrs = {};
  const re = /([a-zA-Z:_-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tag))) attrs[m[1]] = m[2];
  return attrs;
}

// Continuous-curvature rounded-rect path. Corners are true superellipse arcs
// measured FROM THE ARC CENTER toward the sharp corner, tangent-continuous
// with the straight edges at both ends of every corner.
function squirclePath(x, y, w, h, r) {
  const pt = (px, py) => `L ${px.toFixed(2)} ${py.toFixed(2)} `;
  // Corner from angle thStart→thEnd around center c; dir (+1/-1) points toward
  // the sharp corner on each axis.
  const corner = (cx, cy, sx, sy, reverse) => {
    let s = "";
    for (let i = 1; i <= STEPS; i++) {
      const k = reverse ? STEPS - i : i;
      const th = (k / STEPS) * (Math.PI / 2);
      s += pt(cx + sx * r * Math.pow(Math.cos(th), P), cy + sy * r * Math.pow(Math.sin(th), P));
    }
    return s;
  };
  let d = `M ${(x + r).toFixed(2)} ${y.toFixed(2)} `;
  d += `L ${(x + w - r).toFixed(2)} ${y.toFixed(2)} `;
  d += corner(x + w - r, y + r, +1, -1, true);  // top-right: θ 90°→0°
  d += `L ${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} `;
  d += corner(x + w - r, y + h - r, +1, +1, false); // bottom-right: θ 0°→90°
  d += `L ${(x + r).toFixed(2)} ${(y + h).toFixed(2)} `;
  d += corner(x + r, y + h - r, -1, +1, true); // bottom-left: θ 90°→0°
  d += `L ${x.toFixed(2)} ${(y + h - r).toFixed(2)} `;
  d += corner(x + r, y + r, -1, -1, false); // top-left: θ 0°→90°
  d += "Z";
  return d;
}

function rectToPath(tag, radiusScale) {
  const a = parseAttrs(tag);
  const r = +a.rx * radiusScale;
  if (!(r > 0)) return tag;
  const x = +a.x;
  const y = +a.y;
  const w = +a.width;
  const h = +a.height;
  const d = squirclePath(x, y, w, h, r);
  let out = `<path d="${d}"`;
  for (const k of Object.keys(a)) {
    if (k === "x" || k === "y" || k === "width" || k === "height" || k === "rx" || k === "ry") continue;
    out += ` ${k}="${a[k]}"`;
  }
  out += "/>";
  return out;
}

const files = [
  "public/devices/iphone.svg",
  "public/devices/iphone15.svg",
  "public/devices/iphone16pro.svg",
  "public/devices/ipad.svg",
  "public/devices/watch.svg",
  "public/devices/watchUltra.svg",
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  // Mask hole (transparent cutout) and rim: reduced radius (media-clip-safe)
  s = s.replace(/<rect\b[^>]*\bfill="black"[^>]*\/>/g, (t) => rectToPath(t, 1));
  s = s.replace(/<rect\b[^>]*\bstroke="url\(#edgeHi\)"[^>]*\/>/g, (t) => rectToPath(t, 1));
  // Body / case / decorative masked rings: full original radius
  s = s.replace(/<rect\b[^>]*\bmask="url\([^)]*\)"[^>]*\/>/g, (t) => rectToPath(t, 1));
  fs.writeFileSync(f, s);
  console.log("squircle:", f);
}
