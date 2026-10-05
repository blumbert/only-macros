import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { isDayKey, type DayKey } from '../date';
import type { BoneHistory, Cycle, Goal, Profile, Sex } from './model';
import type { DayType } from './rules';
import type { DayKm, Week, Weeks } from './training';

/** How distances and weight are shown and typed. Storage is always km and kg. */
export type Units = 'imperial' | 'metric';

export type RunnerState = {
  profile: Profile | null;
  units: Units;
  weeks: Weeks;
  /** Distances set for single days, overriding the week's plan for that day. */
  dayKm: DayKm;
};

const STORAGE_KEY = 'macrotracker.runner.v1';

const EMPTY: RunnerState = { profile: null, units: 'imperial', weeks: {}, dayKm: {} };

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const positive = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const DAY_TYPES: readonly DayType[] = ['rest', 'easy', 'workout', 'long'];

function sanitizeProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const age = positive(r.age);
  const weightKg = positive(r.weightKg);
  if (!age || !weightKg) return null;
  const bodyFat = positive(r.bodyFat);
  return {
    sex: oneOf<Sex>(r.sex, ['male', 'female'], 'female'),
    age,
    weightKg,
    bodyFat: bodyFat && bodyFat < 1 ? bodyFat : undefined,
    lifestyle: oneOf(r.lifestyle, ['desk', 'onFeet'] as const, 'desk'),
    goal: oneOf<Goal>(r.goal, ['maintain', 'lose', 'recomp'], 'maintain'),
    bone: oneOf<BoneHistory>(r.bone, ['none', 'oneLowRisk', 'oneHighRisk', 'twoOrMore'], 'none'),
    boneLongLayoff: r.boneLongLayoff === true,
    cycle: oneOf<Cycle>(r.cycle, ['regular', 'oligo', 'missed3', 'notApplicable'], 'notApplicable'),
  };
}

function sanitizeWeek(raw: unknown): Week | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.days) || r.days.length !== 7) return null;
  return {
    km: positive(r.km) ?? 0,
    longRunKm: positive(r.longRunKm) ?? 0,
    days: r.days.map((d) => oneOf(d, DAY_TYPES, 'easy')),
  };
}

/** Anything that isn't recognisably ours is dropped rather than crashing the app. */
function sanitize(raw: unknown): RunnerState {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const r = raw as Record<string, unknown>;
  const weeks: Weeks = {};
  if (r.weeks && typeof r.weeks === 'object') {
    for (const [key, value] of Object.entries(r.weeks as Record<string, unknown>)) {
      const week = sanitizeWeek(value);
      if (isDayKey(key) && week) weeks[key] = week;
    }
  }
  // Zero is a real answer here — a day set to 0 is a skipped run.
  const dayKm: DayKm = {};
  if (r.dayKm && typeof r.dayKm === 'object') {
    for (const [key, value] of Object.entries(r.dayKm as Record<string, unknown>)) {
      if (isDayKey(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        dayKm[key] = value;
      }
    }
  }
  return {
    profile: sanitizeProfile(r.profile),
    units: oneOf<Units>(r.units, ['imperial', 'metric'], 'imperial'),
    weeks,
    dayKm,
  };
}

async function load(): Promise<RunnerState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

async function save(state: RunnerState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Same as the log: storage failing shouldn't take the page down.
  }
}

/**
 * The runner's profile and training weeks, persisted. Like the log, this never
 * gates rendering: anything changed before storage comes back wins over what
 * was stored, rather than being overwritten by it.
 */
export function useRunner() {
  const [state, setState] = useState<RunnerState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    load().then((stored) => {
      if (!alive) return;
      setState((current) => ({
        profile: current.profile ?? stored.profile,
        units: current.profile ? current.units : stored.units,
        weeks: { ...stored.weeks, ...current.weeks },
        dayKm: { ...stored.dayKm, ...current.dayKm },
      }));
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void save(state);
  }, [state, hydrated]);

  const setProfile = useCallback((profile: Profile, units: Units) => {
    setState((prev) => ({ ...prev, profile, units }));
  }, []);

  const setWeek = useCallback((key: DayKey, week: Week) => {
    setState((prev) => ({ ...prev, weeks: { ...prev.weeks, [key]: week } }));
  }, []);

  /** `null` drops the day back to the week's plan. */
  const setDayKm = useCallback((day: DayKey, km: number | null) => {
    setState((prev) => {
      const dayKm = { ...prev.dayKm };
      if (km === null) delete dayKm[day];
      else dayKm[day] = km;
      return { ...prev, dayKm };
    });
  }, []);

  return { ...state, hydrated, setProfile, setWeek, setDayKm };
}
