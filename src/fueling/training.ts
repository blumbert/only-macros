import { addDays, fromDayKey, toDayKey, type DayKey } from '../date';
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

/** Distances the runner set for single days, in km, keyed by date. */
export type DayKm = Record<DayKey, number>;

/**
 * Kilometres for each day of the week. The long run is whatever was entered —
 * its share of the week ranges from a third for a recreational runner to under
 * a fifth for an elite, so it can't be guessed — and the rest of the mileage is
 * split evenly across the remaining running days.
 *
 * `set` holds distances the runner gave for single days (by weekday index), and
 * `firstOpen` is the first day that hasn't happened yet. A day the runner set
 * is that distance, wherever it falls. Days before `firstOpen` that weren't set
 * are assumed to have gone to plan. From `firstOpen` on, whatever is left of
 * the week is split across the easy and workout days still to come, so running
 * long early in the week shortens the days after it and missing a day lengthens
 * them.
 */
export function dailyKm(week: Week, set: (number | undefined)[] = [], firstOpen = 0): number[] {
  const hasLong = week.days.includes('long');
  const longKm = hasLong ? Math.min(Math.max(week.longRunKm, 0), week.km) : 0;
  const others = week.days.filter((t) => t === 'easy' || t === 'workout').length;
  const each = others ? Math.max(week.km - longKm, 0) / others : 0;
  const planned = week.days.map((t) => (t === 'rest' ? 0 : t === 'long' ? longKm : each));

  // Each day is either pinned (set, already past, or a rest or long run day)
  // or open, and open days share whatever the pinned ones leave.
  const pinned = week.days.map((t, i) =>
    set[i] !== undefined
      ? set[i]
      : i < firstOpen || (t !== 'easy' && t !== 'workout')
        ? planned[i]
        : null,
  );
  const open = pinned.filter((km) => km === null).length;
  const used = pinned.reduce<number>((sum, km) => sum + (km ?? 0), 0);
  const share = open ? Math.max(week.km - used, 0) / open : 0;
  return pinned.map((km) => km ?? share);
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

/**
 * Day type and distance for one calendar day, from whichever week covers it.
 * `dayKm` are distances set for single days; `today` decides which days of the
 * week are still to come, and so share what's left of it. Without `today`,
 * every day counts as still to come.
 *
 * `set` says the distance is one the runner set for this day, rather than the
 * plan's.
 */
export function planFor(
  weeks: Weeks,
  day: DayKey,
  dayKm: DayKm = {},
  today?: DayKey,
): { type: DayType; km: number; set: boolean } | null {
  const found = weekFor(weeks, day);
  if (!found) return null;
  // Set distances belong to the dates they were set on, not to the week the
  // plan was carried from.
  const start = weekKey(day);
  const set = Array.from({ length: 7 }, (_, i) => dayKm[addDays(start, i)]);
  const firstOpen = !today
    ? 0
    : start < weekKey(today)
      ? 7
      : start > weekKey(today)
        ? 0
        : fromDayKey(today).getDay();
  const index = fromDayKey(day).getDay();
  return {
    type: found.week.days[index],
    km: dailyKm(found.week, set, firstOpen)[index],
    set: set[index] !== undefined,
  };
}
