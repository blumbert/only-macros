import { addDays, fromDayKey, toDayKey, type DayKey } from '../date';
import { crossTrainingKcal } from './model';
import { RULES, type DayType } from './rules';
import { dayIndex, weekFor, weekKey, type DayKm, type Week, type Weeks } from './training';

/** A run as Apple Health reports it: when it started, and how far. */
export type HealthRun = { start: Date; meters: number };

/** The days a sync speaks for: the last `back` days, and today. */
export function healthWindow(today: DayKey, back: number): DayKey[] {
  return Array.from({ length: back + 1 }, (_, i) => addDays(today, i - back));
}

/**
 * Kilometres run on each day of `days`, by the run's local start date. Every
 * day in `days` gets an entry, 0 when nothing was run: a day Health covers
 * with no run in it is a day off, which is the point of covering it.
 */
export function runKmByDay(runs: HealthRun[], days: DayKey[]): Record<DayKey, number> {
  const out: Record<DayKey, number> = {};
  for (const day of days) out[day] = 0;
  for (const run of runs) {
    const day = toDayKey(run.start);
    if (day in out && run.meters > 0) out[day] += run.meters / 1000;
  }
  for (const day of days) out[day] = Math.round(out[day] * 100) / 100;
  return out;
}

/**
 * The distance for each day, from three sources in order of authority: what
 * the runner set by hand, then Apple Health, then (left to the plan) nothing.
 * Health speaks for past days in full — no run means 0 — but for today only
 * once a run is in: today isn't over, and a 0 would wipe out the default of
 * "what's left of the week".
 */
export function mergeDayKm(
  manual: DayKm,
  health: Record<DayKey, number> | null,
  today: DayKey,
): DayKm {
  const out: DayKm = {};
  if (health) {
    for (const [day, km] of Object.entries(health)) {
      if (day < today || (day === today && km > 0)) out[day] = km;
    }
  }
  return { ...out, ...manual };
}

/** Where a day's distance comes from, for saying so on the page. */
export function distanceSource(
  day: DayKey,
  manual: DayKm,
  health: Record<DayKey, number> | null,
  today: DayKey,
): 'manual' | 'health' | 'plan' {
  if (manual[day] !== undefined) return 'manual';
  const km = health?.[day];
  if (km !== undefined && (day < today || (day === today && km > 0))) return 'health';
  return 'plan';
}

/**
 * A training week read off the last 7 days in Apple Health, for a runner who
 * hasn't entered one: runners repeat their weeks, so last week's running is
 * the best guess at this week's. Each weekday takes what was run on it, days
 * with no run are rest days, and with three or more runs the longest one is
 * the long run (with fewer there's no telling a long run from a short week).
 * No runs at all gives null: there's nothing to plan from.
 */
export function weekFromHealth(health: Record<DayKey, number>, today: DayKey): Week | null {
  const days: DayType[] = Array(7).fill('rest');
  const kmByIndex: number[] = Array(7).fill(0);
  for (let back = 1; back <= 7; back++) {
    const day = addDays(today, -back);
    kmByIndex[dayIndex(day)] = health[day] ?? 0;
  }
  const runs = kmByIndex.filter((km) => km > 0).length;
  if (!runs) return null;
  const longest = Math.max(...kmByIndex);
  let longMarked = false;
  kmByIndex.forEach((km, i) => {
    if (km <= 0) return;
    if (runs >= 3 && km === longest && !longMarked) {
      days[i] = 'long';
      longMarked = true;
    } else days[i] = 'easy';
  });
  const km = Math.round(kmByIndex.reduce((a, b) => a + b, 0) * 100) / 100;
  return { km, longRunKm: longMarked ? longest : 0, days };
}

/**
 * The weeks to plan from: the ones the runner entered, with Apple Health's
 * last 7 days standing in for this week and last week where neither has a
 * plan (entered or carried forward) with any mileage in it. Returns which
 * week keys came from Health, so the page can say so.
 */
export function withHealthWeeks(
  weeks: Weeks,
  health: Record<DayKey, number> | null,
  today: DayKey,
): { weeks: Weeks; fromHealth: DayKey[] } {
  const guess = health ? weekFromHealth(health, today) : null;
  if (!guess) return { weeks, fromHealth: [] };
  const out: Weeks = { ...weeks };
  const fromHealth: DayKey[] = [];
  // Last week first, so this week can't carry a guess forward as if entered.
  for (const day of [addDays(today, -7), today]) {
    const key = weekKey(day);
    const found = weekFor(weeks, day);
    if (found && found.week.km > 0) continue;
    out[key] = found?.week.xt ? { ...guess, xt: found.week.xt } : guess;
    fromHealth.push(key);
  }
  return { weeks: out, fromHealth };
}

/** A non-running workout as Apple Health reports it. */
export type HealthWorkout = { start: Date; minutes: number; kcal: number };

/** Cross-training on one day from Apple Health: minutes, and its measured energy. */
export type HealthXt = Record<DayKey, { min: number; kcal: number }>;

/** Cross-training the runner set for a day: minutes, and effort from 1 to 10. */
export type ManualXt = Record<DayKey, { min: number; effort: number }>;

/**
 * Cross-training minutes and energy on each day of `days`, by local start
 * date. Only days with a workout get an entry — unlike runs, a day without
 * cross-training isn't something the plan needs told.
 */
export function crossTrainingByDay(workouts: HealthWorkout[], days: DayKey[]): HealthXt {
  const out: HealthXt = {};
  const covered = new Set(days);
  for (const w of workouts) {
    const day = toDayKey(w.start);
    if (!covered.has(day) || w.minutes <= 0) continue;
    const prev = out[day] ?? { min: 0, kcal: 0 };
    out[day] = { min: prev.min + w.minutes, kcal: prev.kcal + Math.max(w.kcal, 0) };
  }
  for (const day of Object.keys(out)) {
    out[day] = { min: Math.round(out[day].min), kcal: Math.round(out[day].kcal) };
  }
  return out;
}

export type DayXt = {
  min: number;
  /** 1–10; null when Apple Health measured the energy itself. */
  effort: number | null;
  kcal: number;
  source: 'manual' | 'health' | 'plan' | 'none';
};

/**
 * A day's cross-training, in order of authority: what the runner set by
 * hand, Apple Health's workouts, then the week's plan. Health's own measured
 * energy is used when it has one; minutes alone are costed by effort. Once a
 * day is over and Health is connected, Health speaks for it in full — no
 * workout means none, whatever the plan said.
 */
export function dayCrossTraining(
  day: DayKey,
  manual: ManualXt,
  health: HealthXt | null,
  weightKg: number,
  planned: { min: number; effort: number } | null = null,
  healthCoversDay = false,
): DayXt {
  const set = manual[day];
  if (set) {
    const kcal = crossTrainingKcal(weightKg, set.min, set.effort);
    return { min: set.min, effort: set.effort, kcal, source: 'manual' };
  }
  const h = health?.[day];
  if (h && h.min > 0) {
    if (h.kcal > 0) return { min: h.min, effort: null, kcal: h.kcal, source: 'health' };
    const effort = RULES.crossTraining.defaultEffort;
    const kcal = crossTrainingKcal(weightKg, h.min, effort);
    return { min: h.min, effort, kcal, source: 'health' };
  }
  if (planned && !healthCoversDay) {
    const kcal = crossTrainingKcal(weightKg, planned.min, planned.effort);
    return { min: planned.min, effort: planned.effort, kcal, source: 'plan' };
  }
  return { min: 0, effort: null, kcal: 0, source: 'none' };
}
