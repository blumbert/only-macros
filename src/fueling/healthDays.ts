import { addDays, toDayKey, type DayKey } from '../date';
import type { DayKm } from './training';

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
