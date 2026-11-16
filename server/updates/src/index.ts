// Only Macros over-the-air updates: the manifest endpoint of the Expo Updates
// protocol (v1, https://docs.expo.dev/technical-specs/expo-updates-1/).
//
// scripts/publish-update.cjs (in the app) builds each update ahead of time: it
// copies the bundle and assets to public/u/ under names that are their own
// hashes, and writes public/m/<channel>/<runtimeVersion>.json holding the
// manifest text and its RSA-SHA256 signature. The private key never comes here,
// so this Worker can't sign anything; it only hands out what was signed.
//
// Requests carry no account and nothing is logged or stored.

export interface Env {
  ASSETS: Fetcher;
}

type Published = { manifest: string; signature: string };

const CHANNELS = new Set(['production', 'preview']);
const RUNTIME = /^[a-zA-Z\d][a-zA-Z\d._+()-]{0,254}$/;

const common = {
  'expo-protocol-version': '1',
  'expo-sfv-version': '0',
  'cache-control': 'private, max-age=0',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/manifest' || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }

    const h = request.headers;
    if (h.get('expo-protocol-version') !== '1') {
      return new Response('Unsupported protocol version', { status: 406 });
    }
    if (h.get('expo-platform') !== 'ios') {
      return new Response('Unsupported platform', { status: 400 });
    }
    const runtime = h.get('expo-runtime-version') ?? '';
    if (!RUNTIME.test(runtime)) {
      return new Response('Bad runtime version', { status: 400 });
    }
    const channel = h.get('expo-channel-name') ?? 'production';
    if (!CHANNELS.has(channel)) {
      return new Response('Unknown channel', { status: 400 });
    }

    const file = await env.ASSETS.fetch(
      new URL(`/m/${channel}/${encodeURIComponent(runtime)}.json`, url.origin),
    );
    // Nothing published for this app version on this channel: no update.
    if (!file.ok) return new Response(null, { status: 204, headers: common });

    const published = (await file.json()) as Published;
    const boundary = `----only-macros-${crypto.randomUUID()}`;
    const body = [
      `--${boundary}`,
      'content-disposition: form-data; name="manifest"',
      'content-type: application/json; charset=utf-8',
      `expo-signature: sig="${published.signature}", keyid="main", alg="rsa-v1_5-sha256"`,
      '',
      published.manifest,
      `--${boundary}--`,
      '',
    ].join('\r\n');

    return new Response(body, {
      headers: { ...common, 'content-type': `multipart/mixed; boundary=${boundary}` },
    });
  },
};
