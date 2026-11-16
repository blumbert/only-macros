#!/usr/bin/env node
/**
 * Publish an over-the-air update to our own update server (server/updates).
 *
 *   npm run update:preview      export the app, send it to phones on the test channel
 *   npm run update:promote      give everyone exactly what's on the test channel
 *   npm run update:production   export the app and send it straight to everyone
 *
 * Add --no-deploy to write the files without deploying the Worker.
 *
 * An update reaches only builds with the same runtime version, which follows
 * app.json's "version" (the appVersion policy). Anything native (a new package,
 * permission or plugin) still needs a new build with a new version number.
 *
 * The manifest is signed here with .keys/private-key.pem; the app refuses any
 * update not signed by it. Keep a backup of that key: without it, no further
 * updates can be published until a new build ships with a new certificate.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'updates');
const PUBLIC = path.join(SERVER, 'public');
const BASE_URL = 'https://only-macros-updates.williamjaylumbert.workers.dev';
const KEY = process.env.UPDATES_PRIVATE_KEY || path.join(ROOT, '.keys', 'private-key.pem');

const CONTENT_TYPES = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  json: 'application/json',
};

const args = process.argv.slice(2);
const mode = args[0];
const deploy = !args.includes('--no-deploy');
if (!['preview', 'production', 'promote'].includes(mode)) {
  console.error('Usage: node scripts/publish-update.cjs preview|production|promote [--no-deploy]');
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, cmdArgs, cwd = ROOT) =>
  execFileSync(cmd, cmdArgs, { cwd, stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' }).toString();

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const runtimeVersion = appJson.expo.version;
const manifestPath = (channel) => path.join(PUBLIC, 'm', channel, `${runtimeVersion}.json`);

const sha256url = (buf) => crypto.createHash('sha256').update(buf).digest('base64url');
const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

/** Copy one exported file to public/u/ and describe it for the manifest. */
function storeAsset(file, ext, contentType) {
  const buf = fs.readFileSync(file);
  const hash = sha256url(buf);
  const name = `${hash}.${ext}`;
  fs.mkdirSync(path.join(PUBLIC, 'u'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, 'u', name), buf);
  return { hash, key: md5(buf), contentType, url: `${BASE_URL}/u/${name}` };
}

function exportUpdate() {
  if (!fs.existsSync(KEY)) throw new Error(`No signing key at ${KEY}`);
  const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'only-macros-update-'));
  console.log(`Exporting the app for iOS (runtime ${runtimeVersion})…`);
  run(npx, ['expo', 'export', '--platform', 'ios', '--output-dir', out]);
  const meta = JSON.parse(fs.readFileSync(path.join(out, 'metadata.json'), 'utf8')).fileMetadata.ios;
  const local = (p) => path.join(out, ...p.split(/[\\/]/));

  const launchAsset = storeAsset(local(meta.bundle), 'js', 'application/javascript');
  const assets = meta.assets.map((a) => {
    const ext = a.ext.toLowerCase();
    return {
      ...storeAsset(local(a.path), ext, CONTENT_TYPES[ext] || 'application/octet-stream'),
      // The app looks assets up by the name Metro gave them, which is their MD5.
      key: path.basename(a.path.split(/[\\/]/).join('/')),
      fileExtension: `.${ext}`,
    };
  });
  const expoClient = JSON.parse(run(npx, ['expo', 'config', '--type', 'public', '--json']));
  fs.rmSync(out, { recursive: true, force: true });

  const manifest = JSON.stringify({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    runtimeVersion,
    launchAsset,
    assets,
    metadata: {},
    extra: { expoClient },
  });
  const signature = crypto.createSign('RSA-SHA256').update(manifest, 'utf8').sign(fs.readFileSync(KEY), 'base64');
  return { manifest, signature };
}

/** Delete stored files no published manifest points at any more. */
function prune() {
  const used = new Set();
  const mDir = path.join(PUBLIC, 'm');
  for (const channel of fs.existsSync(mDir) ? fs.readdirSync(mDir) : []) {
    for (const f of fs.readdirSync(path.join(mDir, channel))) {
      const m = JSON.parse(JSON.parse(fs.readFileSync(path.join(mDir, channel, f), 'utf8')).manifest);
      for (const a of [m.launchAsset, ...m.assets]) used.add(path.basename(new URL(a.url).pathname));
    }
  }
  const uDir = path.join(PUBLIC, 'u');
  for (const f of fs.existsSync(uDir) ? fs.readdirSync(uDir) : []) {
    if (!used.has(f)) fs.rmSync(path.join(uDir, f));
  }
}

let published;
if (mode === 'promote') {
  const from = manifestPath('preview');
  if (!fs.existsSync(from)) throw new Error(`Nothing on the test channel for ${runtimeVersion}`);
  published = JSON.parse(fs.readFileSync(from, 'utf8'));
  writeJson(manifestPath('production'), published);
} else {
  published = exportUpdate();
  writeJson(manifestPath(mode), published);
}
prune();

const { id } = JSON.parse(published.manifest);
const channel = mode === 'promote' ? 'production' : mode;
console.log(`Update ${id.slice(0, 8)} written for ${channel}, runtime ${runtimeVersion}.`);

if (deploy) {
  console.log('Deploying the update server…');
  execFileSync(npx, ['wrangler', 'deploy'], { cwd: SERVER, stdio: 'inherit', shell: process.platform === 'win32' });
  console.log(`Live: phones on ${channel} running ${runtimeVersion} get ${id.slice(0, 8)} next time the app opens.`);
}
