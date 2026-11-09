// The app's side of AI food search: the typed description goes to the
// Only Macros Worker, which checks the subscription and asks Claude. Nothing
// but the description and RevenueCat's anonymous id leaves the phone.

import { AI_SEARCH_URL } from '../links';
import { appUserId } from './purchases';

export type AiReport = {
  food_name: string;
  serving_size: string;
  servings: number;
  per_serving: { carbs_g: number; protein_g: number; fat_g: number; calories: number };
  basis: 'product_label' | 'similar_products' | 'general_knowledge';
  explanation: string;
  sources: { title: string; url: string }[];
};

export type AiSearchResult =
  | { ok: true; report: AiReport; used: number; limit: number }
  | { ok: false; reason: 'not_subscribed' | 'limit' | 'no_result' | 'offline' | 'unavailable'; message: string };

/** Searches read the web, so they can take a while; past this, give up. */
const TIMEOUT_MS = 90_000;

export const aiSearchAvailable = () => !!AI_SEARCH_URL;

const round1 = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0);

export async function aiSearch(query: string): Promise<AiSearchResult> {
  if (!AI_SEARCH_URL) {
    return { ok: false, reason: 'unavailable', message: 'AI search isn’t set up in this build yet.' };
  }
  const id = await appUserId();
  if (!id) {
    return { ok: false, reason: 'not_subscribed', message: 'AI search is part of Premium.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(AI_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-User-Id': id },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
  } catch {
    return {
      ok: false,
      reason: 'offline',
      message: 'Couldn’t reach AI search. Check your connection and try again.',
    };
  } finally {
    clearTimeout(timer);
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // Handled by status below.
  }

  if (res.ok && body?.result) {
    const r = body.result as AiReport;
    // The server's numbers, made safe for the form: never negative, never NaN,
    // to the tenth of a gram the log keeps.
    const report: AiReport = {
      ...r,
      servings: round1(r.servings) || 1,
      per_serving: {
        carbs_g: round1(r.per_serving?.carbs_g),
        protein_g: round1(r.per_serving?.protein_g),
        fat_g: round1(r.per_serving?.fat_g),
        calories: round1(r.per_serving?.calories),
      },
      sources: Array.isArray(r.sources) ? r.sources.filter((s) => /^https?:\/\//.test(s?.url ?? '')) : [],
    };
    return { ok: true, report, used: body.used, limit: body.limit };
  }

  switch (body?.error) {
    case 'not_subscribed':
      return { ok: false, reason: 'not_subscribed', message: 'AI search is part of Premium.' };
    case 'limit':
      return {
        ok: false,
        reason: 'limit',
        message: `You’ve used all ${body.limit} AI searches this month. They reset on the 1st.`,
      };
    case 'no_result':
      return {
        ok: false,
        reason: 'no_result',
        message: 'Couldn’t work that one out. Try naming the brand or the amount, or describe it differently.',
      };
    default:
      return { ok: false, reason: 'unavailable', message: 'AI search is having trouble right now. Try again in a moment.' };
  }
}
