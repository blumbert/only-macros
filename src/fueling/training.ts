import { fromDayKey, toDayKey, type DayKey } from '../date';
import type { DayType } from './rules';

/**
 * One week of training, Sunday to Saturday to match the calendar. Distances
 * are stored in km whatever unit the runner types in, so the model never has
 * to care which one they use.
 */
export type Week = {
  km: number;
  longRunKm: number;
  /** Index 0 is Sunday. Anything not marked is an easy day. */
  days: DayType[];
};

export type Weeks = Record<DayKey, Week>;

export const KM_PER_MI = 1.609344;

export const EMPTY_WEEK: Week = {
  km: 0,
  longRunKm: 0,
  days: ['easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'easy'],
};

/** The Sunday that starts the week `day` falls in. */
export function weekKey(day: DayKey): DayKey {
  const d = fromDayKey(day);
  d.setDate(d.getDate() - d.getDay());
  return toDayKey(d);
}

/**
 * Tap a day chip in one of the rows. Tapping a day that's already that type
 * turns it back into an easy day; otherwise it becomes that type, which takes
 * it out of whichever row it was in. There's only ever one long run.
 */
export function setDayType(days: DayType[], index: number, type: Exclude<DayType, 'easy'>) {
  const next = days.slice();
  if (next[index] === type) {
    next[index] = 'easy';
    return next;
  }
  if (type === 'long') {
    for (let i = 0; i < next.length; i++) if (next[i] === 'long') next[i] = 'easy';
  }
  next[index] = type;
  return next;
}

export type WeekProblem = 'longRunOverWeek' | 'longRunMissing';

export function checkWeek(week: Week): WeekProblem | null {
  if (!week.days.includes('long')) return null;
  if (week.longRunKm <= 0) return 'longRunMissing';
  if (week.longRunKm > week.km) return 'longRunOverWeek';
  return null;
}

/**
 * Kilometres for each day of the week. The long run is whatever was entered —
 * its share of the week ranges from a third for a recreational runner to under
 * a fifth for an elite, so it can't be guessed — and the rest of the mileage is
 * split evenly across the remaining running days.
 */
export function dailyKm(week: Week): number[] {
  const hasLong = week.days.includes('long');
  const longKm = hasLong ? Math.min(Math.max(week.longRunKm, 0), week.km) : 0;
  const others = week.days.filter((t) => t === 'easy' || t === 'workout').length;
  const each = others ? Math.max(week.km - longKm, 0) / others : 0;
  return week.days.map((t) => (t === 'rest' ? 0 : t === 'long' ? longKm : each));
}

/**
 * The week covering `day`. A week with no entry reuses the most recent earlier
 * one — runners repeat weeks far more often than they change them — and says
 * so, so the page can show "same as last week". Nothing before it at all means
 * there's no plan to go on yet.
 */
export function weekFor(weeks: Weeks, day: DayKey): { week: Week; key: DayKey; carried: boolean } | null {
  const key = weekKey(day);
  if (weeks[key]) return { week: weeks[key], key, carried: false };
  const earlier = Object.keys(weeks)
    .filter((k) => k < key)
    .sort();
  const last = earlier[earlier.length - 1];
  return last ? { week: weeks[last], key: last, carried: true } : null;
}

/** Day type and distance for one calendar day, from whichever week covers it. */
export function planFor(weeks: Weeks, day: DayKey): { type: DayType; km: number } | null {
  const found = weekFor(weeks, day);
  if (!found) return null;
  const index = fromDayKey(day).getDay();
  return { type: found.week.days[index], km: dailyKm(found.week)[index] };
}
