// Generates the app icons for Macros. Pure Node (zlib only) — no native deps.
// Three round-topped bars in the app's carb/protein/fat colours on the app's dark ground.
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

// Signed distance to a circle; negative inside.
const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;

// Signed distance to an axis-aligned box; negative inside.
function sdBox(px, py, cx, cy, hx, hy) {
  const qx = Math.abs(px - cx) - hx;
  const qy = Math.abs(py - cy) - hy;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

// Three bars with flat bottoms and round tops. The middle one is the shortest
// and the left one a little shorter than the right, which sets this apart
// from the stock three-equal-pills macro icon. Positions are in a 0–100
// design square, centred on (50, 50).
const BAR_W = 16;
const BASELINE = 72;
const BARS = [
  { color: '#FFB020', x: 21, top: 34 }, // carbs
  { color: '#5B9BFF', x: 42, top: 42 }, // protein
  { color: '#B98BFF', x: 63, top: 28 }, // fat
];

/** Distance (in design units) from (x, y) to a bar: a box under a half-circle cap. */
function sdBar(x, y, bar) {
  const r = BAR_W / 2;
  const cx = bar.x + r;
  const capY = bar.top + r;
  const box = sdBox(x, y, cx, (capY + BASELINE) / 2, r, (BASELINE - capY) / 2);
  return Math.min(box, sdCircle(x, y, cx, capY, r));
}

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

      for (let k = 0; k < BARS.length && scale > 0; k++) {
        const bar = BARS[k];
        // Canvas point → design square, shrunk around the centre by `scale`.
        const dx = 50 + ((fx - 0.5) * 100) / scale;
        const dy = 50 + ((fy - 0.5) * 100) / scale;
        // Back to pixels: one design unit is size * scale / 100 px.
        const d = (sdBar(dx, dy, bar) * scale) / 100;
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
