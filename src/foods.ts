import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MAX_NAME } from './storage';

/** A food the runner keeps for quick adding. Macros are per serving. */
export type Food = {
  id: string;
  name: string;
  c: number;
  p: number;
  f: number;
  /** As printed on the label, e.g. "2/3 cup (55g)". */
  serving?: string;
  /** Last time it was added to the log, for putting regulars first. */
  usedAt?: number;
};

export type FoodDraft = Pick<Food, 'name' | 'c' | 'p' | 'f' | 'serving'>;

const STORAGE_KEY = 'macrotracker.foods.v1';

let counter = 0;
const newId = () => `food-${Date.now().toString(36)}-${(counter++).toString(36)}`;

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Anything that isn't recognisably a food is dropped rather than crashing the app. */
function sanitize(raw: unknown): Food[] {
  if (!Array.isArray(raw)) return [];
  const out: Food[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const name = text(r.name, MAX_NAME);
    if (!name || typeof r.id !== 'string' || !r.id) continue;
    const food: Food = { id: r.id, name, c: num(r.c), p: num(r.p), f: num(r.f) };
    const serving = text(r.serving, 40);
    if (serving) food.serving = serving;
    if (num(r.usedAt)) food.usedAt = num(r.usedAt);
    out.push(food);
  }
  return out;
}

async function load(): Promise<Food[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

async function save(foods: Food[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(foods));
  } catch {
    // Same as the log: storage failing shouldn't take the app down.
  }
}

const clean = (draft: FoodDraft): FoodDraft => {
  const serving = draft.serving?.trim().slice(0, 40);
  return {
    name: draft.name.trim().slice(0, MAX_NAME),
    c: num(draft.c),
    p: num(draft.p),
    f: num(draft.f),
    ...(serving ? { serving } : {}),
  };
};

/** Most recently used first, then the rest alphabetically. */
export function sortFoods(foods: Food[]): Food[] {
  return [...foods].sort(
    (a, b) => (b.usedAt ?? 0) - (a.usedAt ?? 0) || a.name.localeCompare(b.name),
  );
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Saved foods, persisted. Like the log, this never gates rendering: anything
 * changed before storage comes back is kept, not overwritten by what was
 * stored.
 */
export function useFoods() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    load().then((stored) => {
      if (!alive) return;
      setFoods((current) => {
        const ids = new Set(current.map((f) => f.id));
        return [...current, ...stored.filter((f) => !ids.has(f.id))];
      });
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void save(foods);
  }, [foods, hydrated]);

  /**
   * Save a food. A name that's already saved updates that food instead of
   * adding a second one, so scanning the same label again refreshes it.
   */
  const saveFood = useCallback((draft: FoodDraft, id?: string) => {
    const values = clean(draft);
    if (!values.name) return;
    setFoods((prev) => {
      const match = prev.find((f) => (id ? f.id === id : sameName(f.name, values.name)));
      if (!match) return [...prev, { id: newId(), ...values }];
      return prev.map((f) =>
        f.id === match.id ? { id: f.id, usedAt: f.usedAt, ...values } : f,
      );
    });
  }, []);

  const removeFood = useCallback((id: string) => {
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const markUsed = useCallback((id: string) => {
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, usedAt: Date.now() } : f)));
  }, []);

  const sorted = useMemo(() => sortFoods(foods), [foods]);

  return { foods: sorted, hydrated, saveFood, removeFood, markUsed };
}

export type FoodsStore = ReturnType<typeof useFoods>;

/** "Clif Bar", "Clif Bar ×2", "Clif Bar ×1.5". */
export function servingsName(name: string, servings: number): string {
  return servings === 1 ? name : `${name} ×${Math.round(servings * 100) / 100}`;
}
