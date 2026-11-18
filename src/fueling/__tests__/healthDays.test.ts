import { describe, expect, it } from '@jest/globals';

import {
  crossTrainingByDay,
  dayCrossTraining,
  distanceSource,
  healthWindow,
  mergeDayKm,
  runKmByDay,
  weekFromHealth,
  withHealthWeeks,
} from '../healthDays';
import { crossTrainingKcal, dayTargets, type Profile } from '../model';
import { planFor, plannedCrossTraining, type Week } from '../training';

const at = (day: string, hour: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};

describe('healthWindow', () => {
  it('is the last n days and today, oldest first', () => {
    expect(healthWindow('2026-10-21', 3)).toEqual([
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
    ]);
  });
});

describe('runKmByDay', () => {
  const days = ['2026-10-19', '2026-10-20', '2026-10-21'];

  it('gives every covered day an entry, 0 when nothing was run', () => {
    expect(runKmByDay([], days)).toEqual({ '2026-10-19': 0, '2026-10-20': 0, '2026-10-21': 0 });
  });

  it('adds up a day with two runs', () => {
    const runs = [
      { start: at('2026-10-20', 7), meters: 5000 },
      { start: at('2026-10-20', 18), meters: 3210 },
    ];
    expect(runKmByDay(runs, days)['2026-10-20']).toBe(8.21);
  });

  it('files a run by its local start day, late runs included', () => {
    const runs = [{ start: at('2026-10-19', 23), meters: 10000 }];
    expect(runKmByDay(runs, days)).toEqual({ '2026-10-19': 10, '2026-10-20': 0, '2026-10-21': 0 });
  });

  it('ignores runs outside the window', () => {
    const runs = [{ start: at('2026-10-10', 9), meters: 15000 }];
    expect(Object.values(runKmByDay(runs, days))).toEqual([0, 0, 0]);
  });
});

describe('mergeDayKm', () => {
  const today = '2026-10-21';
  const health = { '2026-10-19': 0, '2026-10-20': 8, '2026-10-21': 0 };

  it('takes past days from Health, a missed run as 0', () => {
    expect(mergeDayKm({}, health, today)).toEqual({ '2026-10-19': 0, '2026-10-20': 8 });
  });

  it('leaves today to the plan until a run is in', () => {
    expect(mergeDayKm({}, health, today)['2026-10-21']).toBeUndefined();
    expect(mergeDayKm({}, { ...health, '2026-10-21': 6.5 }, today)['2026-10-21']).toBe(6.5);
  });

  it('lets a distance set by hand win over Health', () => {
    expect(mergeDayKm({ '2026-10-19': 5 }, health, today)['2026-10-19']).toBe(5);
  });

  it('is just the hand-set distances without Health', () => {
    expect(mergeDayKm({ '2026-10-19': 5 }, null, today)).toEqual({ '2026-10-19': 5 });
  });
});

describe('distanceSource', () => {
  const today = '2026-10-21';
  const health = { '2026-10-19': 0, '2026-10-21': 0 };

  it('names the source that won', () => {
    expect(distanceSource('2026-10-19', { '2026-10-19': 3 }, health, today)).toBe('manual');
    expect(distanceSource('2026-10-19', {}, health, today)).toBe('health');
    expect(distanceSource('2026-10-21', {}, health, today)).toBe('plan');
    expect(distanceSource('2026-10-19', {}, null, today)).toBe('plan');
  });
});

describe('weekFromHealth', () => {
  // Wednesday 18 November 2026; the 7 days before it run Wed 11 to Tue 17.
  const today = '2026-11-18';
  const health = {
    '2026-11-11': 5,
    '2026-11-12': 0,
    '2026-11-13': 6,
    '2026-11-14': 0,
    '2026-11-15': 16,
    '2026-11-16': 0,
    '2026-11-17': 5,
    '2026-11-18': 0,
  };

  it('makes the last 7 days a week: no run is rest, the longest is the long run', () => {
    expect(weekFromHealth(health, today)).toEqual({
      km: 32,
      longRunKm: 16,
      // Monday to Sunday.
      days: ['rest', 'easy', 'easy', 'rest', 'easy', 'rest', 'long'],
    });
  });

  it('marks no long run with fewer than three runs', () => {
    const week = weekFromHealth({ '2026-11-15': 16, '2026-11-17': 5 }, today);
    expect(week).toEqual({
      km: 21,
      longRunKm: 0,
      days: ['rest', 'easy', 'rest', 'rest', 'rest', 'rest', 'easy'],
    });
  });

  it('is null with no runs', () => {
    expect(weekFromHealth({ '2026-11-15': 0 }, today)).toBeNull();
    expect(weekFromHealth({}, today)).toBeNull();
  });

  describe('withHealthWeeks', () => {
    it('stands in for this week and last week when nothing is entered', () => {
      const planned = withHealthWeeks({}, health, today);
      expect(planned.fromHealth).toEqual(['2026-11-09', '2026-11-16']);
      // Tuesday's 5 and Sunday's 16-long run leave 11 of the 32 for Wednesday and Friday.
      const plan = planFor(planned.weeks, today, mergeDayKm({}, health, today), today);
      expect(plan).toEqual({ type: 'easy', km: 5.5, set: false });
    });

    it('leaves an entered week alone', () => {
      const entered: Week = { km: 40, longRunKm: 0, days: Array(7).fill('easy') };
      const planned = withHealthWeeks({ '2026-11-16': entered }, health, today);
      expect(planned.weeks['2026-11-16']).toBe(entered);
      expect(planned.fromHealth).toEqual(['2026-11-09']);
    });

    it('replaces an entered week with no mileage in it', () => {
      const empty: Week = { km: 0, longRunKm: 0, days: Array(7).fill('easy') };
      const planned = withHealthWeeks({ '2026-11-16': empty }, health, today);
      expect(planned.weeks['2026-11-16'].km).toBe(32);
    });

    it('changes nothing without Health', () => {
      const weeks = {};
      expect(withHealthWeeks(weeks, null, today)).toEqual({ weeks, fromHealth: [] });
    });
  });
});

describe('cross-training', () => {
  it('costs typed-in minutes by effort, 1 kcal/kg/h per point', () => {
    expect(crossTrainingKcal(60, 60, 5)).toBe(300);
    expect(crossTrainingKcal(60, 30, 10)).toBe(300);
    // Out-of-range effort is held to 1–10; no effort means moderate.
    expect(crossTrainingKcal(60, 60, 14)).toBe(600);
    expect(crossTrainingKcal(60, 60)).toBe(360);
  });

  it('adds up each day’s non-running workouts from Health', () => {
    const xt = crossTrainingByDay(
      [
        { start: at('2026-10-20', 7), minutes: 30, kcal: 200 },
        { start: at('2026-10-20', 18), minutes: 20.4, kcal: 90.6 },
        { start: at('2026-10-10', 7), minutes: 60, kcal: 400 },
      ],
      ['2026-10-19', '2026-10-20', '2026-10-21'],
    );
    expect(xt).toEqual({ '2026-10-20': { min: 50, kcal: 291 } });
  });

  it('takes the runner’s own entry, then Health’s measured energy, then nothing', () => {
    const health = { '2026-10-20': { min: 40, kcal: 250 }, '2026-10-21': { min: 30, kcal: 0 } };
    const manual = { '2026-10-19': { min: 60, effort: 7 } };
    expect(dayCrossTraining('2026-10-19', manual, health, 60)).toEqual({
      min: 60,
      effort: 7,
      kcal: 420,
      source: 'manual',
    });
    expect(dayCrossTraining('2026-10-20', manual, health, 60)).toEqual({
      min: 40,
      effort: null,
      kcal: 250,
      source: 'health',
    });
    // A Health workout with no energy recorded is costed at a moderate effort.
    expect(dayCrossTraining('2026-10-21', manual, health, 60).kcal).toBe(180);
    expect(dayCrossTraining('2026-10-22', manual, health, 60).source).toBe('none');
  });

  it('raises the day’s calories without counting against energy availability', () => {
    const p: Profile = {
      sex: 'female',
      age: 30,
      weightKg: 60,
      lifestyle: 'desk',
      goal: 'maintain',
      bone: 'none',
      boneLongLayoff: false,
      cycle: 'regular',
    };
    const without = dayTargets(p, { type: 'easy', km: 8 });
    const withXt = dayTargets(p, { type: 'easy', km: 8, crossTrainingKcal: 300 });
    expect(withXt.kcal - without.kcal).toBe(300);
    expect(withXt.crossTrainingKcal).toBe(300);
    expect(withXt.ea).toBe(without.ea);
  });
});

describe('planned cross-training', () => {
  // Week of Monday 16 November 2026: cross-training Wednesday and Friday.
  const week: Week = {
    km: 30,
    longRunKm: 0,
    days: Array(7).fill('easy'),
    xt: { min: [0, 0, 40, 0, 25, 0, 0], effort: [5, 5, 6, 5, 8, 5, 5] },
  };
  const weeks = { '2026-11-16': week };

  it('gives each day its own minutes and effort', () => {
    expect(plannedCrossTraining(weeks, '2026-11-18')).toEqual({ min: 40, effort: 6 });
    expect(plannedCrossTraining(weeks, '2026-11-20')).toEqual({ min: 25, effort: 8 });
    expect(plannedCrossTraining(weeks, '2026-11-17')).toBeNull();
  });

  it('fills a day from the plan, below a hand entry and Health', () => {
    const planned = plannedCrossTraining(weeks, '2026-11-18');
    expect(dayCrossTraining('2026-11-18', {}, null, 60, planned)).toEqual({
      min: 40,
      effort: 6,
      kcal: 240,
      source: 'plan',
    });
    const manual = { '2026-11-18': { min: 20, effort: 3 } };
    expect(dayCrossTraining('2026-11-18', manual, null, 60, planned).source).toBe('manual');
  });

  it('lets Health speak for a finished day, so a skipped session counts as none', () => {
    const planned = plannedCrossTraining(weeks, '2026-11-18');
    expect(dayCrossTraining('2026-11-18', {}, {}, 60, planned, true).source).toBe('none');
  });
});
