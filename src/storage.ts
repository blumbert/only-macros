import AsyncStorage from '@react-native-async-storage/async-storage';

import { isDayKey, type DayKey } from './date';

/**
 * One "add". Totals are always derived from these rather than stored, so a
 * mistaken entry can be removed without the totals drifting.
 */
export type Entry = {
  id: string;
  at: number; // epoch ms, for ordering
  c: number;
  p: number;
  f: number;
};

export type Log = Record<DayKey, Entry[]>;

export type Totals = { c: number; p: number; f: number };

export const EMPTY_TOTALS: Totals = { c: 0, p: 0, f: 0 };

const STORAGE_KEY = 'macrotracker.log.v1';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Anything that isn't recognisably ours is dropped rather than crashing the app. */
function sanitize(raw: unknown): Log {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Log = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDayKey(key) || !Array.isArray(value)) continue;
    const entries: Entry[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Partial<Entry>;
      entries.push({
        id: typeof e.id === 'string' && e.id ? e.id : `${key}-${entries.length}-${Math.random()}`,
        at: num(e.at),
        c: num(e.c),
        p: num(e.p),
        f: num(e.f),
      });
    }
    if (entries.length) out[key] = entries;
  }
  return out;
}

export async function loadLog(): Promise<Log> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export async function saveLog(log: Log): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Storage being unavailable shouldn't take the UI down; the in-memory log
    // stays correct for the session.
  }
}

export function sumDay(entries: Entry[] | undefined): Totals {
  if (!entries?.length) return EMPTY_TOTALS;
  return entries.reduce(
    (acc, e) => ({ c: acc.c + e.c, p: acc.p + e.p, f: acc.f + e.f }),
    { c: 0, p: 0, f: 0 },
  );
}

export function calories(t: Totals): number {
  return t.c * 4 + t.p * 4 + t.f * 9;
}

export function isEmpty(t: Totals): boolean {
  return t.c === 0 && t.p === 0 && t.f === 0;
}

/**
 * Union two logs, keeping every entry from both and de-duplicating by id.
 *
 * Needed because the UI renders before storage has been read: an entry added in
 * that window lives only in memory, and a plain overwrite on hydrate would
 * silently discard it.
 */
export function mergeLogs(a: Log, b: Log): Log {
  const out: Log = { ...a };
  for (const [day, entries] of Object.entries(b)) {
    const existing = out[day];
    if (!existing?.length) {
      out[day] = entries;
      continue;
    }
    const seen = new Set(existing.map((e) => e.id));
    const merged = existing.concat(entries.filter((e) => !seen.has(e.id)));
    merged.sort((x, y) => x.at - y.at);
    out[day] = merged;
  }
  return out;
}
