// Compares two PNGs with a pixel-difference tolerance, for the OG image
// freshness job. Byte-exact `git diff` fails on font-rasterization noise
// between macOS minor versions; a real stale render differs by an order of
// magnitude more pixels (e.g. 0.5% vs <0.1% noise).
//
// Usage: node scripts/check-og.mjs <baseline.png> <candidate.png> [maxRatio]
// Exits 0 when diffRatio <= maxRatio (default 0.002), 1 otherwise.
// Zero dependencies: minimal PNG decoder (8-bit non-interlaced RGB/RGBA,
// which is what Chromium screenshots produce).
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function decodePng(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error(`${file}: not a PNG file`);
  }
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`${file}: unsupported PNG (depth=${bitDepth}, color=${colorType}, interlace=${interlace})`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y === 0 ? Buffer.alloc(stride) : pixels.subarray((y - 1) * stride, y * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let recon;
      switch (filter) {
        case 0: recon = raw[p]; break;
        case 1: recon = raw[p] + a; break;
        case 2: recon = raw[p] + b; break;
        case 3: recon = raw[p] + ((a + b) >> 1); break;
        case 4: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          recon = raw[p] + pr;
          break;
        }
        default: throw new Error(`${file}: unknown filter ${filter} at row ${y}`);
      }
      row[x] = recon & 0xff;
      p++;
    }
  }
  return { width, height, channels, pixels };
}

const [baselinePath, candidatePath, maxRatioArg] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
  console.error("Usage: node scripts/check-og.mjs <baseline.png> <candidate.png> [maxRatio]");
  process.exit(2);
}
const maxRatio = maxRatioArg === undefined ? 0.002 : Number(maxRatioArg);

const a = decodePng(baselinePath);
const b = decodePng(candidatePath);
if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) {
  console.error(`Size/format mismatch: ${a.width}x${a.height}x${a.channels} vs ${b.width}x${b.height}x${b.channels}`);
  process.exit(1);
}
let diffPixels = 0;
const ch = a.channels;
for (let i = 0; i < a.pixels.length; i += ch) {
  for (let c = 0; c < ch; c++) {
    if (a.pixels[i + c] !== b.pixels[i + c]) {
      diffPixels++;
      break;
    }
  }
}
const total = a.width * a.height;
const ratio = diffPixels / total;
console.log(`diff: ${diffPixels}/${total} px (${(ratio * 100).toFixed(4)}%), allowed ${(maxRatio * 100).toFixed(2)}%`);
process.exit(ratio <= maxRatio ? 0 : 1);
