// Only Macros AI food search: a Cloudflare Worker between the app and Claude.
//
// The app can't call Claude itself — the API key would ship inside it, and
// anyone could pull it out. So the app sends the typed description here; this
// checks the caller is a Premium subscriber (RevenueCat), holds them to a
// monthly search cap, and asks Claude (Haiku 5.5 with web search) to estimate
// the macros, returning one structured report.
//
// Nothing is stored except a per-subscriber monthly count and a short-lived
// entitlement cache, both keyed by RevenueCat's anonymous app user id. The
// search text itself is not logged or kept here.

import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  ANTHROPIC_API_KEY: string;
  REVENUECAT_SECRET_KEY: string;
  USAGE: KVNamespace;
}

// Haiku 5.5 matched Opus 5.5 on branded foods (same sources, same numbers)
// in a six-food comparison in November 2026, at about a tenth of the cost:
// roughly 1.5 cents a search against 14, so even a subscriber who uses all
// 60 searches costs about $1.50 a month.
const MODEL = 'claude-haiku-5-5';
const ENTITLEMENT = 'premium';
const MONTHLY_LIMIT = 60;
const MAX_QUERY = 200;
/** A search that keeps pausing to search again is stopped after this many rounds. */
const MAX_ROUNDS = 4;

const SYSTEM = `You estimate the carbohydrate, protein and fat in a food someone ate, for a macro-tracking app.

Find the real nutrition facts when they exist: search for the specific brand and product, and prefer the maker's own site or a retailer listing that shows the label. If you can't find that product, base the estimate on similar products and say so. Use general nutrition knowledge only for generic foods with no brand.

Work out the amount the person described: convert it into servings of the label's serving size (for example "half a quart" of ice cream is 4 servings of 1/2 cup). If no amount is given, assume one serving.

When you are done, call report_nutrition exactly once with the per-serving figures and the number of servings. Keep the explanation to one or two plain sentences: what the numbers are based on, and any assumption you made about the amount. List only sources you actually used.`;

const REPORT_TOOL: Anthropic.Beta.BetaTool = {
  name: 'report_nutrition',
  description: 'Report the macro estimate for the food described. Call exactly once, at the end.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'food_name',
      'serving_size',
      'servings',
      'per_serving',
      'basis',
      'explanation',
      'sources',
    ],
    properties: {
      food_name: { type: 'string', description: 'Short name, e.g. "Hornstra Farms Cow Tracks ice cream".' },
      serving_size: { type: 'string', description: 'One serving as the label states it, e.g. "1/2 cup (66g)".' },
      servings: { type: 'number', description: 'How many servings the described amount is.' },
      per_serving: {
        type: 'object',
        additionalProperties: false,
        required: ['carbs_g', 'protein_g', 'fat_g', 'calories'],
        properties: {
          carbs_g: { type: 'number' },
          protein_g: { type: 'number' },
          fat_g: { type: 'number' },
          calories: { type: 'number' },
        },
      },
      basis: {
        type: 'string',
        enum: ['product_label', 'similar_products', 'general_knowledge'],
        description: 'What the per-serving numbers come from.',
      },
      explanation: { type: 'string' },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'url'],
          properties: { title: { type: 'string' }, url: { type: 'string' } },
        },
      },
    },
  },
};

type Report = {
  food_name: string;
  serving_size: string;
  servings: number;
  per_serving: { carbs_g: number; protein_g: number; fat_g: number; calories: number };
  basis: 'product_label' | 'similar_products' | 'general_knowledge';
  explanation: string;
  sources: { title: string; url: string }[];
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const monthKey = (id: string) => `n:${id}:${new Date().toISOString().slice(0, 7)}`;

/** Whether this RevenueCat user has an active Premium entitlement. Cached briefly. */
async function isPremium(env: Env, appUserId: string): Promise<boolean> {
  const cacheKey = `e:${appUserId}`;
  const cached = await env.USAGE.get(cacheKey);
  if (cached !== null) return cached === '1';

  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_KEY}` } },
  );
  if (!res.ok) throw new Error(`RevenueCat ${res.status}`);
  const body = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date: string | null }> };
  };
  const ent = body.subscriber?.entitlements?.[ENTITLEMENT];
  const active = !!ent && (ent.expires_date === null || Date.parse(ent.expires_date) > Date.now());
  // Ten minutes: long enough to spare RevenueCat a call per search, short
  // enough that a fresh purchase or a lapse shows up quickly.
  await env.USAGE.put(cacheKey, active ? '1' : '0', { expirationTtl: 600 });
  return active;
}

async function estimate(env: Env, query: string): Promise<Report | null> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: query }];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      system: SYSTEM,
      tools: [
        // Haiku has the original search tool, not the 2026 one with dynamic
        // filtering; at Haiku's prices reading whole results costs little.
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
        REPORT_TOOL,
      ],
      messages,
    });

    const report = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && b.name === 'report_nutrition',
    );
    if (report) return report.input as Report;

    // A long server-side search turn can pause; send the turn back as-is and
    // let it carry on.
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    return null;
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/search') return json({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method' }, 405);

    const appUserId = request.headers.get('X-App-User-Id')?.trim();
    if (!appUserId) return json({ error: 'not_subscribed' }, 401);

    let query = '';
    try {
      const body = (await request.json()) as { query?: unknown };
      query = typeof body.query === 'string' ? body.query.trim() : '';
    } catch {
      return json({ error: 'bad_request' }, 400);
    }
    if (query.length < 2 || query.length > MAX_QUERY) return json({ error: 'bad_request' }, 400);

    try {
      if (!(await isPremium(env, appUserId))) return json({ error: 'not_subscribed' }, 403);
    } catch {
      return json({ error: 'unavailable' }, 503);
    }

    const key = monthKey(appUserId);
    const used = Number((await env.USAGE.get(key)) ?? '0');
    if (used >= MONTHLY_LIMIT) {
      return json({ error: 'limit', used, limit: MONTHLY_LIMIT }, 429);
    }

    let result: Report | null;
    try {
      result = await estimate(env, query);
    } catch {
      return json({ error: 'unavailable' }, 503);
    }
    if (!result) return json({ error: 'no_result', used, limit: MONTHLY_LIMIT }, 422);

    // Counted only once a search has actually produced an answer. Forty days
    // covers the month this belongs to with room to spare.
    await env.USAGE.put(key, String(used + 1), { expirationTtl: 40 * 24 * 3600 });
    return json({ result, used: used + 1, limit: MONTHLY_LIMIT });
  },
};
