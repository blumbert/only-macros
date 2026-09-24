import { describe, expect, it } from '@jest/globals';

import {
  checkWeek,
  dailyKm,
  EMPTY_WEEK,
  KM_PER_MI,
  planFor,
  setDayType,
  weekFor,
  weekKey,
  type Week,
} from '../training';

describe('weekKey', () => {
  it('maps any day to the Sunday that starts its week', () => {
    expect(weekKey('2026-09-24')).toBe('2026-09-20'); // Thursday
    expect(weekKey('2026-09-20')).toBe('2026-09-20'); // Sunday itself
    expect(weekKey('2026-09-26')).toBe('2026-09-20'); // Saturday
  });

  it('crosses month and year boundaries', () => {
    expect(weekKey('2026-10-01')).toBe('2026-09-27');
    expect(weekKey('2027-01-02')).toBe('2026-12-27');
  });
});

describe('setDayType', () => {
  const easyWeek = EMPTY_WEEK.days;

  it('moves a day out of its old row when it joins a new one', () => {
    const rest = setDayType(easyWeek, 5, 'rest');
    expect(rest[5]).toBe('rest');
    expect(setDayType(rest, 5, 'workout')[5]).toBe('workout');
  });

  it('turns a day back to easy when its own chip is tapped again', () => {
    const workout = setDayType(easyWeek, 2, 'workout');
    expect(setDayType(workout, 2, 'workout')[2]).toBe('easy');
  });

  it('keeps only one long run', () => {
    const sat = setDayType(easyWeek, 6, 'long');
    const sun = setDayType(sat, 0, 'long');
    expect(sun.filter((t) => t === 'long')).toHaveLength(1);
    expect(sun[0]).toBe('long');
    expect(sun[6]).toBe('easy');
  });

  it('allows any number of workouts and rest days', () => {
    let days = setDayType(easyWeek, 1, 'workout');
    days = setDayType(days, 3, 'workout');
    days = setDayType(days, 4, 'rest');
    days = setDayType(days, 5, 'rest');
    expect(days).toEqual(['easy', 'workout', 'easy', 'workout', 'rest', 'rest', 'easy']);
  });

  it('does not mutate the week it was given', () => {
    setDayType(easyWeek, 0, 'long');
    expect(easyWeek[0]).toBe('easy');
  });
});

describe('dailyKm', () => {
  it('uses the entered long run, not a share of the week', () => {
    // An elite week: 25 of 140 miles is under a fifth — any fixed percentage
    // would misplace it.
    const week: Week = {
      km: 140 * KM_PER_MI,
      longRunKm: 25 * KM_PER_MI,
      days: ['long', 'easy', 'workout', 'easy', 'workout', 'easy', 'easy'],
    };
    const km = dailyKm(week);
    expect(km[0]).toBeCloseTo(25 * KM_PER_MI);
    for (const d of km.slice(1)) expect(d).toBeCloseTo((115 / 6) * KM_PER_MI);
  });

  it('gives rest days nothing and spreads the rest over running days only', () => {
    const week: Week = {
      km: 50,
      longRunKm: 20,
      days: ['long', 'rest', 'easy', 'workout', 'easy', 'rest', 'easy'],
    };
    expect(dailyKm(week)).toEqual([20, 0, 7.5, 7.5, 7.5, 0, 7.5]);
  });

  it('treats workout days the same distance as easy days', () => {
    const week: Week = { ...EMPTY_WEEK, km: 70, days: setDayType(EMPTY_WEEK.days, 2, 'workout') };
    expect(new Set(dailyKm(week)).size).toBe(1);
  });

  it('ignores a long run distance when no long run day is picked', () => {
    expect(dailyKm({ ...EMPTY_WEEK, km: 70, longRunKm: 30 })).toEqual(Array(7).fill(10));
  });

  it('adds up to the week', () => {
    const week: Week = {
      km: 88,
      longRunKm: 26,
      days: ['long', 'workout', 'easy', 'rest', 'workout', 'easy', 'easy'],
    };
    expect(dailyKm(week).reduce((a, b) => a + b, 0)).toBeCloseTo(88);
  });
});

describe('checkWeek', () => {
  const withLong = setDayType(EMPTY_WEEK.days, 0, 'long');

  it('rejects a long run longer than the week', () => {
    expect(checkWeek({ km: 20, longRunKm: 25, days: withLong })).toBe('longRunOverWeek');
  });

  it('asks for a distance once a long run day is picked', () => {
    expect(checkWeek({ km: 60, longRunKm: 0, days: withLong })).toBe('longRunMissing');
  });

  it('is fine without a long run', () => {
    expect(checkWeek({ ...EMPTY_WEEK, km: 40 })).toBeNull();
  });
});

describe('weekFor', () => {
  const a: Week = { ...EMPTY_WEEK, km: 50 };
  const b: Week = { ...EMPTY_WEEK, km: 80 };

  it('uses the week that was entered for that day', () => {
    expect(weekFor({ '2026-09-20': b }, '2026-09-24')).toEqual({
      week: b,
      key: '2026-09-20',
      carried: false,
    });
  });

  it('carries the most recent earlier week forward, and says so', () => {
    const weeks = { '2026-09-06': a, '2026-09-13': b };
    expect(weekFor(weeks, '2026-09-24')).toEqual({ week: b, key: '2026-09-13', carried: true });
  });

  it('never carries a later week backwards', () => {
    expect(weekFor({ '2026-09-27': b }, '2026-09-24')).toBeNull();
  });

  it('has nothing to go on before the first week', () => {
    expect(weekFor({}, '2026-09-24')).toBeNull();
  });
});

describe('planFor', () => {
  it('reads the day type and distance for a calendar day', () => {
    const week: Week = {
      km: 60,
      longRunKm: 20,
      days: ['long', 'rest', 'workout', 'easy', 'easy', 'rest', 'easy'],
    };
    // 2026-09-22 is a Tuesday — index 2.
    expect(planFor({ '2026-09-20': week }, '2026-09-22')).toEqual({ type: 'workout', km: 10 });
  });
});
