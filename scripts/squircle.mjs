import fs from "fs";

const P = 0.5; // superellipse exponent power = 2/n (n=4 → Apple-ish squircle)
const STEPS = 16;

function parseAttrs(tag) {
  const attrs = {};
  const re = /([a-zA-Z:_-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tag))) attrs[m[1]] = m[2];
  return attrs;
}

// Continuous-curvature rounded-rect path (superellipse corners).
function squirclePath(x, y, w, h, r) {
  const corner = (fn) => {
    let s = "";
    for (let i = 1; i <= STEPS; i++) {
      const t = (i / STEPS) * (Math.PI / 2);
      s += fn(t);
    }
    return s;
  };
  let d = `M ${(x + r).toFixed(2)} ${y.toFixed(2)} `;
  d += `L ${(x + w - r).toFixed(2)} ${y.toFixed(2)} `;
  d += corner((t) => `L ${(x + w - r * Math.pow(Math.cos(t), P)).toFixed(2)} ${(y + r * Math.pow(Math.sin(t), P)).toFixed(2)} `);
  d += `L ${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} `;
  d += corner((t) => `L ${(x + w - r * Math.pow(Math.sin(t), P)).toFixed(2)} ${(y + h - r * Math.pow(Math.cos(t), P)).toFixed(2)} `);
  d += `L ${(x + r).toFixed(2)} ${(y + h).toFixed(2)} `;
  d += corner((t) => `L ${(x + r * Math.pow(Math.cos(t), P)).toFixed(2)} ${(y + h - r * Math.pow(Math.sin(t), P)).toFixed(2)} `);
  d += `L ${x.toFixed(2)} ${(y + h - r).toFixed(2)} `;
  d += corner((t) => `L ${(x + r * Math.pow(Math.sin(t), P)).toFixed(2)} ${(y + r * Math.pow(Math.cos(t), P)).toFixed(2)} `);
  d += "Z";
  return d;
}

function rectToPath(tag) {
  const a = parseAttrs(tag);
  const r = +a.rx;
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
  // Mask hole (transparent cutout) → squircle
  s = s.replace(/<rect\b[^>]*\bfill="black"[^>]*\/>/g, (t) => rectToPath(t));
  // Screen-edge rim → squircle
  s = s.replace(/<rect\b[^>]*\bstroke="url\(#edgeHi\)"[^>]*\/>/g, (t) => rectToPath(t));
  // Body / case (and any masked ring) → squircle
  s = s.replace(/<rect\b[^>]*\bmask="url\([^)]*\)"[^>]*\/>/g, (t) => rectToPath(t));
  fs.writeFileSync(f, s);
  console.log("squircle:", f);
}
