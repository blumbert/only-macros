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

  describe('with days set and days already past', () => {
    // 50 km: long 20 Sunday, rest Monday and Friday, 7.5 on each other day.
    const week: Week = {
      km: 50,
      longRunKm: 20,
      days: ['long', 'rest', 'easy', 'workout', 'easy', 'rest', 'easy'],
    };
    const none = Array<number | undefined>(7).fill(undefined);
    const withSet = (i: number, km: number) => none.map((v, j) => (j === i ? km : v));

    it('is the plain plan when nothing is set and nothing has passed', () => {
      expect(dailyKm(week, none, 0)).toEqual(dailyKm(week));
    });

    it('splits what a set day leaves over the other open days', () => {
      // Tuesday set to 12 leaves 50 - 20 - 12 = 18 for Wed, Thu, Sat.
      expect(dailyKm(week, withSet(2, 12), 0)).toEqual([20, 0, 12, 6, 6, 0, 6]);
    });

    it('assumes unset past days went to plan, and spreads the rest over the days left', () => {
      // Thursday: Sun 20 + Tue 7.5 + Wed 7.5 are done, leaving 15 for Thu and Sat.
      expect(dailyKm(week, none, 4)).toEqual([20, 0, 7.5, 7.5, 7.5, 0, 7.5]);
      // Wednesday skipped: Thu and Sat pick up its 7.5.
      expect(dailyKm(week, withSet(3, 0), 4)).toEqual([20, 0, 7.5, 0, 11.25, 0, 11.25]);
    });

    it('counts a run on a rest day against the week', () => {
      expect(dailyKm(week, withSet(1, 6), 0)).toEqual([20, 6, 6, 6, 6, 0, 6]);
    });

    it('lets a set day replace the long run', () => {
      expect(dailyKm(week, withSet(0, 26), 0)).toEqual([26, 0, 6, 6, 6, 0, 6]);
    });

    it('never goes below zero when the week is already run', () => {
      expect(dailyKm(week, withSet(2, 40), 0)).toEqual([20, 0, 40, 0, 0, 0, 0]);
    });
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
    expect(planFor({ '2026-09-20': week }, '2026-09-22')).toEqual({
      type: 'workout',
      km: 10,
      set: false,
    });
  });

  const week: Week = {
    km: 50,
    longRunKm: 20,
    days: ['long', 'rest', 'easy', 'workout', 'easy', 'rest', 'easy'],
  };
  const weeks = { '2026-09-20': week };

  it('returns a distance set for the day, and says so', () => {
    expect(planFor(weeks, '2026-09-22', { '2026-09-22': 3 })).toEqual({
      type: 'easy',
      km: 3,
      set: true,
    });
  });

  it('defaults today to what is left of the week over the running days left', () => {
    // Thursday 9/24, Wednesday skipped: 50 - 20 - 7.5 - 0 = 22.5 over Thu and Sat.
    const plan = planFor(weeks, '2026-09-24', { '2026-09-23': 0 }, '2026-09-24');
    expect(plan?.km).toBeCloseTo(11.25);
  });

  it('treats every day of a past week as done and a future week as open', () => {
    const dayKm = { '2026-09-22': 0 };
    // Seen from the next week, Wednesday's share isn't moved by Tuesday's skip.
    expect(planFor(weeks, '2026-09-23', dayKm, '2026-09-28')?.km).toBeCloseTo(7.5);
    // Seen from the week before, the whole week is still to come.
    expect(planFor(weeks, '2026-09-23', dayKm, '2026-09-15')?.km).toBeCloseTo(10);
  });

  it('applies set days by date, not to the week the plan was carried from', () => {
    // The 9/27 week borrows 9/20's plan; a day set in 9/20 doesn't follow it.
    expect(planFor(weeks, '2026-09-29', { '2026-09-22': 0 })?.km).toBeCloseTo(7.5);
  });
});
