// Generates the App Store screenshots: the app's real screens, rendered from
// its web build at iPhone size with seeded data, framed in a phone and
// captioned. Output is opaque PNG (App Store Connect rejects alpha) at the
// 6.9" (1290x2796) and 6.5" (1284x2778) sizes.
//
// The tooling stays out of the app's own dependencies:
//   npm i --prefix <dir> puppeteer-core sharp
//   npx expo start --web --port 8082          (in another terminal)
//   SHOT_DEPS=<dir> node scripts/make-screenshots.cjs [outDir]
// Uses Microsoft Edge (SHOT_BROWSER to point at another Chromium).
//
// The web build has no Vision module, so the label scan is fed a real label's
// text through `globalThis.ExpoDomWebView`, the hook expo-modules-core's web
// build reads native modules from. Everything after that is the app's own
// code path: picker, parser, form.

const fs = require('fs');
const path = require('path');

const DEPS = process.env.SHOT_DEPS;
const load = (m) => require(require.resolve(m, DEPS ? { paths: [DEPS] } : undefined));
const puppeteer = load('puppeteer-core');
const sharp = load('sharp');

const APP_URL = process.env.SHOT_URL || 'http://localhost:8082';
const BROWSER =
  process.env.SHOT_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.resolve(process.argv[2] || 'store-screenshots');

const SIZES = [
  { name: '6.9in', width: 1290, height: 2796 },
  { name: '6.5in', width: 1284, height: 2778 },
];

// An iPhone's logical width; the status bar is drawn by the frame above it.
const PHONE = { width: 393, height: 852, statusBar: 54 };

// Accent colours are the app's own macro colours (dark theme).
const ACCENT = { c: '#FFB020', p: '#5B9BFF', f: '#B98BFF' };

const SHOTS = [
  {
    file: '1-log',
    accent: ACCENT.c,
    title: 'Track macros in <em>seconds</em>',
    sub: 'Type carbs, protein and fat, or pick a saved food. No ads, no account.',
  },
  {
    file: '2-scan',
    accent: ACCENT.p,
    title: 'Snap a label. <em>Done.</em>',
    sub: 'Servings are multiplied for you, and the label is read right on your phone.',
  },
  {
    file: '3-foods',
    accent: ACCENT.f,
    title: 'Your usual foods, <em>two taps</em> away',
    sub: 'Save them once. Then pick one, set the servings, add.',
  },
  {
    file: '4-calendar',
    accent: ACCENT.c,
    title: 'Every day <em>at a glance</em>',
    sub: 'Macros and calories for the whole month. Missed a day? Fix it later.',
  },
  {
    file: '5-runner',
    accent: ACCENT.p,
    title: 'Fuel the <em>miles</em> you run',
    sub: 'Daily targets that move with your training, from sports-nutrition research.',
  },
];

// The FDA's sample label, as Vision returns it (see parseLabel's tests).
const LABEL_LINES = [
  'Nutrition Facts', '8 servings per container', 'Serving size', '2/3 cup (55g)',
  'Amount per serving', 'Calories', '230', '% Daily Value*', 'Total Fat 8g', '10%',
  'Saturated Fat 1g', '5%', 'Trans Fat 0g', 'Cholesterol 0mg', '0%', 'Sodium 160mg', '7%',
  'Total Carbohydrate 37g', '13%', 'Dietary Fiber 4g', '14%', 'Total Sugars 12g',
  'Includes 10g Added Sugars', '20%', 'Protein 3g',
].map((text) => ({ text }));

/** Runs in the page before the app: the stand-in Vision module and tap helpers. */
function beforeApp(lines) {
  globalThis.ExpoDomWebView = {
    expoModulesProxy: { LabelText: { recognize: async () => lines } },
  };
  window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__set = (label, value) => {
    const el = [...document.querySelectorAll(`[aria-label="${label}"]`)].pop();
    if (!el) throw new Error('no field ' + label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  // Icons are font glyphs in the private-use range, so a button's text is
  // compared with them stripped out.
  const label = (e) => e.textContent.replace(/[-]/g, '').trim();
  // The last match, not the first: an open sheet is appended after the main
  // screen, and the main screen's own controls stay mounted underneath it.
  window.__find = (sel) =>
    (/^[\[.#]/.test(sel) && [...document.querySelectorAll(sel)].pop()) ||
    [...document.querySelectorAll('[role=button],[role=menuitem]')]
      .filter((e) => label(e) === sel)
      .pop();
  window.__press = (sel) => {
    const b = typeof sel === 'string' ? window.__find(sel) : sel;
    if (!b) throw new Error('nothing to press: ' + sel);
    const r = b.getBoundingClientRect();
    const o = { bubbles: true, clientX: r.x + 5, clientY: r.y + 5, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
    b.dispatchEvent(new PointerEvent('pointerdown', o));
    b.dispatchEvent(new MouseEvent('mousedown', o));
    b.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
    b.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 }));
    b.click();
  };
  window.__menu = async (label) => {
    window.__press('[aria-label="Menu"]');
    await window.__wait(400);
    const item = [...document.querySelectorAll('[role=menuitem]')].find((e) => e.textContent.includes(label));
    window.__press(item);
    await window.__wait(900);
  };
}

/** Runs in the page: a believable few weeks of use, all relative to today. */
function seed() {
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = today.getTime();
  const h = 3600e3;

  let s = 11;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const log = {};
  for (let back = 1; back <= 45; back++) {
    if (back % 9 === 4) continue; // the odd day off
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    log[key(d)] = [{
      id: `seed-${back}`,
      at: d.getTime() + 12 * h,
      c: Math.round(230 + rnd() * 130),
      p: Math.round(130 + rnd() * 45),
      f: Math.round(55 + rnd() * 30),
    }];
  }
  log[key(today)] = [
    { id: 't1', at: t + 7.5 * h, c: 54, p: 12, f: 6, name: 'Oatmeal ×1.5' },
    { id: 't2', at: t + 9 * h, c: 9, p: 20, f: 4, name: 'Greek yogurt' },
    { id: 't3', at: t + 12.75 * h, c: 62, p: 48, f: 14 },
    { id: 't4', at: t + 15.25 * h, c: 44, p: 10, f: 5.5, name: 'Granola bar' },
  ];

  const foods = [
    { id: 'f1', name: 'Greek yogurt', c: 9, p: 20, f: 4, serving: '1 cup (227g)', usedAt: t + 9 * h },
    { id: 'f2', name: 'Oatmeal', c: 36, p: 8, f: 4, serving: '1/2 cup dry (40g)', usedAt: t + 7.5 * h },
    { id: 'f3', name: 'Granola bar', c: 44, p: 10, f: 5.5, serving: '1 bar (68g)', usedAt: t + 15.25 * h },
    { id: 'f4', name: 'Chicken breast', c: 0, p: 31, f: 3.6, serving: '100g cooked' },
    { id: 'f5', name: 'Jasmine rice', c: 45, p: 4, f: 0.5, serving: '1 cup cooked' },
    { id: 'f6', name: 'Whey protein shake', c: 3, p: 24, f: 1.5, serving: '1 scoop (30g)' },
    { id: 'f7', name: 'Banana', c: 27, p: 1.3, f: 0.4, serving: '1 medium' },
    { id: 'f8', name: 'Peanut butter', c: 7, p: 7, f: 16, serving: '2 tbsp (32g)' },
  ];

  const sunday = new Date(today);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  const lastSunday = new Date(sunday);
  lastSunday.setDate(lastSunday.getDate() - 7);
  const week = {
    km: 32 * 1.609344,
    longRunKm: 12 * 1.609344,
    days: ['rest', 'easy', 'workout', 'easy', 'workout', 'rest', 'long'],
  };
  const runner = {
    // On their feet all day: a desk job at maintenance lands just under the
    // "adequate" energy availability line and shows a warning.
    profile: { sex: 'male', age: 32, weightKg: 72, lifestyle: 'onFeet', goal: 'maintain', bone: 'none', boneLongLayoff: false, cycle: 'notApplicable' },
    units: 'imperial',
    weeks: { [key(lastSunday)]: week, [key(sunday)]: week },
    dayKm: {},
  };

  localStorage.setItem('macrotracker.log.v1', JSON.stringify(log));
  localStorage.setItem('macrotracker.foods.v1', JSON.stringify(foods));
  localStorage.setItem('macrotracker.runner.v1', JSON.stringify(runner));
}

/**
 * Runs in the page: swap the web build's fallback system font for Inter, the
 * closest freely available match to iOS's San Francisco. Icon glyphs keep
 * their own font.
 */
async function iosFont() {
  if (!document.getElementById('inter')) {
    const link = document.createElement('link');
    link.id = 'inter';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400..900&display=block';
    document.head.appendChild(link);
    await new Promise((r) => (link.onload = r));
  }
  for (const el of document.querySelectorAll('div, span, input')) {
    if (!/ionicons/i.test(getComputedStyle(el).fontFamily)) el.style.fontFamily = 'Inter, sans-serif';
  }
  await document.fonts.ready;
}

async function captureApp(page, step) {
  await page.evaluate(step);
  await page.evaluate(iosFont);
  // A sheet focuses its first button on open, and the browser draws a focus
  // ring an iPhone never would.
  await page.evaluate(() => document.activeElement?.blur());
  await new Promise((r) => setTimeout(r, 400));
  return page.screenshot({ type: 'png' });
}

const STATUS_ICONS = `
  <svg width="18" height="12" viewBox="0 0 18 12"><g fill="#fff">
    <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/>
    <rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></g></svg>
  <svg width="16" height="12" viewBox="0 0 16 12"><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">
    <path d="M1.5 4.2a9.5 9.5 0 0 1 13 0"/><path d="M4.2 7a5.6 5.6 0 0 1 7.6 0"/></g>
    <circle cx="8" cy="10.2" r="1.6" fill="#fff"/></svg>
  <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="#fff" stroke-opacity="0.45"/>
    <rect x="2.5" y="2.5" width="19" height="8" rx="2" fill="#fff"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="#fff" fill-opacity="0.45"/></svg>`;

function frameHtml(shot, screenPng, size) {
  const w = size.width / 3;
  const h = size.height / 3;
  const phoneW = 316;
  const bezel = 9;
  const screenW = phoneW - bezel * 2;
  const scale = screenW / PHONE.width;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..900&display=block">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body {
    font-family: Inter, sans-serif; color: #F3F5F9;
    background:
      radial-gradient(120% 60% at 50% 100%, ${shot.accent}33 0%, transparent 60%),
      radial-gradient(90% 50% at 0% 0%, #5B9BFF1f 0%, transparent 70%),
      linear-gradient(180deg, #0E1016 0%, #0A0B0E 100%);
    display: flex; flex-direction: column; align-items: center;
  }
  .caption { padding: 46px 30px 0; text-align: center; }
  h1 { font-size: 33px; line-height: 1.12; font-weight: 800; letter-spacing: -0.9px; }
  h1 em { font-style: normal; color: ${shot.accent}; }
  p { margin-top: 12px; font-size: 16.5px; line-height: 1.4; font-weight: 500; color: #A9B0BE; }
  .phone {
    margin-top: 30px; width: ${phoneW}px; padding: ${bezel}px;
    border-radius: 54px; background: #1E222B;
    box-shadow: 0 0 0 1.5px #343947, 0 30px 70px rgba(0,0,0,0.6);
  }
  .screen { position: relative; border-radius: 45px; overflow: hidden; background: #0A0B0E; }
  .status { height: ${PHONE.statusBar * scale}px; display: flex; align-items: center; justify-content: space-between; padding: 0 ${26 * scale}px 0 ${36 * scale}px; }
  .time { font-size: ${17 * scale}px; font-weight: 600; letter-spacing: -0.2px; }
  .icons { display: flex; gap: ${6 * scale}px; align-items: center; transform: scale(${scale}); transform-origin: right center; }
  .island { position: absolute; top: ${11 * scale}px; left: 50%; transform: translateX(-50%); width: ${124 * scale}px; height: ${36 * scale}px; border-radius: 99px; background: #000; }
  .app { display: block; width: 100%; }
</style></head><body>
  <div class="caption"><h1>${shot.title}</h1><p>${shot.sub}</p></div>
  <div class="phone"><div class="screen">
    <div class="status"><span class="time">9:41</span><span class="icons">${STATUS_ICONS}</span></div>
    <div class="island"></div>
    <img class="app" src="data:image/png;base64,${screenPng.toString('base64')}">
  </div></div>
</body></html>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: true });
  try {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await page.setViewport({
      width: PHONE.width,
      height: PHONE.height - PHONE.statusBar,
      deviceScaleFactor: 3,
    });
    await page.evaluateOnNewDocument(beforeApp, LABEL_LINES);
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[aria-label="Menu"]');
    await new Promise((r) => setTimeout(r, 800));

    // Any image will do for the picker; the stand-in module supplies the text.
    const photo = path.join(OUT, '.label.png');
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).png().toFile(photo);

    const screens = {};

    screens['1-log'] = await captureApp(page, async () => {
      __press('[aria-label="Pick a saved food"]');
      await __wait(700);
      __press('[aria-label="Pick Greek yogurt"]');
      await __wait(600);
      __press('[aria-label="One more serving"]');
      await __wait(300);
    });

    await page.evaluate(() => __menu('Scan a label'));
    const [chooser] = await Promise.all([
      page.waitForFileChooser(),
      page.evaluate(() => __press('Choose photo')),
    ]);
    await chooser.accept([photo]);
    await page.waitForFunction(
      () => document.querySelector('[aria-label="Per serving Carbs in grams"]')?.value === '37',
    );
    await page.evaluate(() => __wait(300));
    screens['2-scan'] = await captureApp(page, async () => {
      __press('[aria-label="One more serving"]');
      await __wait(200);
      __press('[aria-label="One more serving"]');
      await __wait(200);
      __set('Food name', 'Granola');
      document.querySelector('input[role=switch][aria-label="Save to my foods"]').click();
      await __wait(400);
    });

    await page.evaluate(async () => { __press('Done'); await __wait(700); });
    screens['3-foods'] = await captureApp(page, () => __menu('Saved foods'));

    await page.evaluate(async () => { __press('Done'); await __wait(700); });
    screens['4-calendar'] = await captureApp(page, () => __menu('Calendar'));

    await page.evaluate(async () => { __press('Done'); await __wait(700); });
    screens['5-runner'] = await captureApp(page, () => __menu('Runner fueling'));

    fs.rmSync(photo);

    const framer = await browser.newPage();
    for (const size of SIZES) {
      const dir = path.join(OUT, size.name);
      fs.mkdirSync(dir, { recursive: true });
      await framer.setViewport({ width: size.width / 3, height: size.height / 3, deviceScaleFactor: 3 });
      for (const shot of SHOTS) {
        await framer.setContent(frameHtml(shot, screens[shot.file], size), {
          waitUntil: 'load',
          timeout: 60000,
        });
        await framer.evaluate(() => document.fonts.ready);
        const png = await framer.screenshot({ type: 'png' });
        const file = path.join(dir, `${shot.file}.png`);
        // Flattened and alpha-free: App Store Connect rejects screenshots with an alpha channel.
        await sharp(png).flatten({ background: '#0A0B0E' }).removeAlpha().png().toFile(file);
        const meta = await sharp(file).metadata();
        console.log(`${path.relative(process.cwd(), file)}  ${meta.width}x${meta.height}  channels=${meta.channels}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
