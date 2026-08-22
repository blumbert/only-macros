// Generates the app icons for Macros. Pure Node (zlib only) — no native deps.
// Three pills in the app's carb/protein/fat colours on the app's dark ground.
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node make-icons.js <assets-dir>');

// ---------- PNG encoding ----------
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// dropAlpha emits colour type 2 (RGB). The iOS app icon must have no alpha
// channel at all — App Store Connect rejects the upload otherwise.
function encodePng(width, height, rgba, dropAlpha = false) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const channels = dropAlpha ? 3 : 4;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = dropAlpha ? 2 : 6; // RGB : RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (stride + 1) + 1 + x * channels;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      if (!dropAlpha) raw[dst + 3] = rgba[src + 3];
    }
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- drawing ----------
const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Signed distance to a rounded rect; negative inside. Gives us free antialiasing.
function sdRoundRect(px, py, cx, cy, hx, hy, r) {
  const qx = Math.abs(px - cx) - hx + r;
  const qy = Math.abs(py - cy) - hy + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return Math.min(Math.max(qx, qy), 0) + outside - r;
}

const BARS = [
  { color: '#FFB020', height: 0.274 }, // carbs
  { color: '#5B9BFF', height: 0.430 }, // protein
  { color: '#B98BFF', height: 0.352 }, // fat
];

/**
 * @param size    output edge length in px
 * @param opts.background  'gradient' | 'solid' | 'none'
 * @param opts.mono        draw every bar white (Android monochrome icon)
 * @param opts.scale       bar block size relative to the canvas
 */
function render(size, opts = {}) {
  const { background = 'gradient', mono = false, scale = 1 } = opts;
  const buf = Buffer.alloc(size * size * 4);

  const topRGB = hex('#12151C');
  const botRGB = hex('#08090C');
  const flatRGB = hex('#0A0B0E');

  // Bar geometry, expressed as fractions of the canvas so every size matches.
  const barW = 0.1484 * scale;
  const gap = 0.0664 * scale;
  const blockW = BARS.length * barW + (BARS.length - 1) * gap;
  const left = 0.5 - blockW / 2;
  const baseline = 0.5 + 0.215 * scale;

  for (let y = 0; y < size; y++) {
    const fy = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const fx = (x + 0.5) / size;
      const i = (y * size + x) * 4;

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      if (background === 'gradient') {
        const t = fy;
        r = topRGB[0] + (botRGB[0] - topRGB[0]) * t;
        g = topRGB[1] + (botRGB[1] - topRGB[1]) * t;
        b = topRGB[2] + (botRGB[2] - topRGB[2]) * t;
        a = 255;
      } else if (background === 'solid') {
        [r, g, b] = flatRGB;
        a = 255;
      }

      for (let k = 0; k < BARS.length; k++) {
        const bar = BARS[k];
        const h = bar.height * scale;
        const cx = left + barW * (k + 0.5) + gap * k;
        const cy = baseline - h / 2;
        const d = sdRoundRect(fx, fy, cx, cy, barW / 2, h / 2, barW / 2);
        const cov = clamp01(0.5 - d * size); // ~1px feather
        if (cov <= 0) continue;
        const [br, bg, bb] = mono ? [255, 255, 255] : hex(bar.color);
        // source-over
        const outA = cov + (a / 255) * (1 - cov);
        r = (br * cov + r * (a / 255) * (1 - cov)) / outA;
        g = (bg * cov + g * (a / 255) * (1 - cov)) / outA;
        b = (bb * cov + b * (a / 255) * (1 - cov)) / outA;
        a = outA * 255;
      }

      buf[i] = Math.round(clamp01(r / 255) * 255);
      buf[i + 1] = Math.round(clamp01(g / 255) * 255);
      buf[i + 2] = Math.round(clamp01(b / 255) * 255);
      buf[i + 3] = Math.round(Math.min(a, 255));
    }
  }
  return encodePng(size, size, buf, opts.dropAlpha === true);
}

const write = (name, buf) => {
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(name, (buf.length / 1024).toFixed(1) + 'KB');
};

// iOS app icon: fully opaque, square, no rounded corners (Apple masks it).
write('icon.png', render(1024, { background: 'gradient', dropAlpha: true }));
// Splash: bars only, small, on the transparent ground Expo tints for us.
write('splash-icon.png', render(1024, { background: 'none', scale: 0.62 }));
// Android adaptive icon: foreground must sit inside the 66% safe circle.
write('android-icon-foreground.png', render(512, { background: 'none', scale: 0.58 }));
write('android-icon-background.png', render(512, { background: 'solid', scale: 0 }));
write('android-icon-monochrome.png', render(432, { background: 'none', mono: true, scale: 0.58 }));
write('favicon.png', render(48, { background: 'gradient' }));
