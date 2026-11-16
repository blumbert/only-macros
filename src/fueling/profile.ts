import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { isDayKey, type DayKey } from '../date';
import type { HealthXt, ManualXt } from './healthDays';
import type { BoneHistory, Cycle, Goal, Profile, Sex } from './model';
import { RULES, type DayType } from './rules';
import type { DayKm, Week, Weeks } from './training';

/** How distances and weight are shown and typed. Storage is always km and kg. */
export type Units = 'imperial' | 'metric';

export type RunnerState = {
  profile: Profile | null;
  units: Units;
  weeks: Weeks;
  /** Distances set for single days, overriding the week's plan for that day. */
  dayKm: DayKm;
  /** Cross-training set for single days, overriding Apple Health's. */
  dayXt: ManualXt;
  health: HealthState;
};

/**
 * Apple Health. `days` is the last sync's kilometres per day, empty when Health
 * couldn't see any runs, so a denied permission never reads as days off.
 */
export type HealthState = {
  connected: boolean;
  days: Record<DayKey, number>;
  /** Cross-training (every non-running workout) by day, from the last sync. */
  xt?: HealthXt;
  syncedAt?: number;
};

const STORAGE_KEY = 'macrotracker.runner.v1';

const NO_HEALTH: HealthState = { connected: false, days: {} };

const EMPTY: RunnerState = {
  profile: null,
  units: 'imperial',
  weeks: {},
  dayKm: {},
  dayXt: {},
  health: NO_HEALTH,
};

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
  const week: Week = {
    km: positive(r.km) ?? 0,
    longRunKm: positive(r.longRunKm) ?? 0,
    days: r.days.map((d) => oneOf(d, DAY_TYPES, 'easy')),
  };
  const x = r.xt && typeof r.xt === 'object' ? (r.xt as Record<string, unknown>) : null;
  if (x && Array.isArray(x.min) && x.min.length === 7) {
    const { minEffort, maxEffort, defaultEffort } = RULES.crossTraining;
    const efforts = Array.isArray(x.effort) && x.effort.length === 7 ? x.effort : [];
    week.xt = {
      min: x.min.map((m) => Math.round(positive(m) ?? 0)),
      effort: Array.from({ length: 7 }, (_, i) => {
        const e = positive(efforts[i]) ?? defaultEffort;
        return Math.min(Math.max(Math.round(e), minEffort), maxEffort);
      }),
    };
  }
  return week;
}

/** Kilometres keyed by date. Zero is a real answer — a skipped run, a day off. */
function sanitizeDayKm(raw: unknown): DayKm {
  const out: DayKm = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isDayKey(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      out[key] = value;
    }
  }
  return out;
}

function sanitizeXt(raw: unknown): HealthXt {
  const out: HealthXt = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDayKey(key) || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const min = positive(v.min);
    if (min) out[key] = { min, kcal: positive(v.kcal) ?? 0 };
  }
  return out;
}

/** Zero minutes is a real answer (no cross-training that day), as with distance. */
function sanitizeManualXt(raw: unknown): ManualXt {
  const out: ManualXt = {};
  if (!raw || typeof raw !== 'object') return out;
  const { minEffort, maxEffort, defaultEffort } = RULES.crossTraining;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDayKey(key) || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    if (typeof v.min !== 'number' || !Number.isFinite(v.min) || v.min < 0) continue;
    const e = typeof v.effort === 'number' && Number.isFinite(v.effort) ? v.effort : defaultEffort;
    out[key] = { min: v.min, effort: Math.min(Math.max(Math.round(e), minEffort), maxEffort) };
  }
  return out;
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
  const h = r.health && typeof r.health === 'object' ? (r.health as Record<string, unknown>) : {};
  return {
    profile: sanitizeProfile(r.profile),
    units: oneOf<Units>(r.units, ['imperial', 'metric'], 'imperial'),
    weeks,
    dayKm: sanitizeDayKm(r.dayKm),
    dayXt: sanitizeManualXt(r.dayXt),
    health: {
      connected: h.connected === true,
      days: sanitizeDayKm(h.days),
      xt: sanitizeXt(h.xt),
      ...(positive(h.syncedAt) ? { syncedAt: positive(h.syncedAt)! } : {}),
    },
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
        dayXt: { ...stored.dayXt, ...current.dayXt },
        health: current.health.syncedAt ? current.health : stored.health,
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

  /** Cross-training for one day; `null` goes back to Apple Health's. */
  const setDayXt = useCallback((day: DayKey, xt: { min: number; effort: number } | null) => {
    setState((prev) => {
      const dayXt = { ...prev.dayXt };
      if (xt === null) delete dayXt[day];
      else dayXt[day] = xt;
      return { ...prev, dayXt };
    });
  }, []);

  const setHealth = useCallback((health: HealthState) => {
    setState((prev) => ({ ...prev, health }));
  }, []);

  return { ...state, hydrated, setProfile, setWeek, setDayKm, setDayXt, setHealth };
}
